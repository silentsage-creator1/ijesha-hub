import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync(new URL('./auth-server.mjs',import.meta.url),'utf8')
const start=source.indexOf('    const cohortDeleteMatch =')
const end=source.indexOf("    if (request.method === 'GET' && request.url === '/api/courses')",start)
const run=new Function('request','currentUser','body','db','json','response','cors',`return (async()=>{${source.slice(start,end)}})()`)
const id='11111111-1111-4111-8111-111111111111'
async function remove(role,input,error=null){
  let called=false
  const response=await run({method:'DELETE',url:`/api/cohorts/${id}`},async()=>({role}),async()=>input,{rpc:async(name,args)=>{called=true;assert.equal(name,'remove_app_cohort');assert.equal(args.target_id,id);assert.equal(args.expected_name,'Test');return{error}}},(_,status)=>status,{}, {})
  return{response,called}
}
test('nonstaff and unconfirmed requests cannot delete',async()=>{
  assert.deepEqual(await remove('student',{}),{response:403,called:false})
  assert.deepEqual(await remove('admin',{}),{response:400,called:false})
})
test('confirmed staff request uses the atomic transaction',async()=>{
  assert.deepEqual(await remove('admin',{confirmPermanent:true,cohortName:'Test'}),{response:200,called:true})
})
test('missing migration is reported without fallback deletion',async()=>{
  assert.equal((await remove('admin',{confirmPermanent:true,cohortName:'Test'},{code:'PGRST202'})).response,503)
})
