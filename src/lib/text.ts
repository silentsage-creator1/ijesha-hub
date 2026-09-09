/** Database and older browser records may contain null despite frontend types. */
export function safeText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
export function searchText(value: unknown): string {
  return safeText(value).toLowerCase()
}
export function sameNonEmptyText(left: unknown, right: unknown): boolean {
  const a = searchText(left).trim()
  const b = searchText(right).trim()
  return a.length > 0 && b.length > 0 && a === b
}
