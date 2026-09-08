import { supabase, supabaseConfigured } from '@/lib/supabase'
import { DEFAULT_OFFICIAL_COURSES, type CourseOption } from '@/lib/courses'

export interface Cohort {
  id: string
  name: string
  course_id: string
  course_name: string
  starts_on: string | null
  ends_on: string | null
  created_at?: string
  status?: 'Active' | 'Upcoming' | 'Completed'
}

const STORAGE_KEY = 'ijesha_hub_cohorts_v2'
const DELETED_STORAGE_KEY = 'ijesha_hub_deleted_cohorts_v2'

export const DEFAULT_COHORTS: Cohort[] = []

export function getDeletedCohortIdentifiers(): { ids: Set<string>; names: Set<string> } {
  try {
    const raw = localStorage.getItem(DELETED_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        ids: new Set<string>(parsed.ids || []),
        names: new Set<string>((parsed.names || []).map((n: string) => n.trim().toLowerCase())),
      }
    }
  } catch {
    // Ignore error
  }
  return { ids: new Set<string>(), names: new Set<string>() }
}

export function markCohortDeleted(id: string, name?: string): void {
  try {
    const { ids, names } = getDeletedCohortIdentifiers()
    if (id) ids.add(id)
    if (name) names.add(name.trim().toLowerCase())
    localStorage.setItem(
      DELETED_STORAGE_KEY,
      JSON.stringify({
        ids: Array.from(ids),
        names: Array.from(names),
      })
    )
  } catch {
    // Ignore error
  }
}

export function unmarkCohortDeleted(id: string, name?: string): void {
  try {
    const { ids, names } = getDeletedCohortIdentifiers()
    if (id) ids.delete(id)
    if (name) names.delete(name.trim().toLowerCase())
    localStorage.setItem(
      DELETED_STORAGE_KEY,
      JSON.stringify({
        ids: Array.from(ids),
        names: Array.from(names),
      })
    )
  } catch {
    // Ignore error
  }
}

export function getCachedCohorts(): Cohort[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Cohort[]
      if (Array.isArray(parsed)) {
        const { ids: deletedIds, names: deletedNames } = getDeletedCohortIdentifiers()
        return parsed.filter(
          (c) => !deletedIds.has(c.id) && !deletedNames.has(c.name.trim().toLowerCase())
        )
      }
    }
  } catch {
    // Ignore error
  }
  return []
}

export function saveCachedCohorts(cohorts: Cohort[]): void {
  try {
    const { ids: deletedIds, names: deletedNames } = getDeletedCohortIdentifiers()
    const cleaned = cohorts.filter(
      (c) => !deletedIds.has(c.id) && !deletedNames.has(c.name.trim().toLowerCase())
    )
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned))
    window.dispatchEvent(new CustomEvent('cohorts-updated', { detail: cleaned }))
  } catch {
    // Ignore error
  }
}

/** Determine cohort status from dates */
export function calculateCohortStatus(
  startsOn: string | null,
  endsOn: string | null
): 'Active' | 'Upcoming' | 'Completed' {
  const now = new Date()
  if (startsOn && new Date(startsOn) > now) {
    return 'Upcoming'
  }
  if (endsOn && new Date(endsOn) < now) {
    return 'Completed'
  }
  return 'Active'
}

/** Resolve human-readable course name from course ID */
export function getCourseNameById(courseId: string, courses?: CourseOption[]): string {
  const foundInParam = courses?.find((c) => c.id === courseId)
  if (foundInParam) return foundInParam.name

  const foundInDefault = DEFAULT_OFFICIAL_COURSES.find((c) => c.id === courseId)
  if (foundInDefault) return foundInDefault.name

  return ''
}

/** Fetch all cohorts from Supabase, gracefully merging with shared storage & defaults */
export async function getAllCohorts(): Promise<Cohort[]> {
  const cached = getCachedCohorts()
  const { ids: deletedIds, names: deletedNames } = getDeletedCohortIdentifiers()
  let dbCohorts: any[] = []
  let coursesMap = new Map<string, string>()

  try {
    // Attempt to load courses and cohorts
    const [cRes, cohRes] = await Promise.all([
      supabase.from('courses').select('id, name'),
      supabase
        .from('cohorts')
        .select('id, name, course_id, starts_on, ends_on, created_at, courses(id, name)')
        .order('name'),
    ])

    if (cRes.data) {
      for (const c of cRes.data) {
        coursesMap.set(c.id, c.name)
      }
    }

    if (cohRes.data && cohRes.data.length > 0) {
      dbCohorts = cohRes.data
    }
  } catch {
    // Offline or network error
  }

  const merged = new Map<string, Cohort>()

  // 1. Put cached cohorts first (ignoring deleted)
  for (const c of cached) {
    if (deletedIds.has(c.id) || deletedNames.has(c.name.trim().toLowerCase())) continue
    merged.set(c.id, c)
    merged.set(c.name.trim().toLowerCase(), c)
  }

  // 2. Overlay DB cohorts (ignoring deleted)
  for (const row of dbCohorts) {
    if (deletedIds.has(row.id) || deletedNames.has(row.name?.trim().toLowerCase())) continue

    const courseName =
      row.courses?.name || coursesMap.get(row.course_id) || getCourseNameById(row.course_id)

    const cohortItem: Cohort = {
      id: row.id,
      name: row.name,
      course_id: row.course_id,
      course_name: courseName,
      starts_on: row.starts_on ?? null,
      ends_on: row.ends_on ?? null,
      created_at: row.created_at,
      status: calculateCohortStatus(row.starts_on, row.ends_on),
    }

    merged.set(row.id, cohortItem)
    merged.set(row.name.trim().toLowerCase(), cohortItem)
  }

  // 3. Ensure default cohorts exist if list is sparse and not deleted
  for (const def of DEFAULT_COHORTS) {
    const norm = def.name.trim().toLowerCase()
    if (!deletedIds.has(def.id) && !deletedNames.has(norm) && !merged.has(norm)) {
      merged.set(def.id, def)
    }
  }

  const result = Array.from(
    new Map(
      Array.from(merged.values())
        .filter((c) => !deletedIds.has(c.id) && !deletedNames.has(c.name.trim().toLowerCase()))
        .map((c) => [c.name.trim().toLowerCase(), c])
    ).values()
  )

  saveCachedCohorts(result)
  return result
}

/** Save a new cohort both in Supabase and shared local storage */
export async function saveCohort(params: {
  name: string
  course_id: string
  starts_on?: string | null
  ends_on?: string | null
}): Promise<{ data: Cohort | null; error: string | null }> {
  const name = params.name.trim()
  if (!name) return { data: null, error: 'Cohort name is required.' }

  // Unmark if previously deleted
  unmarkCohortDeleted('', name)

  // Resolve course name
  const courseName = getCourseNameById(params.course_id)

  // Resolve valid UUID for course_id if Supabase has courses
  let validCourseUuid = params.course_id
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.course_id)

  if (!isUuid) {
    try {
      const { data: dbCourse } = await supabase
        .from('courses')
        .select('id, name')
        .ilike('name', `%${courseName}%`)
        .limit(1)
        .maybeSingle()

      if (dbCourse?.id) {
        validCourseUuid = dbCourse.id
      }
    } catch {
      // Continue
    }
  }

  const generatedId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `cohort-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`

  const newCohort: Cohort = {
    id: generatedId,
    name,
    course_id: validCourseUuid,
    course_name: courseName,
    starts_on: params.starts_on || null,
    ends_on: params.ends_on || null,
    created_at: new Date().toISOString(),
    status: calculateCohortStatus(params.starts_on || null, params.ends_on || null),
  }

  // Attempt database insert
  let dbError: string | null = null
  try {
    const isRealUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(validCourseUuid)
    if (isRealUuid) {
      const { data, error } = await supabase
        .from('cohorts')
        .insert({
          name,
          course_id: validCourseUuid,
          starts_on: params.starts_on || null,
          ends_on: params.ends_on || null,
        })
        .select('id, name, course_id, starts_on, ends_on, created_at')
        .single()

      if (!error && data) {
        newCohort.id = data.id
      } else if (error) {
        dbError = error.message
      }
    }
  } catch (err: any) {
    dbError = err?.message || 'Database error'
  }

  if (dbError) {
    console.warn('Failed to insert cohort into database:', dbError)
  }

  // Persist into shared cached cohorts
  const existing = getCachedCohorts()
  const updated = [newCohort, ...existing.filter((c) => c.name.toLowerCase() !== name.toLowerCase())]
  saveCachedCohorts(updated)

  return { data: newCohort, error: null }
}

/** Delete a cohort cleanly across database dependencies and local state */
export async function deleteCohort(id: string, name?: string): Promise<{ error: string | null }> {
  // 1. Locate cohort details
  const existing = getCachedCohorts()
  const target = existing.find(
    (c) => c.id === id || (name && c.name.toLowerCase() === name.toLowerCase())
  )
  const cohortName = name || target?.name || ''
  const cohortId = target?.id || id

  // Immediately tombstone so it won't re-appear from local cache or default seeds
  markCohortDeleted(cohortId, cohortName)

  // Immediately filter from cached storage
  const updated = existing.filter(
    (c) =>
      c.id !== cohortId &&
      (!cohortName || c.name.trim().toLowerCase() !== cohortName.trim().toLowerCase())
  )
  saveCachedCohorts(updated)

  // 2. Cascade delete on Supabase database if configured
  if (supabaseConfigured) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cohortId)

      // Try specialized cascade RPC if available
      if (isUuid) {
        const { error: rpcError } = await supabase.rpc('delete_cohort_cascade', {
          target_cohort_id: cohortId,
        })
        if (!rpcError) {
          window.dispatchEvent(new CustomEvent('cohorts-updated'))
          return { error: null }
        }
      }

      // If RPC is absent or failed, perform manual cascade cleanup:
      let dbCohortId = isUuid ? cohortId : null
      if (!dbCohortId && cohortName) {
        const { data: dbRow } = await supabase
          .from('cohorts')
          .select('id')
          .ilike('name', cohortName)
          .maybeSingle()
        if (dbRow?.id) dbCohortId = dbRow.id
      }

      if (dbCohortId) {
        // A. Delete attendance for this cohort
        await supabase.from('attendance').delete().eq('cohort_id', dbCohortId)

        // B. Delete training sessions
        await supabase.from('training_sessions').delete().eq('cohort_id', dbCohortId)

        // C. Delete assignments
        await supabase.from('assignments').delete().eq('cohort_id', dbCohortId)

        // D. Delete announcements
        await supabase.from('announcements').delete().eq('cohort_id', dbCohortId)

        // E. Delete assessments
        await supabase.from('assessments').delete().eq('cohort_id', dbCohortId)

        // F. Delete sponsor assignments & sponsorships
        await supabase.from('sponsor_assignments').delete().eq('cohort_id', dbCohortId)
        await supabase.from('sponsorships').delete().eq('cohort_id', dbCohortId)

        // G. Delete cohort schedules
        await supabase.from('cohort_schedules').delete().eq('cohort_id', dbCohortId)

        // H. Delete enrollments (which has foreign key constraint restricting cohort delete)
        await supabase.from('enrollments').delete().eq('cohort_id', dbCohortId)

        // I. Clear student roster cohort reference so students don't point to a deleted cohort
        if (cohortName) {
          await supabase.from('students').update({ cohort: null }).ilike('cohort', cohortName)
        }

        // J. Delete the cohort itself
        const { error: delErr } = await supabase.from('cohorts').delete().eq('id', dbCohortId)
        if (delErr) {
          console.warn('Supabase cohort delete error:', delErr.message)
          // If foreign key still restricted, report the exact error
          return { error: delErr.message }
        }
      } else if (cohortName) {
        // Attempt name match if id was generated locally
        await supabase.from('cohorts').delete().ilike('name', cohortName)
        await supabase.from('students').update({ cohort: null }).ilike('cohort', cohortName)
      }
    } catch (err: any) {
      console.warn('Cohort delete exception:', err)
      return { error: err?.message || 'Error deleting cohort from database.' }
    }
  }

  window.dispatchEvent(new CustomEvent('cohorts-updated'))
  return { error: null }
}

/** Retrieve the cohort for a student by profile or student ID */
export async function getStudentCohort(studentProfileIdOrStudentId: string): Promise<Cohort | null> {
  const all = await getAllCohorts()

  try {
    // 1. Check students table
    const { data: st } = await supabase
      .from('students')
      .select('id, cohort, track')
      .or(`id.eq.${studentProfileIdOrStudentId},profile_id.eq.${studentProfileIdOrStudentId}`)
      .maybeSingle()

    if (st?.cohort) {
      const matched = all.find(
        (c) =>
          c.name.trim().toLowerCase() === st.cohort.trim().toLowerCase() ||
          c.id === st.cohort
      )
      if (matched) return matched
    }

    // 2. Check enrollments table
    if (st?.id) {
      const { data: enr } = await supabase
        .from('enrollments')
        .select('cohort_id')
        .eq('student_id', st.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (enr?.cohort_id) {
        const matched = all.find((c) => c.id === enr.cohort_id)
        if (matched) return matched
      }
    }

    // 3. Match by track
    if (st?.track) {
      const trackLower = st.track.toLowerCase()
      const matched = all.find((c) => {
        const cCourse = c.course_name.toLowerCase()
        return (
          cCourse.includes(trackLower) ||
          trackLower.includes(cCourse) ||
          (trackLower.includes('frontend') && cCourse.includes('software')) ||
          (trackLower.includes('design') && cCourse.includes('product'))
        )
      })
      if (matched) return matched
    }
  } catch {
    // Continue to fallback
  }

  // Fallback to first active cohort
  return all[0] ?? DEFAULT_COHORTS[0]
}
