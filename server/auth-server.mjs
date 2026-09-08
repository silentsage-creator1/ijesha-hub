import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import { createClient } from '@supabase/supabase-js'

const port = Number(process.env.PORT ?? process.env.APP_API_PORT ?? 3001)
const databaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const adminEmail = (process.env.APP_ADMIN_EMAIL ?? '').trim().toLowerCase()
const publicUrl = (process.env.APP_PUBLIC_URL ?? process.env.APP_ORIGIN ?? `http://localhost:${port}`).replace(/\/$/, '')

if (!databaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required by the app backend.')
}

const db = createClient(databaseUrl, serviceRoleKey, { auth: { persistSession: false } })
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
  for await (const chunk of request) raw += chunk
  try { return JSON.parse(raw || '{}') } catch { throw new Error('Request body must be valid JSON.') }
}

async function currentUser(request) {
  const token = parseCookies(request)[cookieName]
  if (!token) return null
  const { data: session } = await db.from('app_auth_sessions').select('user_id, expires_at').eq('token_hash', sessionDigest(token)).maybeSingle()
  if (!session || new Date(session.expires_at).getTime() <= Date.now()) return null
  const { data: account } = await db.from('app_auth_users').select('*').eq('id', session.user_id).maybeSingle()
  return account ?? null
}

function setSessionCookie(response, token) {
  const crossSite = process.env.NODE_ENV === 'production' ? '; SameSite=None; Secure' : '; SameSite=Strict'
  return `${cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly${crossSite}; Max-Age=${sessionLifetimeMs / 1000}`
}

async function studentLearningContext(account) {
  const { data: byProfile } = await db.from('students').select('*').eq('profile_id', account.id).maybeSingle()
  const { data: byEmail } = byProfile
    ? { data: null }
    : await db.from('students').select('*').ilike('email', account.email).maybeSingle()
  const student = byProfile ?? byEmail
  if (!student) return { student: null, cohort: null, sessions: [], attendance: [], classmates: [] }
  const { data: enrollment } = await db.from('enrollments').select('cohort_id').eq('student_id', student.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
  const { data: cohort } = enrollment?.cohort_id
    ? await db.from('cohorts').select('id, name, course_id, starts_on, ends_on, created_at, courses(name)').eq('id', enrollment.cohort_id).maybeSingle()
    : student.cohort
      ? await db.from('cohorts').select('id, name, course_id, starts_on, ends_on, created_at, courses(name)').ilike('name', student.cohort).maybeSingle()
      : { data: null }
  if (!cohort) return { student, cohort: null, sessions: [], attendance: [], classmates: [] }
  const [sessionsRes, attendanceRes, classmatesRes] = await Promise.all([
    db.from('training_sessions').select('*').eq('cohort_id', cohort.id).order('starts_at'),
    db.from('attendance').select('*').eq('cohort_id', cohort.id).eq('student_id', student.id),
    db.from('students').select('id, full_name, track, status, email').ilike('cohort', cohort.name),
  ])
  return {
    student,
    cohort: { ...cohort, course_name: cohort.courses?.name ?? '' },
    sessions: sessionsRes.data ?? [],
    attendance: attendanceRes.data ?? [],
    classmates: classmatesRes.data ?? [],
  }
}

createServer(async (request, response) => {
  const origin = request.headers.origin
  const cors = origin === process.env.APP_ORIGIN ? { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', vary: 'Origin' } : {}
  if (request.method === 'OPTIONS') return json(response, 204, {}, { ...cors, 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'access-control-allow-headers': 'content-type' })
  try {
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
      const track = String(input.track ?? 'Frontend Development')
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid email address.')
      if (!fullName) throw new Error('Enter your full name.')
      if (password.length < 8) throw new Error('Password must be at least 8 characters.')
      const { data: existing } = await db.from('app_auth_users').select('id').eq('email', email).maybeSingle()
      if (existing) return json(response, 409, { error: 'An account already exists for this email.' }, cors)
      const role = email === adminEmail ? 'admin' : 'student'
      const approvalStatus = role === 'admin' ? 'approved' : 'pending'
      const { data: account, error } = await db.from('app_auth_users').insert({ email, full_name: fullName, password_hash: passwordHash(password), role, track, approval_status: approvalStatus, organization: 'Ijesha Digital Hub' }).select('*').single()
      if (error) throw error
      return json(response, 201, { user: publicUser(account), message: role === 'admin' ? 'Account created.' : 'Registration received. An administrator will review your account in the app.' }, cors)
    }

    if (request.method === 'POST' && request.url === '/api/auth/signin') {
      const input = await body(request)
      const email = String(input.email ?? '').trim().toLowerCase()
      const password = String(input.password ?? '')
      const { data: account } = await db.from('app_auth_users').select('*').eq('email', email).maybeSingle()
      if (!account) {
        const message = email === adminEmail
          ? 'The administrator application account has not been created yet. Select Create account and register this email first.'
          : 'Invalid email or password.'
        return json(response, 401, { error: message }, cors)
      }
      if (!passwordMatches(password, account.password_hash)) return json(response, 401, { error: 'Invalid email or password.' }, cors)
      if (account.approval_status === 'pending') return json(response, 403, { error: 'Your registration is awaiting in-app administrator approval.' }, cors)
      if (account.approval_status === 'rejected') return json(response, 403, { error: 'This account has not been approved.' }, cors)
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
        title, description: String(input.description ?? ''), thumbnail: input.thumbnail || null, level: input.level || null,
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
            thumbnail: input.thumbnail || null, level: input.level || null, status: input.status === 'Published' ? 'Published' : 'Draft',
            content: Array.isArray(input.modules) ? input.modules : existing.content, cohort_id: input.cohortId || null,
            trainer_id: input.trainerId || null, start_date: input.startDate || null, end_date: input.endDate || null, updated_at: new Date().toISOString(),
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
      } else if (!['admin', 'manager', 'trainer', 'parent'].includes(account.role)) return json(response, 403, { error: 'Learning access is required.' }, cors)
      const { data, error } = await query
      if (error) throw error
      return json(response, 200, { items: data ?? [] }, cors)
    }

    if (request.method === 'GET' && request.url === '/api/learning/cohorts') {
      const account = await currentUser(request)
      if (!account || !['admin', 'manager', 'trainer'].includes(account.role)) return json(response, 403, { error: 'Staff access is required.' }, cors)
      const { data, error } = await db.from('cohorts').select('id, name, course_id, courses(name)').order('name')
      if (error) throw error
      return json(response, 200, { cohorts: (data ?? []).map((cohort) => ({ id: cohort.id, name: cohort.name, courseName: cohort.courses?.name ?? '' })) }, cors)
    }

    if (request.method === 'POST' && request.url === '/api/learning/items') {
      const account = await currentUser(request)
      if (!account || !['admin', 'manager', 'trainer'].includes(account.role)) return json(response, 403, { error: 'Staff access is required.' }, cors)
      const input = await body(request)
      if (!['classwork', 'assessment', 'project'].includes(input.itemType)) throw new Error('Choose classwork, assessment, or project.')
      const title = String(input.title ?? '').trim()
      if (!title || !input.cohortId) throw new Error('A title and cohort are required.')
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
      const input = await body(request)
      const { data, error } = await db.from('app_learning_submissions').upsert({ item_id: learningSubmissionMatch[1], student_id: context.student.id, response: String(input.response ?? ''), submitted_at: new Date().toISOString() }, { onConflict: 'item_id,student_id' }).select('*').single()
      if (error) throw error
      return json(response, 201, { submission: data }, cors)
    }

    if (request.method === 'GET' && learningSubmissionMatch) {
      const account = await currentUser(request)
      if (!account || !['admin', 'manager', 'trainer'].includes(account.role)) return json(response, 403, { error: 'Staff access is required.' }, cors)
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
      if (!Number.isFinite(score) || score < 0) throw new Error('Enter a valid score.')
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
