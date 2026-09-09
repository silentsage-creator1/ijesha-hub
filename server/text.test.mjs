import test from 'node:test'
import assert from 'node:assert/strict'
import { safeText, searchText, sameNonEmptyText } from '../src/lib/text.ts'

test('nullable legacy student values are safe to search and display',()=>{
  for(const value of [null,undefined,0,{},[]]) {
    assert.equal(safeText(value),'')
    assert.equal(searchText(value),'')
  }
  assert.equal(searchText('Student Name'),'student name')
})
test('missing names and emails never identify the same student',()=>{
  assert.equal(sameNonEmptyText(null,null),false)
  assert.equal(sameNonEmptyText(undefined,''),false)
  assert.equal(sameNonEmptyText('  ',null),false)
  assert.equal(sameNonEmptyText(null,'Student'),false)
  assert.equal(sameNonEmptyText(' Student ','student'),true)
  assert.equal(sameNonEmptyText('Student A','Student B'),false)
})
