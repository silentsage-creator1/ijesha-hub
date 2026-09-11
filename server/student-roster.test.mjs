import test from 'node:test'
import assert from 'node:assert/strict'
import { studentRoleRoster } from './student-roster.mjs'

test('promoted staff leave the student list without deleting history', () => {
  const students = [{ id: 's1', email: 'a@example.invalid' }, { id: 's2' }]
  assert.deepEqual(studentRoleRoster(students, [{ student_id: 's1', role: 'trainer' }]), [students[1]])
  assert.equal(students.length, 2)
  assert.deepEqual(studentRoleRoster(students, [{ student_id: 's1', role: 'student' }]), students)
})
test('legacy profile and normalized email links respect the current role', () => {
  const students = [{ id: 's1', profile_id: 'a1' }, { id: 's2', email: ' Staff@example.invalid ' }, { id: 'historical', email: null }]
  assert.deepEqual(studentRoleRoster(students, [{ id: 'a1', role: 'manager' }, { email: 'staff@example.invalid', role: 'trainer' }]), [students[2]])
})
