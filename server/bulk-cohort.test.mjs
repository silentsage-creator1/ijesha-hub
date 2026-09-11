import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const source = readFileSync(new URL('./auth-server.mjs', import.meta.url), 'utf8')
const start = source.indexOf("    if (request.method === 'POST' && request.url === '/api/students/assign-cohort')")
const end = source.indexOf('    const studentDetailMatch', start)
const run = new Function('request','currentUser','body','db','json','response','cors', `return (async()=>{${source.slice(start,end)}})()`)
const request = {method:'POST',url:'/api/students/assign-cohort'}
test('only administrators may bulk assign', async () => {
  const result = await run(request,async()=>({role:'trainer'}),async()=>({}),{},(_,status)=>status,{}, {})
  assert.equal(result,403)
})
test('empty or oversized selections cannot write', async () => {
  for (const studentIds of [[],Array.from({length:101},(_,i)=>String(i))]) {
    await assert.rejects(run(request,async()=>({role:'admin'}),async()=>({studentIds}),{},()=>{}, {}, {}), /Select between/)
  }
})
