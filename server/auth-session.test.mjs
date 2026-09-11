import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Exercise the actual lookup implementation without starting the HTTP server.
const source = readFileSync(new URL('./auth-server.mjs', import.meta.url), 'utf8')
const implementation = source.slice(source.indexOf('async function currentUser('), source.indexOf('async function canTeachCohort('))
function lookup(results, token = 'test-token') {
  const db = { from() { return { select() { return this }, eq() { return this }, async maybeSingle() { return results.shift() } } } }
  return new Function('db', 'parseCookies', 'cookieName', 'sessionDigest', `${implementation}; return currentUser({})`)(db, () => ({ cookie: token }), 'cookie', value => value)
}
const validSession = { data: { user_id: 'student', expires_at: new Date(Date.now() + 60000).toISOString() } }
test('database failures do not become unauthenticated results', async () => {
  await assert.rejects(lookup([{ data: null, error: { message: 'fetch failed' } }]), /verify your session/)
  await assert.rejects(lookup([validSession, { data: null, error: { message: 'timeout' } }]), /verify your account/)
})
test('missing, expired and revoked sessions remain unauthenticated', async () => {
  assert.equal(await lookup([], ''), null)
  assert.equal(await lookup([{ data: null }]), null)
  assert.equal(await lookup([{ data: { expires_at: '2000-01-01' } }]), null)
  assert.equal(await lookup([validSession, { data: { approval_status: 'rejected' } }]), null)
})
test('approved account with a valid session remains authenticated', async () => {
  const account = { id: 'student', approval_status: 'approved' }
  assert.deepEqual(await lookup([validSession, { data: account }]), account)
})
test('deactivated accounts cannot use an existing session', async () => {
  assert.equal(await lookup([validSession, { data: { approval_status: 'approved', is_active: false } }]), null)
})
