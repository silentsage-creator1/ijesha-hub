import type {
  Assessment,
  AssessmentAttempt,
  AssessmentQuestion,
  AssessmentType,
  AssessmentStatus,
  QuestionType,
} from '@/types'

export const ASSESSMENT_TYPES: AssessmentType[] = [
  'Quiz',
  'Test',
  'Practical Assessment',
  'Project Assessment',
  'Mid-Training Assessment',
  'Final Assessment',
  'Other',
]

export const QUESTION_TYPES: QuestionType[] = [
  'Multiple Choice',
  'True/False',
  'Short Answer',
  'Long Answer',
]

export const ASSESSMENT_STATUSES: AssessmentStatus[] = ['Draft', 'Published', 'Closed']

export const CYBER_FUNDAMENTALS_QUESTIONS: AssessmentQuestion[] = []

export const INITIAL_ASSESSMENTS: Assessment[] = []

export function generateSeedAttempts(_assessmentId: string): AssessmentAttempt[] {
  return []
}

const ASSESSMENTS_STORAGE_KEY = 'dtmp_assessments_v1'
const ATTEMPTS_STORAGE_KEY_PREFIX = 'dtmp_attempts_'

export function getStoredAssessments(): Assessment[] {
  try {
    const raw = localStorage.getItem(ASSESSMENTS_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed
      }
    }
  } catch {
    // fallback
  }
  return []
}

export function saveStoredAssessments(assessments: Assessment[]) {
  try {
    localStorage.setItem(ASSESSMENTS_STORAGE_KEY, JSON.stringify(assessments))
  } catch (err) {
    console.error('Failed to save assessments to localStorage', err)
  }
}

export function getStoredAttempts(assessmentId: string): AssessmentAttempt[] {
  try {
    const key = `${ATTEMPTS_STORAGE_KEY_PREFIX}${assessmentId}`
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed
      }
    }
  } catch {
    // fallback
  }
  return []
}

export function saveStoredAttempts(assessmentId: string, attempts: AssessmentAttempt[]) {
  try {
    const key = `${ATTEMPTS_STORAGE_KEY_PREFIX}${assessmentId}`
    localStorage.setItem(key, JSON.stringify(attempts))
  } catch (err) {
    console.error('Failed to save attempts to localStorage', err)
  }
}

export interface AssessmentStats {
  totalStudents: number
  started: number
  completed: number
  notStarted: number
  passed: number
  failed: number
  averageScore: number
  averagePercentage: number
  highestScore: number
  lowestScore: number
}

export function calculateAssessmentStats(
  attempts: AssessmentAttempt[],
  totalMarks: number = 40
): AssessmentStats {
  const totalStudents = attempts.length
  const completedAttempts = attempts.filter(a => a.status === 'Completed')
  const inProgressAttempts = attempts.filter(a => a.status === 'In Progress')
  const notStartedAttempts = attempts.filter(a => a.status === 'Not Started')

  const started = inProgressAttempts.length + completedAttempts.length
  const completed = completedAttempts.length
  const notStarted = notStartedAttempts.length

  const passed = completedAttempts.filter(a => a.result === 'Passed').length
  const failed = completedAttempts.filter(a => a.result === 'Failed').length

  const scores = completedAttempts
    .map(a => a.score)
    .filter((s): s is number => s !== null && s !== undefined)

  const averageScore = scores.length
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
    : 0

  const averagePercentage = totalMarks > 0 ? Math.round((averageScore / totalMarks) * 1000) / 10 : 0

  const highestScore = scores.length ? Math.max(...scores) : 0
  const lowestScore = scores.length ? Math.min(...scores) : 0

  return {
    totalStudents,
    started,
    completed,
    notStarted,
    passed,
    failed,
    averageScore,
    averagePercentage,
    highestScore,
    lowestScore,
  }
}

export function formatAssessmentDate(dateStr: string): string {
  if (!dateStr) return '—'
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return dateStr
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}
