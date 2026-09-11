import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./auth-server.mjs', import.meta.url), 'utf8')
const start = source.indexOf("    if (request.method === 'POST' && request.url === '/api/auth/signup')")
const end = source.indexOf("    if (request.method === 'POST' && request.url === '/api/auth/signin')", start)
const route = new Function('request', 'body', 'db', 'passwordHash', 'publicUser', 'json', 'response', 'cors', 'adminEmail', `return (async () => { ${source.slice(start, end)} })()`)
test('public signup ignores requested administrator role and administrator email exception', async () => {
  for (const email of ['admin@example.invalid', 'student@example.invalid']) {
    let inserted
    const db = { from() { return {
      select() { return this }, eq() { return this }, async maybeSingle() { return { data: null } },
      insert(value) { inserted = value; return this }, async single() { return { data: inserted } },
    } } }
    const result = await route({ method: 'POST', url: '/api/auth/signup' }, async () => ({ email, password: 'test-only-password', fullName: 'Test', role: 'admin', approval_status: 'approved' }), db, () => 'digest', account => account, (_, status, payload, headers) => ({ status, payload, headers }), {}, {}, 'admin@example.invalid')
    assert.equal(result.status, 201)
    assert.equal(inserted.role, 'student')
    assert.equal(inserted.approval_status, 'pending')
    assert.equal(result.headers['set-cookie'], undefined)
  }
})
