import test from 'node:test'
import assert from 'node:assert/strict'
import { requiredStudentFields, studentProfileComplete } from './profile-completion.mjs'
const complete = Object.fromEntries(requiredStudentFields.map(key => [key,'Filled']))
test('new and partially completed profiles keep the warning',()=>{
  assert.equal(studentProfileComplete({},null),false)
  assert.equal(studentProfileComplete(complete,null),false)
  for(const key of requiredStudentFields) assert.equal(studentProfileComplete({...complete,[key]:'  '},'photo'),false)
})
test('warning clears only after all required details and photo are saved',()=>{
  assert.equal(studentProfileComplete(complete,'photo'),true)
})
