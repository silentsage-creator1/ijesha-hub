import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./auth-server.mjs', import.meta.url), 'utf8')
const route = source.slice(source.indexOf('    const studentDetailMatch ='), source.indexOf('    const assignCohortMatch ='))
const run = new Function('db', 'currentUser', 'canTeachCohort', 'request', 'response', 'json', 'cors', `return (async () => { ${route} })()`)
const id = '11111111-1111-4111-8111-111111111111'
async function check(role, records, assigned = false) {
  const db = { from(table) {
    const result = records[table]?.shift() ?? { data: null }
    return { select() { return this }, eq() { return this }, maybeSingle: async () => result, then(resolve) { return Promise.resolve(result).then(resolve) } }
  } }
  return run(db, async () => role ? { role } : null, async () => assigned,
    { url: `/api/students/${id}`, method: 'GET' }, {}, (_, status, body) => ({ status, body }), {})
}
test('student and unauthenticated accounts cannot read staff student details', async () => {
  assert.equal((await check(null, {})).status, 403)
  assert.equal((await check('student', {})).status, 403)
})
test('trainer must have an assigned cohort and never receives personal details', async () => {
  const records = () => ({ students: [{ data: { id } }], enrollments: [{ data: [{ cohort_id: id }] }] })
  assert.equal((await check('trainer', records())).status, 403)
  const result = await check('trainer', records(), true)
  assert.equal(result.status, 200)
  assert.equal(result.body.details, null)
  assert.equal(result.body.photo, null)
})
test('administrator can resolve application-account links to student records', async () => {
  const result = await check('admin', {
    students: [{ data: null }, { data: { id, full_name: 'Linked student' } }],
    app_auth_users: [{ data: { student_id: id } }, { data: null }],
    student_profile_details: [{ data: { first_name: 'Linked' } }],
  })
  assert.equal(result.status, 200)
  assert.equal(result.body.student.id, id)
  assert.equal(result.body.details.first_name, 'Linked')
})
test('missing records are not fabricated and database errors are not disguised', async () => {
  assert.equal((await check('admin', {})).status, 404)
  await assert.rejects(check('admin', { students: [{ error: new Error('Database unavailable') }] }), /Database unavailable/)
})
