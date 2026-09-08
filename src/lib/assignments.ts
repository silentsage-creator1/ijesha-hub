import type {
  Assignment,
  AssignmentSubmission,
  AssignmentType,
  SubmissionType,
  AssignmentResource,
} from '@/types'

export const ASSIGNMENT_TYPES: AssignmentType[] = [
  'Individual Assignment',
  'Practical Assignment',
  'Written Assignment',
  'Research',
  'Quiz',
  'Classwork',
  'Other',
]

export const SUBMISSION_TYPES: SubmissionType[] = [
  'File Upload',
  'Text Submission',
  'File + Text',
  'Link Submission',
]

const STORAGE_KEY = 'ijesha_hub_assignments'
const SUBMISSIONS_STORAGE_KEY = 'ijesha_hub_assignment_submissions'

export const SAMPLE_RESOURCES: AssignmentResource[] = []

export const INITIAL_ASSIGNMENTS: Assignment[] = []

export function generateInitialSubmissions(_assignmentId: string): AssignmentSubmission[] {
  return []
}

// Local cache helpers
export function getStoredAssignments(): Assignment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw) as Assignment[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveStoredAssignments(assignments: Assignment[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments))
  } catch (err) {
    console.error('Failed to save assignments to local cache', err)
  }
}

export function getStoredSubmissions(assignmentId: string): AssignmentSubmission[] {
  try {
    const raw = localStorage.getItem(`${SUBMISSIONS_STORAGE_KEY}_${assignmentId}`)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw) as AssignmentSubmission[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveStoredSubmissions(assignmentId: string, submissions: AssignmentSubmission[]): void {
  try {
    localStorage.setItem(`${SUBMISSIONS_STORAGE_KEY}_${assignmentId}`, JSON.stringify(submissions))
  } catch (err) {
    console.error('Failed to save submissions to local cache', err)
  }
}

export function formatAssignmentDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'No due date'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: d.getFullYear() !== 2026 ? 'numeric' : undefined })
  } catch {
    return dateStr
  }
}

export function calculateSubmissionStats(submissions: AssignmentSubmission[]) {
  const submitted = submissions.filter(s => s.status === 'Submitted' || s.status === 'Graded').length
  const notSubmitted = submissions.filter(s => s.status === 'Not Started' || s.status === 'In Progress').length
  const graded = submissions.filter(s => s.status === 'Graded').length
  return { submitted, notSubmitted, graded, total: submissions.length }
}
