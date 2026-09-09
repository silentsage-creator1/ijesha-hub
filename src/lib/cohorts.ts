import { apiUrl } from '@/app/auth'
import type { CourseOption } from '@/lib/courses'

export interface Cohort {
  id: string
  name: string
  course_id: string
  app_course_id?: string | null
  course_name: string
  starts_on: string | null
  ends_on: string | null
  created_at?: string
  status?: 'Active' | 'Upcoming' | 'Completed'
}
export const DEFAULT_COHORTS: Cohort[] = []
export function getCachedCohorts(): Cohort[] { return [] }
export function calculateCohortStatus(start: string | null, end: string | null): 'Active' | 'Upcoming' | 'Completed' {
  if (start && new Date(start) > new Date()) return 'Upcoming'
  if (end && new Date(end) < new Date()) return 'Completed'
  return 'Active'
}
export function getCourseNameById(id: string, courses?: CourseOption[]): string {
  return courses?.find(course => course.id === id)?.name ?? ''
}
export async function cohortRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), { ...init, credentials: 'include', headers: { 'content-type': 'application/json', ...init?.headers } })
  const payload = await response.json().catch(() => ({ error: 'The cohort service returned an invalid response.' }))
  if (!response.ok) throw new Error(payload.error || 'Unable to complete cohort request.')
  return payload as T
}
export async function getCohortWorkspace(): Promise<{ cohorts: Cohort[]; enrollments: { cohort_id: string; completion_status: string }[] }> {
  const data = await cohortRequest<{ cohorts: Cohort[]; enrollments: { cohort_id: string; completion_status: string }[] }>('/api/cohorts')
  return { ...data, cohorts: data.cohorts.map(c => ({ ...c, status: calculateCohortStatus(c.starts_on, c.ends_on) })) }
}
export async function getAllCohorts(): Promise<Cohort[]> { return (await getCohortWorkspace()).cohorts }
export async function saveCohort(params: { name: string; course_id: string; starts_on?: string | null; ends_on?: string | null }): Promise<{ data: Cohort | null; error: string | null }> {
  try {
    const result = await cohortRequest<{ cohort: Cohort }>('/api/cohorts', { method: 'POST', body: JSON.stringify({ ...params, app_course_id: params.course_id }) })
    window.dispatchEvent(new Event('cohorts-updated'))
    return { data: result.cohort, error: null }
  } catch (error) { return { data: null, error: error instanceof Error ? error.message : 'Unable to save cohort.' } }
}
export async function deleteCohort(id: string, _name?: string): Promise<{ error: string | null }> {
  try {
    await cohortRequest('/api/cohorts/' + encodeURIComponent(id), { method: 'DELETE' })
    window.dispatchEvent(new Event('cohorts-updated'))
    return { error: null }
  } catch (error) { return { error: error instanceof Error ? error.message : 'Unable to delete cohort.' } }
}
export async function getStudentCohort(_studentId: string): Promise<Cohort | null> {
  return (await cohortRequest<{ cohort: Cohort | null }>('/api/student/cohort')).cohort
}
