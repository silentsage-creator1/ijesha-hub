import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
const source = readFileSync(new URL('./auth-server.mjs', import.meta.url), 'utf8')
test('API proxy precedes the SPA fallback', () => {
  assert.deepEqual(config.rewrites[0], { source: '/api/:path*', destination: 'https://ijesha-hub.onrender.com/api/:path*' })
  assert.equal(config.rewrites.at(-1).destination, '/index.html')
})
test('production session cookie is host-only, secure and usable same-site', () => {
  const start = source.indexOf('function setSessionCookie(')
  const end = source.indexOf('\n}', start) + 2
  const cookie = new Function('process', 'cookieName', 'sessionLifetimeMs', `${source.slice(start, end)}; return setSessionCookie({}, 'test-token')`)({ env: { NODE_ENV: 'production' } }, 'ijesha_app_session', 604800000)
  assert.match(cookie, /HttpOnly/)
  assert.match(cookie, /SameSite=Lax; Secure/)
  assert.match(cookie, /Max-Age=604800/)
  assert.doesNotMatch(cookie, /Domain=/i)
})
test('API responses cannot be cached', () => {
  const start = source.indexOf('function json(')
  const end = source.indexOf('\n}', start) + 2
  let headers
  new Function('response', `${source.slice(start, end)}; json(response, 200, {})`)({ writeHead(_, value) { headers = value }, end() {} })
  assert.equal(headers['cache-control'], 'private, no-store')
})
