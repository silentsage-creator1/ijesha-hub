export interface WeeklyAttendanceSummary {
  week: number
  dates: string
  sessionsHeld: number
  attended: number
  late: number
  absent: number
  rate: number
}

export interface AssignmentPerformanceItem {
  name: string
  week: number
  score: number
  maxScore: number
  status: string
}

export interface ProjectPerformanceItem {
  name: string
  week: number
  score: number
  maxScore: number
  status: string
}

export interface AssessmentPerformanceItem {
  name: string
  week: number
  score: number
  percentage: number
  result: string
}

export interface WeeklyProgressRow {
  week: number
  progress: number
  attendance: number
  assignments: string
  projects: string
  assessments: string
}

export interface TrainerEvaluation {
  summary: string
  strengths: string
  areas_for_improvement: string
  recommendations: string
  next_steps: string
}

export interface ReportAuditItem {
  id: string
  action: 'created' | 'updated' | 'published' | 'unpublished' | 'downloaded' | 'shared'
  actor_name: string
  actor_role: string
  timestamp: string
  method?: string
  recipient?: string
  details?: string
}

export interface ProgressReport {
  id: string
  student_id: string
  student_name: string
  student_email?: string
  guardian_name?: string
  guardian_email?: string
  guardian_phone?: string
  course_name: string
  cohort_name: string
  reporting_period: string
  student_status: 'On Track' | 'At Risk' | 'Completed' | 'Active'
  status: 'draft' | 'published'
  created_at: string
  published_at: string | null
  updated_at: string
  trainer_name: string
  
  // Executive progress summary metrics
  metrics: {
    overall_progress: number
    attendance_rate: number
    assignment_performance: number
    project_performance: number
    assessment_performance: number
    training_progress: number
  }

  // Progress over weeks data points for graph
  weekly_progress_graph: Array<{ week: number; progress: number }>

  // Attendance summary
  attendance_summary: {
    rate: number
    sessions_attended: number
    sessions_absent: number
    sessions_late: number
    excused_sessions: number
    weekly: WeeklyAttendanceSummary[]
  }

  // Performance tables
  assignments: AssignmentPerformanceItem[]
  projects: ProjectPerformanceItem[]
  assessments: AssessmentPerformanceItem[]
  weekly_progress: WeeklyProgressRow[]

  // Qualitative trainer evaluation
  evaluation: TrainerEvaluation

  // Audit trail for downloads and shares
  audit_trail: ReportAuditItem[]
}

const STORAGE_KEY = 'ijesha_hub_progress_reports_v2'

export const INITIAL_PROGRESS_REPORTS: ProgressReport[] = []

export function getStoredReports(): ProgressReport[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
    return []
  } catch {
    return []
  }
}

export function saveStoredReports(reports: ProgressReport[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports))
  } catch (err) {
    console.warn('Failed to save progress reports:', err)
  }
}

export function getReportById(id: string): ProgressReport | undefined {
  const list = getStoredReports()
  return list.find((r) => r.id === id)
}

export function updateReport(report: ProgressReport, actor: { name: string; role: string }): ProgressReport {
  const list = getStoredReports()
  const updatedReport: ProgressReport = {
    ...report,
    updated_at: new Date().toISOString(),
    audit_trail: [
      {
        id: `aud-${Date.now()}`,
        action: 'updated',
        actor_name: actor.name,
        actor_role: actor.role,
        timestamp: new Date().toISOString(),
        details: 'Report details and evaluation content updated.',
      },
      ...report.audit_trail,
    ],
  }
  const index = list.findIndex((r) => r.id === report.id)
  if (index >= 0) {
    list[index] = updatedReport
  } else {
    list.unshift(updatedReport)
  }
  saveStoredReports(list)
  return updatedReport
}

export function togglePublishReport(reportId: string, actor: { name: string; role: string }): ProgressReport | null {
  const list = getStoredReports()
  const report = list.find((r) => r.id === reportId)
  if (!report) return null

  const isPublishing = report.status !== 'published'
  const updated: ProgressReport = {
    ...report,
    status: isPublishing ? 'published' : 'draft',
    published_at: isPublishing ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
    audit_trail: [
      {
        id: `aud-${Date.now()}`,
        action: isPublishing ? 'published' : 'unpublished',
        actor_name: actor.name,
        actor_role: actor.role,
        timestamp: new Date().toISOString(),
        details: isPublishing
          ? 'Published officially for student, parent, and sponsor viewing.'
          : 'Reverted to draft status.',
      },
      ...report.audit_trail,
    ],
  }

  const idx = list.findIndex((r) => r.id === reportId)
  list[idx] = updated
  saveStoredReports(list)
  return updated
}

export function logReportAudit(
  reportId: string,
  action: 'downloaded' | 'shared',
  actor: { name: string; role: string },
  details?: { method?: string; recipient?: string; note?: string }
): ProgressReport | null {
  const list = getStoredReports()
  const report = list.find((r) => r.id === reportId)
  if (!report) return null

  const updated: ProgressReport = {
    ...report,
    audit_trail: [
      {
        id: `aud-${Date.now()}`,
        action,
        actor_name: actor.name,
        actor_role: actor.role,
        timestamp: new Date().toISOString(),
        method: details?.method,
        recipient: details?.recipient,
        details: details?.note || (action === 'downloaded' ? 'Official PDF document generated and downloaded.' : `Shared via ${details?.method ?? 'link'} to ${details?.recipient ?? 'authorized recipient'}.`),
      },
      ...report.audit_trail,
    ],
  }

  const idx = list.findIndex((r) => r.id === reportId)
  list[idx] = updated
  saveStoredReports(list)
  return updated
}
