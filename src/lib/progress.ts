export type ProgressTrend = 'Increasing' | 'Staying the same' | 'Falling behind'

export interface WeeklyCohortProgress {
  week: number
  overallProgress: number
  trainingSessions: { completed: number; total: number }
  attendanceRate: number
  assignments: { completed: number; total: number }
  projects: { completed: number; total: number }
  assessments: { completed: number; total: number }
  topicsCovered: string[]
  keyMilestone: string
}

export interface ProgressHistoryItem {
  id: string
  studentId: string
  week: number
  title: string
  details: string
  progressPercentage: number
  recordedAt: string
}

export interface StudentProgressRecord {
  id: string
  studentName: string
  studentEmail?: string
  cohort: string
  course: string
  status: 'On Track' | 'At Risk' | 'Completed'
  overallProgress: number
  attendanceRate: number
  assignmentsProgress: number
  projectsProgress: number
  assessmentsProgress: number
  trainingSessionsProgress: number
  
  // Detailed breakdown counts
  trainingSessionsCount: { completed: number; total: number }
  assignmentsCount: { completed: number; total: number }
  projectsCount: { completed: number; total: number }
  assessmentsCount: { completed: number; total: number }
  
  // Weekly progress history points
  weeklyProgressPoints: { week: number; progress: number }[]
  
  // Chronological history events
  history: ProgressHistoryItem[]
}

export interface CohortProgressOverviewData {
  cohortName: string
  courseName: string
  overallProgress: number
  studentsOnTrack: number
  studentsAtRisk: number
  completed: number
  averageAttendance: number
  weeks: WeeklyCohortProgress[]
  students: StudentProgressRecord[]
}

const STORAGE_KEY = 'ijesha_hub_progress_data_v2'

export const INITIAL_WEEKLY_PROGRESS: WeeklyCohortProgress[] = []

export function generateInitialStudents(): StudentProgressRecord[] {
  return []
}

export function getStoredCohortProgress(): CohortProgressOverviewData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as CohortProgressOverviewData
      if (parsed && Array.isArray(parsed.students) && Array.isArray(parsed.weeks)) {
        return parsed
      }
    }
  } catch (e) {
    console.error('Error loading stored progress', e)
  }

  return {
    cohortName: '',
    courseName: '',
    overallProgress: 0,
    studentsOnTrack: 0,
    studentsAtRisk: 0,
    completed: 0,
    averageAttendance: 0,
    weeks: [],
    students: [],
  }
}

export function saveCohortProgress(data: CohortProgressOverviewData): void {
  try {
    const totalStudents = data.students.length || 1
    const avgProg = data.students.length
      ? Math.round(data.students.reduce((acc, s) => acc + s.overallProgress, 0) / totalStudents)
      : 0
    const avgAtt = data.students.length
      ? Math.round(data.students.reduce((acc, s) => acc + s.attendanceRate, 0) / totalStudents)
      : 0
    const onTrack = data.students.filter((s) => s.status === 'On Track').length
    const atRisk = data.students.filter((s) => s.status === 'At Risk').length
    const completed = data.students.filter((s) => s.status === 'Completed').length

    const updatedData: CohortProgressOverviewData = {
      ...data,
      overallProgress: avgProg,
      averageAttendance: avgAtt,
      studentsOnTrack: onTrack,
      studentsAtRisk: atRisk,
      completed: completed,
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData))
  } catch (e) {
    console.error('Error saving progress data', e)
  }
}

export function getProgressTrend(weeks: { week: number; overallProgress: number }[]): {
  trend: ProgressTrend
  delta: number
} {
  if (weeks.length < 2) {
    return { trend: 'Staying the same', delta: 0 }
  }
  const last = weeks[weeks.length - 1].overallProgress
  const prev = weeks[weeks.length - 2].overallProgress
  const delta = last - prev

  if (delta > 2) return { trend: 'Increasing', delta }
  if (delta < -2) return { trend: 'Falling behind', delta }
  return { trend: 'Staying the same', delta }
}
