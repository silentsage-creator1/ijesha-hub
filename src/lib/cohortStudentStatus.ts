const normalized = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase() : ''

export function cohortStudentStatus(status: unknown, enrollmentStatus: unknown): string {
  if (normalized(enrollmentStatus) === 'completed') return 'graduated'
  return normalized(status) || 'unknown'
}

export function isPastStudentStatus(status: unknown): boolean {
  return ['graduated', 'withdrawn', 'paused', 'completed', 'alumni', 'inactive'].includes(normalized(status))
}

export function studentStatusLabel(status: unknown): string {
  const value = normalized(status)
  return value === 'paused' ? 'Inactive' : value === 'graduated' || value === 'completed' ? 'Completed' : !value || value === 'unknown' ? 'Unknown' : value
}
