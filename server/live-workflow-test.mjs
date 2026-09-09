// Explicit opt-in: creates and removes isolated fixtures in the configured database.
import assert from 'node:assert/strict'
import { randomUUID, randomBytes, scryptSync } from 'node:crypto'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createClient } from '@supabase/supabase-js'
if (!process.argv.includes('--run')) throw new Error('Pass --run to authorize temporary live test fixtures.')
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false},global:{fetch:(url,init)=>{const headers=new Headers(init?.headers);headers.set('connection','close');return fetch(url,{...init,headers})}}})
const prefix=`workflow-test-${randomUUID()}`
const ids={users:[],students:[],courses:[],cohorts:[]}
const password=randomBytes(20).toString('hex'),salt=randomBytes(16).toString('hex')
const hash=`${salt}:${scryptSync(password,salt,64).toString('hex')}`
const checked=r=>{if(r.error)throw new Error(r.error.message);return r.data}
console.log('Test run:',prefix)
let server
async function api(path,cookie,method='GET',data,status=200,attempt=0){
  const result=await fetch(`http://127.0.0.1:3019${path}`,{method,headers:{'content-type':'application/json',...(cookie?{cookie}:{})},body:data?JSON.stringify(data):undefined})
  const payload=await result.json()
  // Reads, test-account sign-in and identical test-profile field updates are
  // safe to repeat after transport loss.
  // Do not repeat submission, grading, account creation or issuance writes.
  if(payload.error?.includes('fetch failed') && attempt<2 && (method==='GET'||path==='/api/auth/signin'||(path==='/api/profile'&&method==='PATCH'))) return api(path,cookie,method,data,status,attempt+1)
  assert.equal(result.status,status,`${method} ${path}: ${JSON.stringify(payload)}`)
  return { ...payload,cookie:result.headers.get('set-cookie')?.split(';')[0] }
}
async function user(role){
  const id=randomUUID();ids.users.push(id)
  const email=`${prefix}-${ids.users.length}@example.invalid`
  checked(await db.from('app_auth_users').insert({id,email,full_name:`${prefix} ${role}`,password_hash:hash,role,approval_status:'approved'}))
  return {id,email,cookie:(await api('/api/auth/signin',null,'POST',{email,password})).cookie}
}
try {
  server=spawn(process.execPath,['server/auth-server.mjs'],{env:{...process.env,PORT:'3019',NODE_ENV:'development'},stdio:['ignore','pipe','pipe']})
  await Promise.race([new Promise((resolve,reject)=>{server.stdout.on('data',chunk=>{if(String(chunk).includes('listening'))resolve()});server.once('exit',()=>reject(new Error('Test API failed to start.')))}),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Test API startup timeout')),30000).unref())])
  const admin=await user('admin'),trainer=await user('trainer'),outsider=await user('trainer'),student=await user('student'),other=await user('student')
  const courseId=randomUUID();ids.courses.push(courseId)
  checked(await db.from('app_courses').insert({id:courseId,title:prefix,trainer_id:trainer.id,created_by:admin.id,status:'Published'}))
  const cohortId=randomUUID();ids.cohorts.push(cohortId)
  checked(await db.from('cohorts').insert({id:cohortId,name:prefix,app_course_id:courseId,starts_on:'2026-09-01',ends_on:'2026-12-01'}))
  for(const account of [student,other]) {
    const sid=checked(await db.rpc('assign_app_student_cohort',{account_id:account.id,target_cohort_id:cohortId}));ids.students.push(sid)
  }
  assert.equal((await api('/api/student/cohort',student.cookie)).cohort.id,cohortId)
  assert.equal((await api('/api/learning/cohorts',outsider.cookie)).cohorts.length,0)
  if(process.argv.includes('--historical-only')) {
    const pastCourse=randomUUID();ids.courses.push(pastCourse)
    checked(await db.from('app_courses').insert({id:pastCourse,title:`${prefix} past course`,created_by:admin.id,status:'Published'}))
    const pastCohort=randomUUID();ids.cohorts.push(pastCohort)
    checked(await db.from('cohorts').insert({id:pastCohort,name:`${prefix} past cohort`,app_course_id:pastCourse,starts_on:'2010-01-01',ends_on:'2010-04-01'}))
    const path=`/api/admin/accounts/${student.id}/cohort`
    const input={pastStudent:true,cohortId:pastCohort,enrollmentDate:'2010-01-01'}
    await api(path,trainer.cookie,'PATCH',input,403)
    const manager=await user('manager')
    await api(path,manager.cookie,'PATCH',input,403)
    await api(path,admin.cookie,'PATCH',{...input,enrollmentDate:'2011-01-01'},400)
    await api(path,admin.cookie,'PATCH',{...input,cohortId,enrollmentDate:'2026-09-09'},400)
    await api(path,admin.cookie,'PATCH',input)
    await api(path,admin.cookie,'PATCH',input)
    const history=checked(await db.from('enrollments').select('*').eq('student_id',ids.students[0]).eq('cohort_id',pastCohort))
    assert.equal(history.length,1);assert.equal(history[0].completion_status,'completed')
    const cohortView=await api(`/api/cohorts/${pastCohort}/students`,admin.cookie)
    assert.equal(cohortView.enrollments.find(e=>e.student_id===ids.students[0]).completion_status,'completed')
    await api(`/api/cohorts/${pastCohort}/students`,outsider.cookie,'GET',null,403)
    assert.equal((await api('/api/student/cohort',student.cookie)).cohort.id,cohortId)
    assert.equal(checked(await db.from('students').select('track,status').eq('id',ids.students[0]).single()).track,prefix)
    console.log('PASS historical enrollment: admin-only, date validation, no duplicates, current cohort preserved')
    const email=`${prefix}-past@example.invalid`
    try {
      const form={pastStudent:true,firstName:'Past',lastName:'Student',email,password,phone:'123456',dateOfBirth:'1980-01-01',gender:'Male',courseId:pastCourse,cohortId:pastCohort,enrollmentDate:'2010-01-01'}
      await api('/api/students',manager.cookie,'POST',form,403)
      await api('/api/students',admin.cookie,'POST',{...form,enrollmentDate:'2011-01-01'},400)
      assert.equal(checked(await db.from('app_auth_users').select('id').eq('email',email).maybeSingle()),null)
      const created=await api('/api/students',admin.cookie,'POST',form,201)
      ids.students.push(created.studentId)
      const account=checked(await db.from('app_auth_users').select('id').eq('email',email).single());ids.users.push(account.id)
      const login=await api('/api/auth/signin',null,'POST',{email,password})
      const context=await api('/api/student/cohort',login.cookie)
      assert.equal(context.cohort.id,pastCohort);assert.equal(context.enrollment.completion_status,'completed')
      assert.equal(context.student.status,'graduated');assert.equal(context.attendance.length,0)
      assert.equal((await api('/api/certificates',login.cookie)).certificates.length,0)
      const {item}=await api('/api/learning/items',admin.cookie,'POST',{itemType:'classwork',title:prefix,cohortId:pastCohort,maximumScore:100},201)
      await api(`/api/learning/items/${item.id}/submissions`,login.cookie,'POST',{response:'Late work'},403)
      console.log('PASS past student creation: atomic rollback, graduated status, completed cohort access, no invented attendance/certificates')
    } finally {
      const found=checked(await db.from('app_auth_users').select('id,student_id').eq('email',email).maybeSingle())
      if(found){if(!ids.users.includes(found.id))ids.users.push(found.id);if(found.student_id&&!ids.students.includes(found.student_id))ids.students.push(found.student_id)}
    }
  } else {
  for(const itemType of (process.argv.includes('--records-only') ? [] : ['classwork','assignment','project','assessment'])){
    const {item}=await api('/api/learning/items',trainer.cookie,'POST',{itemType,title:`${prefix} ${itemType}`,cohortId,maximumScore:100},201)
    assert((await api('/api/learning/items',student.cookie)).items.some(row=>row.id===item.id))
    await api(`/api/learning/items/${item.id}/submissions`,outsider.cookie,'GET',null,403)
    const {submission}=await api(`/api/learning/items/${item.id}/submissions`,student.cookie,'POST',{response:'Test solution'},201)
    assert((await api(`/api/learning/items/${item.id}/submissions`,trainer.cookie)).submissions.some(row=>row.id===submission.id))
    await api(`/api/learning/submissions/${submission.id}/grade`,outsider.cookie,'PATCH',{score:80},403)
    await api(`/api/learning/submissions/${submission.id}/grade`,trainer.cookie,'PATCH',{score:101},400)
    await api(`/api/learning/submissions/${submission.id}/grade`,trainer.cookie,'PATCH',{score:82,feedback:'Verified feedback'})
    const summary=await api('/api/student/summary',student.cookie)
    assert.equal(Number(summary.submissions.find(row=>row.id===submission.id).score),82)
    assert.equal(summary.submissions.find(row=>row.id===submission.id).feedback,'Verified feedback')
    assert(!(await api('/api/student/summary',other.cookie)).submissions.some(row=>row.id===submission.id))
    await api(`/api/learning/items/${item.id}/submissions`,student.cookie,'POST',{response:'Overwrite graded work'},400)
    console.log(`PASS ${itemType}: publish, submit, grade, student results, access restrictions`)
  }
  {
    const email=`${prefix}-created@example.invalid`
    try {
      const created=await api('/api/students',admin.cookie,'POST',{firstName:'Workflow',lastName:'Test',email,password,phone:'123456',dateOfBirth:'2000-01-01',gender:'Male',courseId,cohortId,enrollmentDate:'2026-09-09'},201)
      ids.students.push(created.studentId)
      const account=checked(await db.from('app_auth_users').select('id').eq('email',email).single());ids.users.push(account.id)
      const login=await api('/api/auth/signin',null,'POST',{email,password})
      assert.equal((await api('/api/student/cohort',login.cookie)).cohort.id,cohortId)
      console.log('PASS Add Student: account creation, sign-in and cohort linkage')
    } catch(error) {
      const found=checked(await db.from('app_auth_users').select('id,student_id').eq('email',email).maybeSingle())
      if(found){if(!ids.users.includes(found.id))ids.users.push(found.id);if(found.student_id&&!ids.students.includes(found.student_id))ids.students.push(found.student_id)}
      throw error
    }
  }
  {
    await api('/api/profile',trainer.cookie,'PATCH',{fullName:`${prefix} trainer updated`,details:{phone_number:'789012',department:'Training'}})
    assert.equal((await api('/api/profile',trainer.cookie)).details.phone_number,'789012')
    await api('/api/profile',student.cookie,'PATCH',{fullName:`${prefix} updated`,details:{phone_number:'123456',final_score:99}})
    const profile=await api('/api/profile',student.cookie)
    assert.equal(profile.details.phone_number,'123456');assert.notEqual(profile.details.final_score,99)
    assert.equal(profile.profileComplete,false)
    const updatedName=`${prefix} updated`
    const photo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII='
    await api('/api/profile',student.cookie,'PATCH',{fullName:updatedName,photo,details:{first_name:'Workflow',last_name:'Student',date_of_birth:'2000-01-01',gender:'Male',phone_number:'123456',home_address:'Test address',state:'Test state',lga:'Test LGA',city_town:'Test town'}})
    const completed=await api('/api/profile',student.cookie)
    assert.equal(completed.profileComplete,true);assert.equal(completed.photo,photo)
    assert.equal((await api('/api/auth/me',student.cookie)).user.full_name,updatedName)
    assert.equal((await api('/api/students',admin.cookie)).students.find(s=>s.id===ids.students[0]).full_name,updatedName)
    assert.equal((await api('/api/admin/accounts',admin.cookie)).users.find(u=>u.id===student.id).full_name,updatedName)
    console.log('PASS profile warning clears after completion; name and photo persist across shared views')
    const {certificate}=await api('/api/certificates',admin.cookie,'POST',{student_id:ids.students[0]},201)
    assert((await api('/api/certificates',student.cookie)).certificates.some(row=>row.id===certificate.id))
    assert(!(await api('/api/certificates',other.cookie)).certificates.some(row=>row.id===certificate.id))
    await api('/api/certificates',student.cookie,'POST',{student_id:ids.students[0]},403)
    console.log('PASS profile persistence, protected certificate fields, certificate issuance and ownership')
  }
  }
  console.log('Workflow tests completed.')
} catch(error) {
  console.error('Test failed:',error.message)
  throw error
} finally {
  // Every deletion is restricted to UUIDs generated by this run or their FK children.
  async function remove(table,id,column='id') {
    for(let attempt=0;attempt<3;attempt++){
      const result=await db.from(table).delete().eq(column,id)
      if(!result.error)return
      if(attempt===2)throw new Error(`Cleanup failed for ${table}/${id}: ${result.error.message}`)
    }
  }
  for(const id of ids.cohorts) { await remove('enrollments',id,'cohort_id'); await remove('cohorts',id) }
  for(const id of ids.courses) await remove('app_courses',id)
  for(const id of ids.students) await remove('students',id)
  for(const id of ids.users) await remove('app_auth_users',id)
  console.log('Temporary test records removed.')
  if(server && server.exitCode===null){server.kill();await once(server,'exit')}
}
