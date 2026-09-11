export function trackCourse(value: unknown): string {
  const key = typeof value === 'string' ? value.toLowerCase().replace(/[^a-z0-9]/g, '') : ''
  if (['frontenddevelopment', 'backenddevelopment', 'softwaredevelopment'].includes(key)) return 'softwaredevelopment'
  return key
}
