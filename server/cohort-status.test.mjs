import test from 'node:test'
import assert from 'node:assert/strict'
import { cohortStudentStatus, isPastStudentStatus, studentStatusLabel } from '../src/lib/cohortStudentStatus.ts'

test('null cohort student status renders safely without inventing graduation',()=>{
  for(const value of [null,undefined,'',42]) {
    assert.equal(cohortStudentStatus(value,null),'unknown')
    assert.equal(isPastStudentStatus(value),false)
    assert.equal(studentStatusLabel(value),'Unknown')
  }
})
test('completed enrollment remains historical even with a missing or active student status',()=>{
  for(const value of [null,'active']) {
    const status=cohortStudentStatus(value,'completed')
    assert.equal(isPastStudentStatus(status),true)
    assert.equal(studentStatusLabel(status),'Completed')
  }
})
test('existing statuses remain usable in cohort filters',()=>{
  assert.equal(isPastStudentStatus('PAUSED'),true)
  assert.equal(studentStatusLabel('paused'),'Inactive')
  assert.equal(cohortStudentStatus('active','in_progress'),'active')
})
