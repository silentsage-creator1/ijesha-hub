import test from 'node:test'
import assert from 'node:assert/strict'
import { profileCertificates } from './profile-certificates.mjs'

async function certificates(role, links = []) {
  const rows = [{ student_id: 'own', status: 'Issued' }, { student_id: 'other', status: 'Issued' }, { student_id: 'own', status: 'Draft' }]
  let result
  const db = { from(table) {
    let data = table === 'app_parent_links' ? links : rows
    return { select() { return this }, order() { return this }, eq(key, value) { data = data.filter(row => row[key] === value); return this }, in(key, values) { data = data.filter(row => values.includes(row[key])); return this }, then(resolve) { return Promise.resolve({ data }).then(resolve) } }
  } }
  await profileCertificates({ request: { url: '/api/certificates', method: 'GET' }, response: {}, account: { id: 'parent', role, approval_status: 'approved' }, db, json: (_, status, body) => { result = { status, body } }, cors: {}, studentLearningContext: async () => ({ student: { id: 'own' } }) })
  return result
}
test('students receive only their issued certificates', async () => {
  assert.deepEqual((await certificates('student')).body.certificates, [{ student_id: 'own', status: 'Issued' }])
})
test('parents receive only explicitly linked children certificates', async () => {
  assert.deepEqual((await certificates('parent', [{ parent_id: 'parent', student_id: 'own' }, { parent_id: 'another', student_id: 'other' }])).body.certificates, [{ student_id: 'own', status: 'Issued' }])
  assert.deepEqual((await certificates('parent')).body.certificates, [])
})
test('unrelated roles cannot access certificates', async () => {
  assert.equal((await certificates('sponsor')).status, 403)
})
