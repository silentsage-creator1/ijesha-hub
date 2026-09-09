import test from 'node:test'
import assert from 'node:assert/strict'
import { validateSession } from './session-validation.mjs'

const session = { topic: 'Training', week_number: 1, cohort_id: 'cohort', trainer_id: 'trainer', starts_at: '2026-09-09T09:00:00Z', ends_at: '2026-09-09T10:00:00Z', location: 'Classroom' }
test('physical sessions default to scheduled', () => {
  const result = validateSession(session)
  assert.equal(result.status, 'scheduled')
  assert.equal(result.app_trainer_id, 'trainer')
})
test('end time must follow start time', () => {
  assert.throws(() => validateSession({ ...session, ends_at: session.starts_at }))
})
test('weeks must be positive integers', () => {
  for (const week_number of [0, -1, 1.5, 521]) assert.throws(() => validateSession({ ...session, week_number }))
})
test('online sessions require safe meeting links', () => {
  for (const meeting_link of ['', 'javascript:alert(1)']) assert.throws(() => validateSession({ ...session, session_type: 'online', meeting_link }))
  assert.equal(validateSession({ ...session, session_type: 'online', meeting_link: 'https://example.com/meeting' }).location, '')
})
test('hybrid sessions require both location and meeting link', () => {
  assert.throws(() => validateSession({ ...session, session_type: 'hybrid' }))
  assert.throws(() => validateSession({ ...session, session_type: 'hybrid', location: '', meeting_link: 'https://example.com' }))
})
