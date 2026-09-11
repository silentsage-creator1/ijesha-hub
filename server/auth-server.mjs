import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import { createClient } from '@supabase/supabase-js'
import { validateSession } from './session-validation.mjs'
import { studentRoleRoster } from './student-roster.mjs'
import { profileCertificates } from './profile-certificates.mjs'

const port = Number(process.env.PORT ?? process.env.APP_API_PORT ?? 3001)
const databaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const publicUrl = (process.env.APP_PUBLIC_URL ?? process.env.APP_ORIGIN ?? `http://localhost:${port}`).replace(/\/$/, '')

if (!databaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required by the app backend.')
}

// Retry a dropped connection only for reads. Never replay a mutation that may
// already have been committed by the database.
async function databaseFetch(input, init) {
  // Avoid reusing sockets closed by a hosting proxy between requests. In
  // particular, never recover a dropped write by blindly replaying it.
  const headers = new Headers(init?.headers)
  headers.set('connection','close')
  init = { ...init, headers }
  try {
    return await fetch(input, init)
  } catch (error) {
    const method = (init?.method ?? 'GET').toUpperCase()
    if (!['GET', 'HEAD'].includes(method) || init?.signal?.aborted) throw error
    return fetch(input, init)
  }
}
const db = createClient(databaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
  global: { fetch: databaseFetch },
})
const cookieName = 'ijesha_app_session'
const sessionLifetimeMs = 1000 * 60 * 60 * 24 * 7

// Fail at startup instead of producing an opaque RLS error during registration.
const { error: serviceRoleValidationError } = await db.auth.admin.listUsers({ page: 1, perPage: 1 })
if (serviceRoleValidationError) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is invalid or is an anon key. Copy the service_role key from Supabase Project Settings → API into .env.server.')
}

function json(response, status, body, headers = {}) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...headers })
  response.end(JSON.stringify(body))
}

function passwordHash(password, salt = randomBytes(16).toString('hex')) {
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
}

function passwordMatches(password, stored) {
  const [salt, digest] = stored.split(':')
  if (!salt || !digest) return false
  const candidate = scryptSync(password, salt, 64)
  const expected = Buffer.from(digest, 'hex')
  return candidate.length === expected.length && timingSafeEqual(candidate, expected)
}

function sessionDigest(token) {
  return createHash('sha256').update(token).digest('hex')
}

async function sendResetLink(email, resetUrl) {
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
    const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [email], subject: 'Reset your IJESHA DIGITAL HUB password', html: `<p>Use this link to set a new password. It expires in one hour.</p><p><a href="${resetUrl}">Reset password</a></p>` }) })
    if (!response.ok) throw new Error('Password reset email could not be sent.')
    return null
  }
  if (process.env.NODE_ENV !== 'production') return resetUrl
  throw new Error('Password reset email is not configured.')
}

function parseCookies(request) {
  return Object.fromEntries((request.headers.cookie ?? '').split(';').flatMap((part) => {
    const index = part.indexOf('=')
    return index === -1 ? [] : [[part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())]]
  }))
}

function publicUser(account) {
  return {
    id: account.id,
    email: account.email,
    full_name: account.full_name,
    role: account.role,
    organization: account.organization,
    student_id: account.student_id,
    track: account.track,
    approval_status: account.approval_status,
    created_at: account.created_at,
  }
}

async function approveStudentAccount(account) {
  if (account.role !== 'student') return account
  let studentId = account.student_id
  if (!studentId) {
    const { data: existing } = await db.from('students').select('id').ilike('email', account.email).maybeSingle()
    if (existing) {
      studentId = existing.id
      await db.from('students').update({ status: 'active' }).eq('id', studentId)
    } else {
      const { data: created, error } = await db.from('students').insert({
        full_name: account.full_name,
        email: account.email,
        track: account.track || null,
        status: 'active',
      }).select('id').single()
      if (error) throw error
      studentId = created.id
    }
  }
  const { data: updated, error } = await db.from('app_auth_users').update({ approval_status: 'approved', student_id: studentId }).eq('id', account.id).select('*').single()
  if (error) throw error
  return updated
}

async function body(request) {
  let raw = ''
  for await (const chunk of request) {
    raw += chunk
    if (Buffer.byteLength(raw) > 2_000_000) throw new Error('Request is too large. Use files under 1 MB.')
  }
  try { return JSON.parse(raw || '{}') } catch { throw new Error('Request body must be valid JSON.') }
}

async function currentUser(request) {
  const token = parseCookies(request)[cookieName]
  if (!token) return null
  const { data: session, error: sessionError } = await db.from('app_auth_sessions').select('user_id, expires_at').eq('token_hash', sessionDigest(token)).maybeSingle()
  if (sessionError) throw new Error('Unable to verify your session right now. Please try again.')
  if (!session || new Date(session.expires_at).getTime() <= Date.now()) return null
  const { data: account, error: accountError } = await db.from('app_auth_users').select('*').eq('id', session.user_id).maybeSingle()
  if (accountError) throw new Error('Unable to verify your account right now. Please try again.')
  return account?.approval_status === 'approved' ? account : null
}

async function canTeachCohort(account, cohortId) {
  if(['admin','manager'].includes(account.role)) return true
  if(account.role !== 'trainer') return false
  const c=await db.from('cohorts').select('app_course_id').eq('id',cohortId).maybeSingle()
  if(c.error) throw c.error
  if(!c.data?.app_course_id) return false
  const course=await db.from('app_courses').select('trainer_id').eq('id',c.data.app_course_id).single()
  if(course.error) throw course.error
  return course.data.trainer_id === account.id
}
function setSessionCookie(response, token) {
  const crossSite = process.env.NODE_ENV === 'production' ? '; SameSite=None; Secure' : '; SameSite=Strict'
  return `${cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly${crossSite}; Max-Age=${sessionLifetimeMs / 1000}`
}

async function studentLearningContext(account) {
  const { data: byProfile, error: studentError } = await db.from('students').select('*').eq(account.student_id ? 'id' : 'profile_id', account.student_id || account.id).maybeSingle()
  if(studentError) throw studentError
  const { data: byEmail } = byProfile
    ? { data: null }
    : await db.from('students').select('*').ilike('email', account.email).maybeSingle()
  const student = byProfile ?? byEmail
  if (!student) return { student: null, cohort: null, sessions: [], attendance: [], classmates: [] }
  let enrollmentQuery = db.from('enrollments').select('cohort_id,created_at,completion_status').eq('student_id', student.id)
  if(!account.active_cohort_id) enrollmentQuery = enrollmentQuery.eq('completion_status','in_progress')
  if(account.active_cohort_id) enrollmentQuery = enrollmentQuery.eq('cohort_id',account.active_cohort_id)
  const { data: enrollment, error: enrollmentError } = await enrollmentQuery.order('created_at', { ascending: false }).limit(1).maybeSingle()
  if(enrollmentError) throw enrollmentError
  const { data: cohort, error: cohortError } = enrollment?.cohort_id
    ? await db.from('cohorts').select('id, name, course_id, app_course_id, starts_on, ends_on, created_at, courses(name), app_courses!cohorts_app_course_id_fkey(title)').eq('id', enrollment.cohort_id).maybeSingle()
    : student.cohort
      ? await db.from('cohorts').select('id, name, course_id, app_course_id, starts_on, ends_on, created_at, courses(name), app_courses!cohorts_app_course_id_fkey(title)').ilike('name', student.cohort).maybeSingle()
      : { data: null }
  if (cohortError) throw cohortError
  if (!cohort) return { student, cohort: null, sessions: [], attendance: [], classmates: [] }
  const [sessionsRes, attendanceRes, classmatesRes] = await Promise.all([
    db.from('training_sessions').select('*').eq('cohort_id', cohort.id).order('starts_at'),
    db.from('attendance').select('*').eq('cohort_id', cohort.id).eq('student_id', student.id),
    db.from('enrollments').select('students(id,full_name,track,status)').eq('cohort_id', cohort.id),
  ])
  for (const result of [sessionsRes, attendanceRes, classmatesRes]) if (result.error) throw result.error
  return {
    student,
    enrollment,
    cohort: { ...cohort, course_name: cohort.app_courses?.title ?? cohort.courses?.name ?? '' },
    sessions: sessionsRes.data ?? [],
    attendance: attendanceRes.data ?? [],
    classmates: (classmatesRes.data ?? []).map(row=>row.students).filter(Boolean),
  }
}

createServer(async (request, response) => {
  const origin = request.headers.origin
  const cors = origin === process.env.APP_ORIGIN ? { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', vary: 'Origin' } : {}
  if (request.method === 'OPTIONS') return json(response, 204, {}, { ...cors, 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'access-control-allow-headers': 'content-type' })
  try {
    if (request.method === 'GET' && request.url === '/api/health') return json(response,200,{status:'ok',version:process.env.RENDER_GIT_COMMIT ?? 'local'},cors)
    if (['/api/profile','/api/certificates'].includes(request.url)) {
      await profileCertificates({request,response,account:await currentUser(request),db,body,json,cors,studentLearningContext,publicUser})
      return
    }
    if (request.method === 'GET' && request.url === '/api/student/summary') {
      const account = await currentUser(request)
      if(!account || account.role !== 'student') return json(response,403,{error:'Student access is required.'},cors)
      const context = await studentLearningContext(account)
      const work = context.cohort ? await db.from('app_learning_items').select('*').eq('cohort_id',context.cohort.id).eq('status','published') : {data:[],error:null}
      if(work.error) throw work.error
      const submissions = context.student && work.data.length ? await db.from('app_learning_submissions').select('*').eq('student_id',context.student.id).in('item_id',work.data.map(i=>i.id)) : {data:[],error:null}
      if(submissions.error) throw submissions.error
      const courses = context.cohort?.app_course_id ? await db.from('app_courses').select('id,title,description,status').eq('id',context.cohort.app_course_id).eq('status','Published') : {data:[],error:null}
      if(courses.error) throw courses.error
      return json(response,200,{cohort:context.cohort,attendance:context.attendance,courses:courses.data,items:work.data,submissions:submissions.data},cors)
    }
    if (request.method === 'GET' && request.url === '/api/auth/me') {
      const account = await currentUser(request)
      return account ? json(response, 200, { user: publicUser(account) }, cors) : json(response, 401, { error: 'Not signed in.' }, cors)
    }

    if (request.method === 'GET' && (request.url === '/api/student/cohort' || request.url === '/api/student/attendance')) {
      const account = await currentUser(request)
      if (!account || account.role !== 'student') return json(response, 403, { error: 'Student access is required.' }, cors)
      return json(response, 200, await studentLearningContext(account), cors)
    }

    if (request.method === 'POST' && request.url === '/api/auth/signup') {
      const input = await body(request)
      const email = String(input.email ?? '').trim().toLowerCase()
      const fullName = String(input.fullName ?? '').trim()
      const password = String(input.password ?? '')
      const track = null
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid email address.')
      if (!fullName) throw new Error('Enter your full name.')
      if (password.length < 8) throw new Error('Password must be at least 8 characters.')
      const { data: existing, error: lookupError } = await db.from('app_auth_users').select('id').eq('email', email).maybeSingle()
      if (lookupError) throw lookupError
      if (existing) return json(response, 409, { error: 'An account already exists for this email.' }, cors)
      // Public registration must never grant privileged roles or bypass approval.
      const role = 'student'
      const approvalStatus = 'pending'
      const { data: account, error } = await db.from('app_auth_users').insert({ email, full_name: fullName, password_hash: passwordHash(password), role, track, approval_status: approvalStatus, organization: 'Ijesha Digital Hub' }).select('*').single()
      if (error) throw error
      return json(response, 201, { user: publicUser(account), message: 'Registration received. An administrator will review your account in the app.' }, cors)
    }

    if (request.method === 'POST' && request.url === '/api/auth/signin') {
      const input = await body(request)
      const email = String(input.email ?? '').trim().toLowerCase()
      const password = String(input.password ?? '')
      const { data: account } = await db.from('app_auth_users').select('*').eq('email', email).maybeSingle()
      if (!account) {
        const message = 'Invalid email or password.'
        return json(response, 401, { error: message }, cors)
      }
      if (!passwordMatches(password, account.password_hash)) return json(response, 401, { error: 'Invalid email or password.' }, cors)
      if (account.approval_status === 'pending') return json(response, 403, { error: 'Your registration is awaiting in-app administrator approval.' }, cors)
      if (account.approval_status === 'rejected') return json(response, 403, { error: 'This account has not been approved.' }, cors)
      if (account.approval_status !== 'approved') return json(response, 403, { error: 'Administrator approval is required before signing in.' }, cors)
      const token = randomBytes(32).toString('base64url')
      const expiresAt = new Date(Date.now() + sessionLifetimeMs).toISOString()
      const { error } = await db.from('app_auth_sessions').insert({ user_id: account.id, token_hash: sessionDigest(token), expires_at: expiresAt })
      if (error) throw error
      return json(response, 200, { user: publicUser(account) }, { ...cors, 'set-cookie': setSessionCookie(response, token) })
    }

    if (request.method === 'POST' && request.url === '/api/auth/signout') {
      const token = parseCookies(request)[cookieName]
      if (token) await db.from('app_auth_sessions').delete().eq('token_hash', sessionDigest(token))
      const crossSite = process.env.NODE_ENV === 'production' ? '; SameSite=None; Secure' : '; SameSite=Strict'
      return json(response, 204, {}, { ...cors, 'set-cookie': `${cookieName}=; Path=/; HttpOnly${crossSite}; Max-Age=0` })
    }

    if (request.method === 'POST' && request.url === '/api/auth/forgot-password') {
      const input = await body(request)
      const email = String(input.email ?? '').trim().toLowerCase()
      const { data: account } = await db.from('app_auth_users').select('id, email').eq('email', email).maybeSingle()
      const result = { message: 'If an account exists for that email, a reset link has been sent.' }
      if (!account) return json(response, 200, result, cors)
      const token = randomBytes(32).toString('base64url')
      await db.from('app_password_reset_tokens').delete().eq('user_id', account.id).is('used_at', null)
      const { error } = await db.from('app_password_reset_tokens').insert({ user_id: account.id, token_hash: sessionDigest(token), expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() })
      if (error) throw error
      const developmentResetUrl = await sendResetLink(account.email, `${publicUrl}/reset-password?token=${encodeURIComponent(token)}`)
      return json(response, 200, developmentResetUrl ? { ...result, developmentResetUrl } : result, cors)
    }

    if (request.method === 'POST' && request.url === '/api/auth/reset-password') {
      const input = await body(request)
      const token = String(input.token ?? '')
      const password = String(input.password ?? '')
      if (!token || password.length < 8) throw new Error('Use a valid reset link and a password of at least 8 characters.')
      const { data: reset } = await db.from('app_password_reset_tokens').select('*').eq('token_hash', sessionDigest(token)).is('used_at', null).gt('expires_at', new Date().toISOString()).maybeSingle()
      if (!reset) return json(response, 400, { error: 'This reset link is invalid or has expired.' }, cors)
      const { error } = await db.from('app_auth_users').update({ password_hash: passwordHash(password) }).eq('id', reset.user_id)
      if (error) throw error
      await db.from('app_password_reset_tokens').update({ used_at: new Date().toISOString() }).eq('id', reset.id)
      await db.from('app_auth_sessions').delete().eq('user_id', reset.user_id)
      return json(response, 200, { message: 'Password reset. You can now sign in.' }, cors)
    }

    if (request.method === 'PATCH' && request.url === '/api/auth/password') {
      const account = await currentUser(request)
      if (!account) return json(response, 401, { error: 'Not signed in.' }, cors)
      const input = await body(request)
      const password = String(input.password ?? '')
      if (password.length < 8) throw new Error('Password must be at least 8 characters.')
      const { error } = await db.from('app_auth_users').update({ password_hash: passwordHash(password) }).eq('id', account.id)
      if (error) throw error
      return json(response, 200, { message: 'Password updated.' }, cors)
    }

    if (request.method === 'PATCH' && request.url === '/api/auth/email') {
      const account = await currentUser(request)
      if (!account) return json(response, 401, { error: 'Not signed in.' }, cors)
      const input = await body(request)
      const email = String(input.email ?? '').trim().toLowerCase()
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid email address.')
      const { data: existing } = await db.from('app_auth_users').select('id').eq('email', email).neq('id', account.id).maybeSingle()
      if (existing) return json(response, 409, { error: 'An account already exists for this email.' }, cors)
      const { data, error } = await db.from('app_auth_users').update({ email }).eq('id', account.id).select('*').single()
      if (error) throw error
      if (data.student_id) await db.from('students').update({ email }).eq('id', data.student_id)
      return json(response, 200, { user: publicUser(data) }, cors)
    }

    if (request.method === 'PATCH' && request.url === '/api/auth/profile') {
      const account = await currentUser(request)
      if (!account) return json(response, 401, { error: 'Not signed in.' }, cors)
      const input = await body(request)
      const fullName = String(input.fullName ?? '').trim()
      if (!fullName) throw new Error('Enter your full name.')
      const { data, error } = await db.from('app_auth_users').update({ full_name: fullName }).eq('id', account.id).select('*').single()
      if (error) throw error
      if (data.student_id) await db.from('students').update({ full_name: fullName }).eq('id', data.student_id)
      return json(response, 200, { user: publicUser(data) }, cors)
    }

    if (request.method === 'GET' && request.url === '/api/admin/accounts') {
      const account = await currentUser(request)
      if (!account || !['admin', 'manager'].includes(account.role)) return json(response, 403, { error: 'Administrator access is required.' }, cors)
      const { data, error } = await db.from('app_auth_users').select('id, email, full_name, role, organization, track, approval_status, created_at').order('created_at', { ascending: false })
      if (error) throw error
      return json(response, 200, { users: data }, cors)
    }

    if(request.url === '/api/students' && ['GET','POST'].includes(request.method)) {
      const actor = await currentUser(request)
      if(!actor || !['admin','manager','trainer'].includes(actor.role)) return json(response,403,{error:'Staff access is required.'},cors)
      if(request.method === 'POST') {
        if(actor.role === 'trainer') return json(response,403,{error:'Administrator or manager access is required.'},cors)
        const input = await body(request)
        if(!['firstName','lastName','email','phone','dateOfBirth','gender','courseId','cohortId','enrollmentDate'].every(key=>String(input[key]??'').trim())) throw new Error('Complete all required student fields.')
        if(input.pastStudent && actor.role !== 'admin') return json(response,403,{error:'Only administrators can record past students.'},cors)
        if(input.pastStudent !== undefined && typeof input.pastStudent !== 'boolean') throw new Error('Invalid enrollment type.')
        if(!/^\S+@\S+\.\S+$/.test(input.email) || String(input.password??'').length<8) throw new Error('Enter a valid email and password of at least eight characters.')
        const {password,confirmPassword,...details}=input
        const result = await db.rpc(input.pastStudent ? 'create_past_app_student' : 'create_app_student',{input:details,password_digest:passwordHash(password)})
        if(result.error) throw result.error
        return json(response,201,{studentId:result.data},cors)
      }
      let query=db.from('students').select('*').order('created_at',{ascending:false})
      if(actor.role === 'trainer') {
        const courses=await db.from('app_courses').select('id').eq('trainer_id',actor.id)
        if(courses.error) throw courses.error
        const cohorts=await db.from('cohorts').select('id').in('app_course_id',courses.data.map(c=>c.id))
        if(cohorts.error) throw cohorts.error
        const enrollments=await db.from('enrollments').select('student_id').in('cohort_id',cohorts.data.map(c=>c.id)).eq('completion_status','in_progress')
        if(enrollments.error) throw enrollments.error
        if(!enrollments.data.length) return json(response,200,{students:[]},cors)
        query=query.in('id',enrollments.data.map(e=>e.student_id))
      }
      const result=await query
      if(result.error) throw result.error
      const accounts = await db.from('app_auth_users').select('id,student_id,email,role')
      if (accounts.error) throw accounts.error
      return json(response,200,{students:studentRoleRoster(result.data ?? [], accounts.data ?? [])},cors)
    }
    const studentDetailMatch = request.url?.match(/^\/api\/students\/([0-9a-f-]{36})$/i)
    if (studentDetailMatch && request.method === 'GET') {
      const actor = await currentUser(request)
      if (!actor || !['admin', 'manager', 'trainer'].includes(actor.role)) return json(response, 403, { error: 'Staff access is required.' }, cors)
      const id = studentDetailMatch[1]
      let result = await db.from('students').select('*').eq('id', id).maybeSingle()
      if (result.error) throw result.error
      if (!result.data) {
        const account = await db.from('app_auth_users').select('student_id').eq('id', id).maybeSingle()
        if (account.error) throw account.error
        result = account.data?.student_id
          ? await db.from('students').select('*').eq('id', account.data.student_id).maybeSingle()
          : await db.from('students').select('*').eq('profile_id', id).maybeSingle()
        if (result.error) throw result.error
      }
      if (!result.data) return json(response, 404, { error: 'No linked student record was found. An administrator must create or link this account to a student record.' }, cors)
      const student = result.data
      if (actor.role === 'trainer') {
        const enrollments = await db.from('enrollments').select('cohort_id').eq('student_id', student.id)
        if (enrollments.error) throw enrollments.error
        let allowed = false
        for (const enrollment of enrollments.data) {
          if (await canTeachCohort(actor, enrollment.cohort_id)) { allowed = true; break }
        }
        if (!allowed) return json(response, 403, { error: 'This student is not assigned to your course.' }, cors)
      }
      let details = null
      let photo = null
      if (actor.role !== 'trainer') {
        const personal = await db.from('student_profile_details').select('*').eq('student_id', student.id).maybeSingle()
        if (personal.error) throw personal.error
        details = personal.data
        const account = await db.from('app_auth_users').select('id').eq('student_id', student.id).maybeSingle()
        if (account.error) throw account.error
        if (account.data) {
          const extra = await db.from('app_profile_details').select('details').eq('user_id', account.data.id).maybeSingle()
          if (extra.error) throw extra.error
          photo = extra.data?.details?.photo ?? null
        }
        if (!photo && details?.photo_path) {
          const signed = await db.storage.from('student-photos').createSignedUrl(details.photo_path, 3600)
          if (!signed.error) photo = signed.data.signedUrl
        }
      }
      return json(response, 200, { student, details, photo }, cors)
    }
    const assignCohortMatch = request.url?.match(/^\/api\/admin\/accounts\/([0-9a-f-]{36})\/cohort$/i)
    if(assignCohortMatch && request.method === 'PATCH') {
      const actor = await currentUser(request)
      if(!actor || !['admin','manager'].includes(actor.role)) return json(response,403,{error:'Administrator or manager access is required.'},cors)
      const input = await body(request)
      if(!input.cohortId) throw new Error('Choose a cohort.')
      if(input.pastStudent && actor.role !== 'admin') return json(response,403,{error:'Only administrators can record past students.'},cors)
      if(input.pastStudent !== undefined && typeof input.pastStudent !== 'boolean') throw new Error('Invalid enrollment type.')
      const result = input.pastStudent
        ? await db.rpc('record_past_student_cohort',{account_id:assignCohortMatch[1],target_cohort_id:input.cohortId,enrolled_on:input.enrollmentDate || null})
        : await db.rpc('assign_app_student_cohort',{account_id:assignCohortMatch[1],target_cohort_id:input.cohortId})
      if(result.error) throw result.error
      return json(response,200,{message:'Student assigned to cohort successfully.'},cors)
    }
    const cohortStudentsMatch = request.url?.match(/^\/api\/cohorts\/([0-9a-f-]{36})\/students$/i)
    if (cohortStudentsMatch && request.method === 'GET') {
      const actor=await currentUser(request)
      if(!actor || !await canTeachCohort(actor,cohortStudentsMatch[1])) return json(response,403,{error:'This cohort is not assigned to you.'},cors)
      const cid=cohortStudentsMatch[1]
      const [enrollments,attendance,items]=await Promise.all([
        db.from('enrollments').select('id,student_id,completion_status,students(id,full_name,status,track)').eq('cohort_id',cid),
        db.from('attendance').select('student_id,status').eq('cohort_id',cid),
        db.from('app_learning_items').select('id').eq('cohort_id',cid).eq('status','published'),
      ])
      for(const result of [enrollments,attendance,items]) if(result.error) throw result.error
      const submissions=items.data.length?await db.from('app_learning_submissions').select('student_id').in('item_id',items.data.map(i=>i.id)).not('submitted_at','is',null):{data:[],error:null}
      if(submissions.error) throw submissions.error
      const progress=enrollments.data.map(e=>({student_id:e.student_id,progress_percent:items.data.length?Math.round(100*submissions.data.filter(s=>s.student_id===e.student_id).length/items.data.length):0}))
      return json(response,200,{enrollments:enrollments.data,attendance:attendance.data,progress},cors)
    }
    const attendanceMatch = request.url?.match(/^\/api\/attendance\/(cohorts|sessions)\/([0-9a-f-]{36})$/i)
    if(attendanceMatch && ['GET','PATCH'].includes(request.method)) {
      const account = await currentUser(request)
      if(!account || !['admin','manager','trainer'].includes(account.role)) return json(response,403,{error:'Staff access is required.'},cors)
      let session = null
      let cohortId = attendanceMatch[2]
      if(attendanceMatch[1] === 'sessions') {
        const result = await db.from('training_sessions').select('*').eq('id',attendanceMatch[2]).single()
        if(result.error) throw result.error
        session = result.data
        cohortId = session.cohort_id
      }
      const cohortResult = await db.from('cohorts').select('app_course_id').eq('id',cohortId).single()
      if(cohortResult.error) throw cohortResult.error
      if(account.role === 'trainer') {
        const courseResult = await db.from('app_courses').select('trainer_id').eq('id',cohortResult.data.app_course_id).maybeSingle()
        if(courseResult.error) throw courseResult.error
        if(courseResult.data?.trainer_id !== account.id || (session && session.app_trainer_id !== account.id)) return json(response,403,{error:'This cohort or session is not assigned to you.'},cors)
      }
      const enrollmentResult = await db.from('enrollments').select('id,student_id,students(*)').eq('cohort_id',cohortId)
      if(enrollmentResult.error) throw enrollmentResult.error
      if(request.method === 'PATCH') {
        if(!session) throw new Error('Select a session before recording attendance.')
        if(session.status === 'cancelled') throw new Error('Attendance cannot be recorded for a cancelled session.')
        const input = await body(request)
        if(!Array.isArray(input.records) || !input.records.length) throw new Error('No enrolled students to record.')
        const seen = new Set()
        const records = input.records.map(record=>{
          const enrollment = enrollmentResult.data.find(e=>e.student_id===record.student_id)
          if(!enrollment || seen.has(record.student_id) || !['present','absent','late','excused'].includes(record.status)) throw new Error('Attendance must contain valid statuses for enrolled students only.')
          seen.add(record.student_id)
          return {student_id:record.student_id,enrollment_id:enrollment.id,cohort_id:cohortId,training_session_id:session.id,attended_on:session.starts_at.slice(0,10),status:record.status,app_recorded_by:account.id}
        })
        const result = await db.from('attendance').upsert(records,{onConflict:'student_id,training_session_id'}).select('*')
        if(result.error) throw result.error
        return json(response,200,{attendance:result.data},cors)
      }
      let sessionQuery = db.from('training_sessions').select('*').eq('cohort_id',cohortId).order('starts_at')
      if(account.role === 'trainer') sessionQuery = sessionQuery.eq('app_trainer_id',account.id)
      const sessions = await sessionQuery
      if(sessions.error) throw sessions.error
      const attendance = sessions.data.length ? await db.from('attendance').select('*').in('training_session_id',sessions.data.map(s=>s.id)) : {data:[],error:null}
      if(attendance.error) throw attendance.error
      return json(response,200,{students:enrollmentResult.data.flatMap(e=>e.students?[e.students]:[]),sessions:sessions.data,attendance:attendance.data},cors)
    }
    if (request.url === '/api/session-trainers' && request.method === 'GET') {
      const account = await currentUser(request)
      if (!account || !['admin','manager','trainer'].includes(account.role)) return json(response,403,{error:'Staff access is required.'},cors)
      let query = db.from('app_auth_users').select('id,full_name').eq('role','trainer').order('full_name')
      if (account.role === 'trainer') query = query.eq('id',account.id)
      const {data,error} = await query
      if (error) throw error
      return json(response,200,{trainers:data},cors)
    }
    const relatedMatch = request.url?.match(/^\/api\/sessions\/([0-9a-f-]{36})\/related$/i)
    if(relatedMatch && ['GET','POST'].includes(request.method)) {
      const account = await currentUser(request)
      if(!account || !['admin','manager','trainer'].includes(account.role)) return json(response,403,{error:'Staff access is required.'},cors)
      const sessionResult = await db.from('training_sessions').select('*').eq('id',relatedMatch[1]).single()
      if(sessionResult.error) throw sessionResult.error
      const session = sessionResult.data
      if(account.role === 'trainer' && session.app_trainer_id !== account.id) return json(response,403,{error:'This session is not assigned to you.'},cors)
      if(request.method === 'POST') {
        const input = await body(request)
        if(!['note','material','classwork','assignment'].includes(input.kind) || !String(input.title??'').trim()) throw new Error('A valid type and title are required.')
        const result = ['note','material'].includes(input.kind)
          ? await db.from('app_session_resources').insert({session_id:session.id,kind:input.kind,title:String(input.title).trim(),content:String(input.content??''),created_by:account.id})
          : await db.from('app_learning_items').insert({session_id:session.id,cohort_id:session.cohort_id,item_type:input.kind,title:String(input.title).trim(),instructions:String(input.content??''),status:'published',created_by:account.id})
        if(result.error) throw result.error
        return json(response,201,{success:true},cors)
      }
      const [resources,work,attendance] = await Promise.all([
        db.from('app_session_resources').select('*').eq('session_id',session.id).order('created_at'),
        db.from('app_learning_items').select('*').eq('session_id',session.id).order('created_at'),
        db.from('attendance').select('*,students(full_name)').eq('training_session_id',session.id),
      ])
      if(resources.error || work.error || attendance.error) throw resources.error || work.error || attendance.error
      return json(response,200,{resources:resources.data,work:work.data,attendance:attendance.data},cors)
    }
    const sessionMatch = request.url?.match(/^\/api\/sessions\/([0-9a-f-]{36})$/i)
    if ((request.url === '/api/sessions' && ['GET','POST'].includes(request.method)) || (sessionMatch && ['GET','PATCH'].includes(request.method))) {
      const account = await currentUser(request)
      if (!account || !['admin','manager','trainer'].includes(account.role)) return json(response,403,{error:'Staff access is required.'},cors)
      let existing = null
      if (sessionMatch) {
        const result = await db.from('training_sessions').select('*').eq('id',sessionMatch[1]).maybeSingle()
        if(result.error) throw result.error
        existing = result.data
        if(!existing) return json(response,404,{error:'Session not found.'},cors)
        if(account.role === 'trainer' && existing.app_trainer_id !== account.id) return json(response,403,{error:'This session is not assigned to you.'},cors)
        if(request.method === 'GET') return json(response,200,{session:existing},cors)
      }
      if (request.method === 'GET') {
        let query = db.from('training_sessions').select('*').order('created_at',{ascending:false})
        if(account.role === 'trainer') query = query.eq('app_trainer_id',account.id)
        const {data,error} = await query
        if(error) throw error
        return json(response,200,{sessions:data},cors)
      }
      const input = await body(request)
      if(existing && Object.keys(input).length === 1 && input.status === 'cancelled') {
        const result = await db.from('training_sessions').update({status:'cancelled'}).eq('id',existing.id).select('*').single()
        if(result.error) throw result.error
        return json(response,200,{session:result.data},cors)
      }
      const sessionValues = validateSession(input)
      if(!String(input.topic??'').trim() || !input.cohort_id || !Number.isFinite(Date.parse(input.starts_at))) throw new Error('Choose a cohort, topic and valid start time.')
      const cohort = await db.from('cohorts').select('app_course_id,starts_on,ends_on').eq('id',input.cohort_id).single()
      if(cohort.error) throw cohort.error
      const date = String(input.schedule_date ?? '')
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))) throw new Error('Choose a valid session date.')
      if(cohort.data.starts_on) {
        const day = (Date.parse(date) - Date.parse(cohort.data.starts_on)) / 86400000
        if(day < 0 || Math.floor(day / 7) + 1 !== sessionValues.week_number) throw new Error('Session date must fall within the selected cohort week.')
      }
      if(cohort.data.ends_on && date > cohort.data.ends_on) throw new Error('Session date is after the cohort end date.')
      if(!cohort.data.app_course_id) throw new Error('Link this cohort to an application course first.')
      const assignedCourse = await db.from('app_courses').select('trainer_id').eq('id',cohort.data.app_course_id).single()
      if(assignedCourse.error) throw assignedCourse.error
      if(assignedCourse.data.trainer_id !== input.trainer_id) throw new Error('Choose the trainer assigned to this course.')
      if(account.role === 'trainer') {
        const course = await db.from('app_courses').select('trainer_id').eq('id',cohort.data.app_course_id).single()
        if(course.error) throw course.error
        if(course.data.trainer_id !== account.id || (input.trainer_id && input.trainer_id !== account.id)) return json(response,403,{error:'You can schedule sessions only for your assigned course.'},cors)
      }
      const trainerId = account.role === 'trainer' ? account.id : input.trainer_id || null
      if(trainerId) {
        const trainer = await db.from('app_auth_users').select('id').eq('id',trainerId).eq('role','trainer').single()
        if(trainer.error) throw new Error('Choose a current trainer account.')
      }
      const mutation = existing
        ? db.from('training_sessions').update(sessionValues).eq('id',existing.id)
        : db.from('training_sessions').insert(sessionValues)
      const {data,error} = await mutation.select('*').single()
      if(error) throw error
      return json(response,201,{session:data},cors)
    }
    if (request.method === 'GET' && request.url === '/api/cohorts') {
      const account = await currentUser(request)
      if (!account || !['admin', 'manager', 'trainer'].includes(account.role)) return json(response, 403, { error: 'Staff access is required.' }, cors)
      let query = db.from('cohorts').select('*, app_courses!cohorts_app_course_id_fkey(title), courses(name)').order('name')
      if (account.role === 'trainer') {
        const assigned = await db.from('app_courses').select('id').eq('trainer_id', account.id)
        if (assigned.error) throw assigned.error
        if (!assigned.data.length) return json(response, 200, { cohorts: [], enrollments: [] }, cors)
        query = query.in('app_course_id', assigned.data.map(c => c.id))
      }
      const { data, error } = await query
      if (error) throw error
      const cohorts = data.map(c => ({ ...c, course_id: c.app_course_id || c.course_id, course_name: c.app_courses?.title || c.courses?.name || '' }))
      const enrollmentResult = cohorts.length
        ? await db.from('enrollments').select('cohort_id, completion_status').in('cohort_id', cohorts.map(c => c.id))
        : { data: [], error: null }
      if (enrollmentResult.error) throw enrollmentResult.error
      return json(response, 200, { cohorts, enrollments: enrollmentResult.data }, cors)
    }
    if (request.method === 'POST' && request.url === '/api/cohorts') {
      const account = await currentUser(request)
      if (!account || !['admin', 'manager'].includes(account.role)) return json(response, 403, { error: 'Administrator or manager access is required.' }, cors)
      const input = await body(request)
      const name = String(input.name ?? '').trim()
      if (!name || !input.app_course_id) throw new Error('A cohort name and course are required.')
      const course = await db.from('app_courses').select('id, title').eq('id', input.app_course_id).single()
      if (course.error) throw course.error
      const start = input.starts_on || null
      const end = input.ends_on || null
      if ((start && !Number.isFinite(Date.parse(start))) || (end && !Number.isFinite(Date.parse(end))) || (start && end && start > end)) throw new Error('Choose valid dates with the end on or after the start.')
      const { data, error } = await db.from('cohorts').insert({ name, app_course_id: course.data.id, starts_on: start, ends_on: end }).select('*').single()
      if (error) throw error
      return json(response, 201, { cohort: { ...data, course_id: course.data.id, course_name: course.data.title } }, cors)
    }
    const cohortDeleteMatch = request.url?.match(/^\/api\/cohorts\/([0-9a-f-]{36})$/i)
    if (request.method === 'DELETE' && cohortDeleteMatch) {
      const account = await currentUser(request)
      if (!account || !['admin', 'manager'].includes(account.role)) return json(response, 403, { error: 'Administrator or manager access is required.' }, cors)
      const { error } = await db.from('cohorts').delete().eq('id', cohortDeleteMatch[1])
      if (error?.code === '23503') {
        return json(response, 409, { error: 'This cohort still has linked enrollment or learning records, so it cannot be deleted. No records were removed. Keep the cohort to preserve student history, or ask an administrator to review its linked records before permanent removal.' }, cors)
      }
      if (error) throw error
      return json(response, 200, { success: true }, cors)
    }

    if (request.method === 'GET' && request.url === '/api/courses') {
      const account = await currentUser(request)
      if (!account || !['admin', 'manager', 'trainer'].includes(account.role)) return json(response, 403, { error: 'Staff access is required.' }, cors)
      let query = db.from('app_courses').select('*').order('updated_at', { ascending: false })
      if (account.role === 'trainer') query = query.eq('trainer_id', account.id)
      const { data, error } = await query
      if (error) throw error
      return json(response, 200, { courses: data ?? [] }, cors)
    }

    if (request.method === 'POST' && request.url === '/api/courses') {
      const account = await currentUser(request)
      if (!account || !['admin', 'manager'].includes(account.role)) return json(response, 403, { error: 'Administrator access is required.' }, cors)
      const input = await body(request)
      const title = String(input.title ?? '').trim()
      if (!title) throw new Error('Enter a course title.')
      const { data, error } = await db.from('app_courses').insert({
        title, description: String(input.description ?? ''), category: String(input.category ?? '').trim() || null, thumbnail: input.thumbnail || null, level: input.level || null,
        status: input.status === 'Published' ? 'Published' : 'Draft', content: Array.isArray(input.modules) ? input.modules : [],
        cohort_id: input.cohortId || null, trainer_id: input.trainerId || null, start_date: input.startDate || null,
        end_date: input.endDate || null, created_by: account.id,
      }).select('*').single()
      if (error) throw error
      return json(response, 201, { course: data }, cors)
    }

    const courseMatch = request.url?.match(/^\/api\/courses\/([0-9a-f-]{36})$/i)
    if (request.method === 'PATCH' && courseMatch) {
      const account = await currentUser(request)
      if (!account || !['admin', 'manager', 'trainer'].includes(account.role)) return json(response, 403, { error: 'Staff access is required.' }, cors)
      const { data: existing, error: existingError } = await db.from('app_courses').select('*').eq('id', courseMatch[1]).single()
      if (existingError) throw existingError
      if (account.role === 'trainer' && existing.trainer_id !== account.id) return json(response, 403, { error: 'This course is not assigned to you.' }, cors)
      const input = await body(request)
      const patch = account.role === 'trainer'
        ? { content: Array.isArray(input.modules) ? input.modules : existing.content, updated_at: new Date().toISOString() }
        : {
            title: String(input.title ?? existing.title).trim(), description: String(input.description ?? existing.description),
            thumbnail: input.thumbnail === undefined ? existing.thumbnail : input.thumbnail || null, level: input.level === undefined ? existing.level : input.level || null, category: String(input.category ?? existing.category ?? '').trim() || null, status: input.status === undefined ? existing.status : input.status === 'Published' ? 'Published' : 'Draft',
            content: Array.isArray(input.modules) ? input.modules : existing.content, cohort_id: input.cohortId === undefined ? existing.cohort_id : input.cohortId || null,
            trainer_id: input.trainerId === undefined ? existing.trainer_id : input.trainerId || null, start_date: input.startDate === undefined ? existing.start_date : input.startDate || null, end_date: input.endDate === undefined ? existing.end_date : input.endDate || null, updated_at: new Date().toISOString(),
          }
      if (!patch.title && account.role !== 'trainer') throw new Error('Enter a course title.')
      const { data, error } = await db.from('app_courses').update(patch).eq('id', existing.id).select('*').single()
      if (error) throw error
      return json(response, 200, { course: data }, cors)
    }

    if (request.method === 'DELETE' && courseMatch) {
      const account = await currentUser(request)
      if (!account || !['admin', 'manager'].includes(account.role)) return json(response, 403, { error: 'Administrator access is required.' }, cors)
      const { error } = await db.from('app_courses').delete().eq('id', courseMatch[1])
      if (error) throw error
      return json(response, 204, {}, cors)
    }

    const courseStudentsMatch = request.url?.match(/^\/api\/courses\/([0-9a-f-]{36})\/students$/i)
    if (request.method === 'GET' && courseStudentsMatch) {
      const account = await currentUser(request)
      if (!account || !['admin', 'manager', 'trainer'].includes(account.role)) return json(response, 403, { error: 'Staff access is required.' }, cors)
      const { data: course, error: courseError } = await db.from('app_courses').select('cohort_id, trainer_id').eq('id', courseStudentsMatch[1]).single()
      if (courseError) throw courseError
      if (account.role === 'trainer' && course.trainer_id !== account.id) return json(response, 403, { error: 'This course is not assigned to you.' }, cors)
      if (!course.cohort_id) return json(response, 200, { students: [] }, cors)
      const { data, error } = await db.from('enrollments').select('students(id, full_name, email)').eq('cohort_id', course.cohort_id)
      if (error) throw error
      return json(response, 200, { students: (data ?? []).flatMap((row) => row.students ? [row.students] : []) }, cors)
    }

    if (request.method === 'GET' && request.url === '/api/learning/items') {
      const account = await currentUser(request)
      if (!account) return json(response, 401, { error: 'Not signed in.' }, cors)
      let query = db.from('app_learning_items').select('*, cohorts(name, courses(name))').order('created_at', { ascending: false })
      if (account.role === 'student') {
        const context = await studentLearningContext(account)
        if (!context.cohort) return json(response, 200, { items: [] }, cors)
        query = query.eq('cohort_id', context.cohort.id).eq('status', 'published')
      } else if (!['admin', 'manager', 'trainer'].includes(account.role)) return json(response, 403, { error: 'Learning access is required.' }, cors)
      const { data, error } = await query
      if (error) throw error
      const permitted = []
      for(const item of data ?? []) {
        if(account.role !== 'trainer' || await canTeachCohort(account,item.cohort_id)) permitted.push(item)
      }
      return json(response, 200, { items: permitted }, cors)
    }

    if (request.method === 'GET' && request.url === '/api/learning/cohorts') {
      const account = await currentUser(request)
      if (!account || !['admin', 'manager', 'trainer'].includes(account.role)) return json(response, 403, { error: 'Staff access is required.' }, cors)
      const { data, error } = await db.from('cohorts').select('id, name, app_course_id, app_courses!cohorts_app_course_id_fkey(title)').order('name')
      if (error) throw error
      const cohorts=[]
      for (const cohort of data ?? []) if (await canTeachCohort(account,cohort.id)) cohorts.push({id:cohort.id,name:cohort.name,courseName:cohort.app_courses?.title ?? ''})
      return json(response, 200, { cohorts }, cors)
    }

    if (request.method === 'POST' && request.url === '/api/learning/items') {
      const account = await currentUser(request)
      if (!account || !['admin', 'manager', 'trainer'].includes(account.role)) return json(response, 403, { error: 'Staff access is required.' }, cors)
      const input = await body(request)
      if (!['classwork', 'assignment', 'assessment', 'project'].includes(input.itemType)) throw new Error('Choose classwork, assignment, assessment, or project.')
      const title = String(input.title ?? '').trim()
      if (!title || !input.cohortId) throw new Error('A title and cohort are required.')
      if (!Number.isFinite(Number(input.maximumScore)) || Number(input.maximumScore)<=0) throw new Error('Maximum score must be greater than zero.')
      if(!await canTeachCohort(account,input.cohortId)) return json(response,403,{error:'This cohort is not assigned to you.'},cors)
      const { data, error } = await db.from('app_learning_items').insert({ item_type: input.itemType, title, instructions: String(input.instructions ?? ''), cohort_id: input.cohortId, due_at: input.dueAt || null, maximum_score: Number(input.maximumScore) || 100, status: input.status === 'draft' ? 'draft' : 'published', created_by: account.id }).select('*').single()
      if (error) throw error
      return json(response, 201, { item: data }, cors)
    }

    const learningSubmissionMatch = request.url?.match(/^\/api\/learning\/items\/([0-9a-f-]{36})\/submissions$/i)
    if (request.method === 'POST' && learningSubmissionMatch) {
      const account = await currentUser(request)
      if (!account || account.role !== 'student') return json(response, 403, { error: 'Student access is required.' }, cors)
      const context = await studentLearningContext(account)
      if (!context.student) return json(response, 400, { error: 'No student record is linked to this account.' }, cors)
      if (context.enrollment?.completion_status === 'completed') return json(response,403,{error:'This enrollment is completed. Historical learning records are read-only.'},cors)
      const work=await db.from('app_learning_items').select('*').eq('id',learningSubmissionMatch[1]).single()
      if(work.error) throw work.error
      if(work.data.cohort_id !== context.cohort?.id || work.data.status !== 'published') return json(response,403,{error:'This work is not assigned to you.'},cors)
      const input = await body(request)
      if(!String(input.response??'').trim()) throw new Error('Enter your response.')
      const previous=await db.from('app_learning_submissions').select('id,score').eq('item_id',learningSubmissionMatch[1]).eq('student_id',context.student.id).maybeSingle()
      if(previous.error) throw previous.error
      if(previous.data?.score != null) throw new Error('Graded submissions cannot be replaced.')
      const values = { response: String(input.response ?? ''), submitted_at: new Date().toISOString() }
      const mutation = previous.data
        ? db.from('app_learning_submissions').update(values).eq('id',previous.data.id).is('score',null)
        : db.from('app_learning_submissions').insert({item_id:learningSubmissionMatch[1],student_id:context.student.id,...values})
      const { data, error } = await mutation.select('*').single()
      if (error) throw error
      return json(response, 201, { submission: data }, cors)
    }

    if (request.method === 'GET' && learningSubmissionMatch) {
      const account = await currentUser(request)
      if (!account || !['admin', 'manager', 'trainer'].includes(account.role)) return json(response, 403, { error: 'Staff access is required.' }, cors)
      const work=await db.from('app_learning_items').select('cohort_id').eq('id',learningSubmissionMatch[1]).single()
      if(work.error) throw work.error
      if(!await canTeachCohort(account,work.data.cohort_id)) return json(response,403,{error:'This work is not assigned to you.'},cors)
      const { data, error } = await db.from('app_learning_submissions').select('*, students(full_name, email)').eq('item_id', learningSubmissionMatch[1]).order('submitted_at', { ascending: false })
      if (error) throw error
      return json(response, 200, { submissions: data ?? [] }, cors)
    }

    const gradeMatch = request.url?.match(/^\/api\/learning\/submissions\/([0-9a-f-]{36})\/grade$/i)
    if (request.method === 'PATCH' && gradeMatch) {
      const account = await currentUser(request)
      if (!account || !['admin', 'manager', 'trainer'].includes(account.role)) return json(response, 403, { error: 'Staff access is required.' }, cors)
      const input = await body(request)
      const score = Number(input.score)
      const submission=await db.from('app_learning_submissions').select('item_id').eq('id',gradeMatch[1]).single()
      if(submission.error) throw submission.error
      const work=await db.from('app_learning_items').select('cohort_id,maximum_score').eq('id',submission.data.item_id).single()
      if(work.error) throw work.error
      if(!await canTeachCohort(account,work.data.cohort_id)) return json(response,403,{error:'This work is not assigned to you.'},cors)
      if (input.score === '' || input.score == null || !Number.isFinite(score) || score < 0 || score > work.data.maximum_score) throw new Error('Enter a score between zero and the maximum score.')
      const { data, error } = await db.from('app_learning_submissions').update({ score, feedback: String(input.feedback ?? ''), graded_by: account.id, graded_at: new Date().toISOString() }).eq('id', gradeMatch[1]).select('*').single()
      if (error) throw error
      return json(response, 200, { submission: data }, cors)
    }

    const approvalMatch = request.url?.match(/^\/api\/admin\/accounts\/([0-9a-f-]{36})\/approval$/i)
    if (request.method === 'PATCH' && approvalMatch) {
      const actor = await currentUser(request)
      if (!actor || !['admin', 'manager'].includes(actor.role)) return json(response, 403, { error: 'Administrator access is required.' }, cors)
      const input = await body(request)
      if (!['approved', 'rejected'].includes(input.status)) throw new Error('Status must be approved or rejected.')
      const { data: target, error: targetError } = await db.from('app_auth_users').select('*').eq('id', approvalMatch[1]).single()
      if (targetError) throw targetError
      let data
      if (input.status === 'approved') {
        data = await approveStudentAccount(target)
      } else {
        const result = await db.from('app_auth_users').update({ approval_status: 'rejected' }).eq('id', target.id).select('*').single()
        if (result.error) throw result.error
        data = result.data
      }
      return json(response, 200, { user: publicUser(data) }, cors)
    }

    const deleteAccountMatch = request.url?.match(/^\/api\/admin\/accounts\/([0-9a-f-]{36})$/i)
    if (request.method === 'DELETE' && deleteAccountMatch) {
      const actor = await currentUser(request)
      if (!actor || actor.role !== 'admin') return json(response, 403, { error: 'Administrator access is required.' }, cors)
      if (actor.id === deleteAccountMatch[1]) return json(response, 409, { error: 'You cannot delete your own account.' }, cors)
      const target = await db.from('app_auth_users').select('id,role').eq('id', deleteAccountMatch[1]).maybeSingle()
      if (target.error) throw target.error
      if (!target.data) return json(response, 404, { error: 'Application account not found. No account was deleted.' }, cors)
      if (target.data.role === 'admin') return json(response, 409, { error: 'Change this administrator to a non-administrator role before deleting the account.' }, cors)
      // Account deletion cascades to sessions and reset tokens, not student history.
      const result = await db.from('app_auth_users').delete().eq('id', target.data.id).select('id')
      if (result.error?.code === '23503') return json(response, 409, { error: 'This account owns learning records and could not be deleted. Reject its access first, then review its linked records.' }, cors)
      if (result.error) throw result.error
      return json(response, 200, { success: true }, cors)
    }
    const roleMatch = request.url?.match(/^\/api\/admin\/accounts\/([0-9a-f-]{36})\/role$/i)
    if (request.method === 'PATCH' && roleMatch) {
      const actor = await currentUser(request)
      if (!actor || actor.role !== 'admin') return json(response, 403, { error: 'Administrator access is required.' }, cors)
      const input = await body(request)
      if (!['admin', 'manager', 'trainer', 'student', 'parent', 'sponsor'].includes(input.role)) throw new Error('Choose a valid role.')
      const { data, error } = await db.from('app_auth_users').update({ role: input.role }).eq('id', roleMatch[1]).select('*').single()
      if (error) throw error
      return json(response, 200, { user: publicUser(data) }, cors)
    }
    return json(response, 404, { error: 'Not found.' }, cors)
  } catch (error) {
    console.error('[app-auth]', error)
    const message = error instanceof Error
      ? error.message
      : error && typeof error === 'object' && 'message' in error
        ? String(error.message)
        : 'Unable to process this request.'
    return json(response, 400, { error: message }, cors)
  }
}).listen(port, () => console.log(`Ijesha app API listening on http://localhost:${port}`))
