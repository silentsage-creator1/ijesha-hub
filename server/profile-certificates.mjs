const personalFields = ['first_name','middle_name','last_name','date_of_birth','gender','phone_number','home_address','state','lga','city_town','guardian_first_name','guardian_last_name','guardian_relationship','guardian_phone','guardian_alt_phone','guardian_email','guardian_address','certificate_name']
import { studentProfileComplete } from './profile-completion.mjs'
function checked(result) { if (result.error) throw result.error; return result.data }

export async function profileCertificates({ request, response, account, db, body, json, cors, studentLearningContext, publicUser }) {
  if (!['/api/profile', '/api/certificates'].includes(request.url)) return false
  if (!account || account.approval_status !== 'approved') { json(response,403,{error:'Approved account access is required.'},cors); return true }
  if (request.url === '/api/profile') {
    const context = account.role === 'student' ? await studentLearningContext(account) : null
    if (request.method === 'GET') {
      const extra = checked(await db.from('app_profile_details').select('details').eq('user_id',account.id).maybeSingle())?.details ?? {}
      const details = context?.student ? checked(await db.from('student_profile_details').select('*').eq('student_id',context.student.id).maybeSingle()) ?? {} : {}
      if (context?.student) {
        details.phone_number ??= details.phone ?? null
        details.guardian_phone ??= details.emergency_contact_phone ?? null
        details.guardian_relationship ??= details.emergency_contact_relationship ?? null
      }
      let photo = extra.photo ?? null
      if (!photo && details.photo_path) photo = checked(await db.storage.from('student-photos').createSignedUrl(details.photo_path,3600)).signedUrl
      json(response,200,{user:publicUser(account),details:{...extra,...details},photo,cohort:context?.cohort ?? null,enrollment:context?.enrollment ?? null,profileComplete:studentProfileComplete(details,photo)},cors)
    } else if (request.method === 'PATCH') {
      const input = await body(request)
      const fullName = String(input.fullName ?? '').trim()
      if (!fullName || fullName.length > 200) throw new Error('Enter a full name of at most 200 characters.')
      const previous = checked(await db.from('app_profile_details').select('details').eq('user_id',account.id).maybeSingle())?.details ?? {}
      const extra = { ...previous }
      for (const key of ['phone_number','department']) if (key in (input.details ?? {})) extra[key] = String(input.details[key] ?? '').slice(0,200)
      if (input.photo !== undefined) {
        if (typeof input.photo !== 'string' || input.photo.length > 1500000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(input.photo)) throw new Error('Choose a PNG, JPEG or WebP photo under 1 MB.')
        extra.photo = input.photo
      }
      if (account.role === 'student') {
        if (!context?.student) throw new Error('An administrator must link your student record first.')
        const details = {}
        for (const key of personalFields) if (key in (input.details ?? {})) details[key] = String(input.details[key] ?? '').trim().slice(0,1000) || null
        checked(await db.from('student_profile_details').upsert({student_id:context.student.id,...details},{onConflict:'student_id'}))
        checked(await db.from('students').update({full_name:fullName}).eq('id',context.student.id))
      }
      checked(await db.from('app_profile_details').upsert({user_id:account.id,details:extra}))
      checked(await db.from('app_auth_users').update({full_name:fullName}).eq('id',account.id))
      json(response,200,{message:'Profile saved.'},cors)
    } else json(response,405,{error:'Method not allowed.'},cors)
    return true
  }
  const staff = ['admin','manager'].includes(account.role)
  if (!staff && account.role !== 'student') { json(response,403,{error:'Certificate access is not available for this role.'},cors); return true }
  if (request.method === 'GET') {
    let query = db.from('app_certificates').select('*').order('created_at',{ascending:false})
    if (!staff) {
      const context = await studentLearningContext(account)
      if (!context.student) { json(response,200,{certificates:[]},cors); return true }
      query = query.eq('student_id',context.student.id).eq('status','Issued')
    }
    json(response,200,{certificates:checked(await query)},cors)
  } else if (request.method === 'POST' && staff) {
    const input = await body(request)
    const student = checked(await db.from('students').select('id,full_name').eq('id',input.student_id).single())
    const learner = checked(await db.from('app_auth_users').select('*').eq('student_id',student.id).eq('role','student').eq('approval_status','approved').maybeSingle())
    const context = learner ? await studentLearningContext(learner) : null
    if (!context?.cohort?.course_name) throw new Error('Link an approved student account to a course and cohort before issuing a certificate.')
    const template = input.template_url ?? null
    if (template && (typeof template !== 'string' || template.length > 1500000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(template))) throw new Error('Use a PNG, JPEG or WebP certificate template under 1 MB.')
    const calibration = input.calibration
    if (calibration && (!['xPercent','yPercent','widthPercent','heightPercent','fontSizePt','letterSpacingPx'].every(k=>Number.isFinite(calibration[k]) && calibration[k]>=0 && calibration[k]<=200) || !/^#[0-9a-f]{6}$/i.test(calibration.color))) throw new Error('Invalid certificate layout.')
    const certificate = checked(await db.from('app_certificates').insert({student_id:student.id,student_name:student.full_name,course:context.cohort.course_name,cohort:context.cohort.name,certificate_type:'Certificate of Achievement',issue_date:new Date().toISOString().slice(0,10),status:'Issued',template_url:template,calibration:calibration ?? null,issued_by:account.id}).select('*').single())
    json(response,201,{certificate},cors)
  } else json(response,403,{error:'Only administrators and managers can issue certificates.'},cors)
  return true
}
