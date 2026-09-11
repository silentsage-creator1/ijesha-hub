// Preserve historical roster rows, but do not list staff as current students.
export function studentRoleRoster(students, accounts) {
  const byStudent = new Map(accounts.filter(a => a.student_id).map(a => [a.student_id, a]))
  const byId = new Map(accounts.filter(a => a.id).map(a => [a.id, a]))
  const emailKey = value => typeof value === 'string' ? value.trim().toLowerCase() : ''
  const byEmail = new Map(accounts.filter(a => emailKey(a.email)).map(a => [emailKey(a.email), a]))
  return students.filter(student => {
    const account = byStudent.get(student.id) || byId.get(student.profile_id) || byEmail.get(emailKey(student.email))
    return !account || account.role === 'student'
  })
}
