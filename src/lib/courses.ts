export interface CourseOption { id: string; name: string }

export const OFFICIAL_COURSE_NAMES = ['Cybersecurity', 'Data Analytics', 'Product Design', 'Software Development'] as const
const officialNameByKey = new Map(OFFICIAL_COURSE_NAMES.map((name) => [name.toLowerCase(), name]))

export const DEFAULT_OFFICIAL_COURSES: CourseOption[] = [
  { id: 'course-cybersecurity', name: 'Cybersecurity' },
  { id: 'course-data-analytics', name: 'Data Analytics' },
  { id: 'course-product-design', name: 'Product Design' },
  { id: 'course-software-dev', name: 'Software Development' },
]

/** Present each course name once even if legacy data contains duplicate rows. */
export function uniqueCourses<T extends CourseOption>(courses: T[]): T[] {
  const seen = new Set<string>()
  return courses.filter((course) => {
    const key = course.name.trim().toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Restrict the app to IJESHA DIGITAL HUB's four official courses and hide
 * duplicate legacy rows while retaining the canonical display spelling. */
export function officialCourses<T extends CourseOption>(courses: T[]): T[] {
  const filtered = uniqueCourses(courses)
    .filter((course) => officialNameByKey.has(course.name.trim().toLowerCase()))
    .map((course) => ({ ...course, name: officialNameByKey.get(course.name.trim().toLowerCase())! }))

  return filtered
}
