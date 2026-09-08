export interface ClassworkResource {
  id: string
  name: string
  type: string
  size: string
  url?: string
  content?: string
}

export type ClassworkSubmissionMethod = 'Text' | 'File' | 'Both'

export interface ClassworkItem {
  id: string
  title: string
  course_id: string
  course_name: string
  cohort_id: string
  cohort_name: string
  trainer_id: string
  trainer_name: string
  assigned_date: string
  due_date: string
  instructions: string
  submission_method: ClassworkSubmissionMethod
  maximum_marks: number
  resources: ClassworkResource[]
  allow_resubmission: boolean
  status: 'Published' | 'Draft'
  created_at: string
}

export type StudentClassworkStatus =
  | 'To Do'
  | 'In Progress'
  | 'Submitted'
  | 'Completed'
  | 'Overdue'

export interface UploadedFileItem {
  id: string
  name: string
  size: string
  type: string
  uploaded_at: string
  url?: string
  data?: string
}

export type SubmissionState = 'Draft' | 'In Progress' | 'Submitted' | 'Graded' | 'Revision Required'

export interface StudentSubmission {
  id: string
  classwork_id: string
  student_id: string
  student_name: string
  student_email: string
  status: SubmissionState
  response_text: string
  uploaded_files: UploadedFileItem[]
  saved_at: string
  submitted_at: string | null
  graded_at: string | null
  graded_by: string | null
  score: number | null
  feedback: string | null
  areas_for_improvement: string | null
  resubmission_permitted: boolean
  resubmission_count: number
}

const CLASSWORK_STORAGE_KEY = 'ijesha_hub_classwork_items_v2'
const SUBMISSIONS_STORAGE_KEY = 'ijesha_hub_classwork_submissions_v2'

export const INITIAL_CLASSWORK_ITEMS: ClassworkItem[] = []

export function getStoredClasswork(): ClassworkItem[] {
  try {
    const raw = localStorage.getItem(CLASSWORK_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ClassworkItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveStoredClasswork(items: ClassworkItem[]): void {
  try {
    localStorage.setItem(CLASSWORK_STORAGE_KEY, JSON.stringify(items))
  } catch (err) {
    console.error('Failed to save classwork', err)
  }
}

export function getStoredSubmissions(): StudentSubmission[] {
  try {
    const raw = localStorage.getItem(SUBMISSIONS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as StudentSubmission[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveStoredSubmissions(submissions: StudentSubmission[]): void {
  try {
    localStorage.setItem(SUBMISSIONS_STORAGE_KEY, JSON.stringify(submissions))
  } catch (err) {
    console.error('Failed to save submissions', err)
  }
}

export function getStudentSubmission(
  classworkId: string,
  studentId: string
): StudentSubmission | null {
  if (!studentId) return null
  const all = getStoredSubmissions()
  return (
    all.find(
      (s) => s.classwork_id === classworkId && s.student_id === studentId
    ) || null
  )
}

export function saveOrUpdateStudentSubmission(
  submission: StudentSubmission
): void {
  const all = getStoredSubmissions()
  const index = all.findIndex(
    (s) =>
      s.classwork_id === submission.classwork_id &&
      s.student_id === submission.student_id
  )
  if (index >= 0) {
    all[index] = submission
  } else {
    all.push(submission)
  }
  saveStoredSubmissions(all)
}

/**
 * Determine a student's computed status for a classwork item:
 * 'To Do' | 'In Progress' | 'Submitted' | 'Completed' | 'Overdue'
 */
export function computeStudentClassworkStatus(
  item: ClassworkItem,
  submission: StudentSubmission | null
): StudentClassworkStatus {
  if (submission) {
    if (submission.score !== null && submission.score !== undefined) {
      return 'Completed'
    }
    if (submission.status === 'Submitted') {
      return 'Submitted'
    }
    if (submission.status === 'Draft' || submission.status === 'In Progress') {
      return 'In Progress'
    }
  }

  // Check if overdue
  if (item.due_date) {
    const dueDate = new Date(item.due_date)
    // Set due date to end of day
    dueDate.setHours(23, 59, 59, 999)
    if (new Date() > dueDate) {
      return 'Overdue'
    }
  }

  return 'To Do'
}

export function formatDueDate(dateStr: string): string {
  if (!dateStr) return 'No due date'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    })
  } catch {
    return dateStr
  }
}
