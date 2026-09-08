import {
  getStoredClasswork,
  getStoredSubmissions,
  saveOrUpdateStudentSubmission,
  type StudentSubmission,
  type UploadedFileItem,
} from './classwork'

export interface GradedItem {
  id: string
  source_id: string
  title: string
  course_id: string
  course_name: string
  cohort_name: string
  student_id?: string
  item_type: 'Classwork' | 'Project' | 'Assignment' | 'Assessment'
  trainer_name: string
  trainer_avatar?: string
  assigned_date: string
  submitted_at: string | null
  graded_at: string | null
  status: 'Graded' | 'Pending Review' | 'Revision Required' | 'To Do'
  score: number | null
  maximum_marks: number
  percentage: number | null
  letter_grade: string | null
  feedback: string | null
  areas_for_improvement: string | null
  allow_resubmission: boolean
  resubmission_count: number
  submission_details: {
    response_text: string
    files: Array<{ name: string; size: string; url?: string }>
    links: string[]
    resubmission_notes?: string
  }
}

export interface CourseResult {
  course_id: string
  course_name: string
  course_code: string
  cohort_id: string
  cohort_name: string
  trainer_name: string
  status: 'Active' | 'Completed'
  overall_score: number
  overall_grade: string
  letter_grade: string
  assessments_score: number
  classwork_score: number
  projects_score: number
  performance_status: 'Exceeding Expectations' | 'On Track' | 'Needs Attention'
  completion_percent: number
  attendance_percent: number
  summary_feedback: string
  assessment_breakdown: {
    title: string
    type: 'Quiz' | 'Midterm' | 'Final Exam' | 'Practical'
    weight_percent: number
    score: number
    max_score: number
    date: string
  }[]
  classwork_performance: {
    title: string
    type: 'Assignment' | 'Lab' | 'Exercise'
    score: number
    max_score: number
    status: 'Completed' | 'In Progress'
    date: string
  }[]
  project_performance: {
    title: string
    type: 'Milestone' | 'Capstone' | 'Deliverable'
    score: number
    max_score: number
    weight_percent: number
    status: 'Completed' | 'Under Review'
    date: string
  }[]
}

export interface StudentProject {
  id: string
  title: string
  course_id: string
  course_name: string
  cohort_id: string
  cohort_name: string
  trainer_name: string
  due_date: string
  maximum_score: number
  status: 'In Progress' | 'Submitted' | 'Reviewed' | 'Completed' | 'Overdue'
  description: string
  instructions: string
  resources: Array<{ name: string; url: string; type: string }>
  progress_percent: number
  phases: Array<{ name: string; completed: boolean; description: string }>
  milestones: Array<{ title: string; completed: boolean; status?: string; due_date?: string }>
  tech_stack: string[]
  student_work: {
    notes: string
    repo_url: string
    demo_url: string
    files: Array<{ name: string; size: string; url?: string }>
    last_saved: string | null
  }
  submission: {
    submitted_at: string | null
    status: 'Draft' | 'Submitted' | 'Revision Required' | 'Approved'
    score: number | null
    grade: string | null
    trainer_feedback: string | null
    improvement_notes: string | null
  }
}

export interface PortfolioItem {
  id: string
  project_id: string
  student_id: string
  title: string
  tagline: string
  summary_description: string
  tech_stack: string[]
  live_demo_url: string
  repo_url: string
  role: string
  key_highlights: string[]
  cover_image: string
  visibility: 'public' | 'private'
  order_index: number
  featured: boolean
  added_at: string
}

const PORTFOLIO_STORAGE_KEY = 'ijesha_hub_student_portfolio_v2'
const STUDENT_PROJECTS_STORAGE_KEY = 'ijesha_hub_student_projects_v2'

export function calculateLetterGrade(pct: number): string {
  if (pct >= 95) return 'A+'
  if (pct >= 90) return 'A'
  if (pct >= 85) return 'B+'
  if (pct >= 80) return 'B'
  if (pct >= 75) return 'C+'
  if (pct >= 70) return 'C'
  if (pct >= 60) return 'D'
  return 'F'
}

export const INITIAL_STUDENT_PROJECTS: StudentProject[] = []

export const INITIAL_PORTFOLIO_ITEMS: PortfolioItem[] = []

export const COURSE_RESULTS_DATA: CourseResult[] = []

export function getStudentProjects(): StudentProject[] {
  try {
    const raw = localStorage.getItem(STUDENT_PROJECTS_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch (e) {
    console.error('Failed to load student projects', e)
  }
  return []
}

export function saveStudentProject(project: StudentProject): void {
  const current = getStudentProjects()
  const index = current.findIndex(p => p.id === project.id)
  let updated: StudentProject[]
  if (index >= 0) {
    updated = [...current]
    updated[index] = project
  } else {
    updated = [project, ...current]
  }
  localStorage.setItem(STUDENT_PROJECTS_STORAGE_KEY, JSON.stringify(updated))
}

export function getPortfolioItems(): PortfolioItem[] {
  try {
    const raw = localStorage.getItem(PORTFOLIO_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch (e) {
    console.error('Failed to load portfolio items', e)
  }
  return []
}

export function savePortfolioItem(item: PortfolioItem): void {
  const current = getPortfolioItems()
  const index = current.findIndex(p => p.id === item.id)
  let updated: PortfolioItem[]
  if (index >= 0) {
    updated = [...current]
    updated[index] = item
  } else {
    updated = [...current, item]
  }
  localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(updated))
}

export function deletePortfolioItem(id: string): void {
  const current = getPortfolioItems()
  const updated = current.filter(item => item.id !== id)
  localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(updated))
}

export function getUnifiedGradedItems(studentId?: string): GradedItem[] {
  // Aggregate Classwork submissions
  const classworks = getStoredClasswork()
  const classworkSubs = getStoredSubmissions()

  // Base list
  const items: GradedItem[] = []

  // 1. Convert Classwork items
  for (const cw of classworks) {
    const sub = classworkSubs.find((s: StudentSubmission) => s.classwork_id === cw.id && (!studentId || s.student_id === studentId))
    const isGraded = sub?.status === 'Graded' && sub.score !== null
    const isSubmitted = sub?.status === 'Submitted' || sub?.submitted_at !== null

    if (isGraded || isSubmitted || sub?.status === 'In Progress') {
      const score = sub?.score ?? null
      const maxScore = cw.maximum_marks || 100
      const pct = score !== null ? Math.round((score / maxScore) * 100) : null

      items.push({
        id: `cw-grade-${cw.id}`,
        source_id: cw.id,
        title: cw.title,
        course_id: cw.course_id,
        course_name: cw.course_name,
        cohort_name: cw.cohort_name,
        student_id: sub?.student_id,
        item_type: 'Classwork',
        trainer_name: cw.trainer_name,
        assigned_date: cw.assigned_date,
        submitted_at: sub?.submitted_at ?? null,
        graded_at: sub?.graded_at ?? null,
        status: isGraded ? 'Graded' : isSubmitted ? 'Pending Review' : 'Pending Review',
        score,
        maximum_marks: maxScore,
        percentage: pct,
        letter_grade: pct !== null ? calculateLetterGrade(pct) : null,
        feedback: sub?.feedback ?? null,
        areas_for_improvement: sub?.areas_for_improvement ?? null,
        allow_resubmission: cw.allow_resubmission,
        resubmission_count: sub?.resubmission_count ?? 0,
        submission_details: {
          response_text: sub?.response_text ?? '',
          files: (sub?.uploaded_files ?? []).map((f: UploadedFileItem) => ({ name: f.name, size: f.size, url: f.url })),
          links: [],
        },
      })
    }
  }

  // 2. Add Project submissions
  const projects = getStudentProjects()
  for (const p of projects) {
    if (p.submission.status === 'Approved' || p.submission.status === 'Submitted' || p.submission.status === 'Revision Required') {
      const score = p.submission.score
      const maxScore = p.maximum_score || 100
      const pct = score !== null ? Math.round((score / maxScore) * 100) : null
      const isGraded = p.submission.status === 'Approved' && score !== null

      items.push({
        id: `proj-grade-${p.id}`,
        source_id: p.id,
        title: p.title,
        course_id: p.course_id,
        course_name: p.course_name,
        cohort_name: p.cohort_name,
        item_type: 'Project',
        trainer_name: p.trainer_name,
        assigned_date: '2026-08-01',
        submitted_at: p.submission.submitted_at,
        graded_at: isGraded ? '2026-08-29T10:00:00.000Z' : null,
        status: isGraded ? 'Graded' : p.submission.status === 'Revision Required' ? 'Revision Required' : 'Pending Review',
        score,
        maximum_marks: maxScore,
        percentage: pct,
        letter_grade: pct !== null ? calculateLetterGrade(pct) : null,
        feedback: p.submission.trainer_feedback,
        areas_for_improvement: p.submission.improvement_notes,
        allow_resubmission: true,
        resubmission_count: 0,
        submission_details: {
          response_text: p.student_work.notes,
          files: p.student_work.files,
          links: [p.student_work.demo_url, p.student_work.repo_url].filter(Boolean),
        },
      })
    }
  }

  // Sort by graded_at or submitted_at descending
  return items.sort((a, b) => {
    const timeA = new Date(a.graded_at || a.submitted_at || a.assigned_date).getTime()
    const timeB = new Date(b.graded_at || b.submitted_at || b.assigned_date).getTime()
    return timeB - timeA
  })
}

export function submitResubmission(
  gradeId: string,
  updatedText: string,
  resubmissionNotes: string,
  newFiles: Array<{ name: string; size: string; url?: string }> = []
): { success: boolean; message: string } {
  const items = getUnifiedGradedItems()
  const item = items.find(i => i.id === gradeId)
  if (!item) {
    return { success: false, message: 'Graded item not found.' }
  }

  if (item.item_type === 'Classwork') {
    const classworkSubs = getStoredSubmissions()
    const existing = classworkSubs.find((s: StudentSubmission) => s.classwork_id === item.source_id)
    if (existing) {
      const updatedSub: StudentSubmission = {
        ...existing,
        response_text: updatedText,
        uploaded_files: [
          ...existing.uploaded_files,
          ...newFiles.map(f => ({
            id: `file-${Date.now()}`,
            name: f.name,
            size: f.size,
            type: 'document',
            uploaded_at: new Date().toISOString(),
            url: f.url,
          })),
        ],
        status: 'Submitted',
        submitted_at: new Date().toISOString(),
        resubmission_count: (existing.resubmission_count || 0) + 1,
      }
      saveOrUpdateStudentSubmission(updatedSub)
      return { success: true, message: 'Resubmission received. Your trainer has been notified for re-evaluation.' }
    }
  } else if (item.item_type === 'Project') {
    const projects = getStudentProjects()
    const project = projects.find(p => p.id === item.source_id)
    if (project) {
      project.student_work.notes = updatedText
      project.student_work.files = [...project.student_work.files, ...newFiles]
      project.student_work.last_saved = new Date().toISOString()
      project.submission.submitted_at = new Date().toISOString()
      project.submission.status = 'Submitted'
      project.submission.improvement_notes = `Resubmitted with student notes: "${resubmissionNotes}"`
      saveStudentProject(project)
      return { success: true, message: 'Project resubmission updated successfully.' }
    }
  }

  return { success: true, message: 'Revision submitted successfully.' }
}

export interface GradingQueueItem {
  id: string
  source_id: string
  item_type: 'Classwork' | 'Project' | 'Assignment' | 'Assessment'
  title: string
  course_id: string
  course_name: string
  cohort_name: string
  student_id: string
  student_name: string
  student_initials: string
  submitted_at: string
  status: 'Pending Review' | 'Resubmitted' | 'Graded' | 'Revision Required'
  score: number | null
  maximum_marks: number
  response_text: string
  files: Array<{ name: string; size: string; url?: string }>
  links: string[]
  feedback: string | null
  areas_for_improvement: string | null
  resubmission_count: number
  resubmission_notes?: string
}

export const SAMPLE_COHORT_STUDENTS: Array<{ id: string; name: string; initials: string }> = []

export function getGradingQueueSubmissions(): GradingQueueItem[] {
  const queue: GradingQueueItem[] = []

  // 1. From Classwork
  const classworks = getStoredClasswork()
  const cwSubmissions = getStoredSubmissions()

  for (const cw of classworks) {
    for (const sub of cwSubmissions) {
      if (sub.classwork_id === cw.id && (sub.status === 'Submitted' || sub.status === 'Graded' || sub.status === 'Revision Required')) {
        const student = SAMPLE_COHORT_STUDENTS.find(s => s.id === sub.student_id) || {
          name: sub.student_name || 'Enrolled Student',
          initials: 'ES',
        }

        const isResubmitted = (sub.resubmission_count || 0) > 0 && sub.status === 'Submitted'
        const queueStatus = sub.status === 'Graded'
          ? 'Graded'
          : sub.status === 'Revision Required'
          ? 'Revision Required'
          : isResubmitted
          ? 'Resubmitted'
          : 'Pending Review'

        queue.push({
          id: `queue-cw-${sub.id}`,
          source_id: cw.id,
          item_type: 'Classwork',
          title: cw.title,
          course_id: cw.course_id,
          course_name: cw.course_name,
          cohort_name: cw.cohort_name,
          student_id: sub.student_id,
          student_name: student.name,
          student_initials: student.initials,
          submitted_at: sub.submitted_at || new Date().toISOString(),
          status: queueStatus,
          score: sub.score,
          maximum_marks: cw.maximum_marks || 100,
          response_text: sub.response_text || '',
          files: (sub.uploaded_files || []).map(f => ({ name: f.name, size: f.size, url: f.url })),
          links: [],
          feedback: sub.feedback,
          areas_for_improvement: sub.areas_for_improvement,
          resubmission_count: sub.resubmission_count || 0,
        })
      }
    }
  }

  // 2. From Projects
  const projects = getStudentProjects()
  for (const p of projects) {
    if (p.submission.status !== 'Draft') {
      const isGraded = p.submission.status === 'Approved' && p.submission.score !== null
      const isRevision = p.submission.status === 'Revision Required'
      queue.push({
        id: `queue-proj-${p.id}`,
        source_id: p.id,
        item_type: 'Project',
        title: p.title,
        course_id: p.course_id,
        course_name: p.course_name,
        cohort_name: p.cohort_name,
        student_id: '',
        student_name: 'Student',
        student_initials: 'ST',
        submitted_at: p.submission.submitted_at || new Date().toISOString(),
        status: isGraded ? 'Graded' : isRevision ? 'Revision Required' : 'Pending Review',
        score: p.submission.score,
        maximum_marks: p.maximum_score || 100,
        response_text: p.student_work.notes,
        files: p.student_work.files,
        links: [p.student_work.demo_url, p.student_work.repo_url].filter(Boolean),
        feedback: p.submission.trainer_feedback,
        areas_for_improvement: p.submission.improvement_notes,
        resubmission_count: 0,
        resubmission_notes: p.submission.improvement_notes || undefined,
      })
    }
  }

  return queue.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
}

export function clearAllStudentProjects(): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STUDENT_PROJECTS_STORAGE_KEY)
      localStorage.removeItem('ijesha_hub_student_projects')
      window.dispatchEvent(new CustomEvent('student-projects-updated'))
    }
  } catch (err) {
    console.warn('Failed to clear student projects:', err)
  }
}

export function clearAllPortfolioItems(): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(PORTFOLIO_STORAGE_KEY)
      localStorage.removeItem('ijesha_hub_portfolio_items_v2')
      localStorage.removeItem('ijesha_hub_portfolio_items')
      window.dispatchEvent(new CustomEvent('portfolio-items-updated'))
    }
  } catch (err) {
    console.warn('Failed to clear portfolio items:', err)
  }
}

export function clearGradingQueueAndFeedback(): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ijesha_hub_classwork_submissions_v2')
      localStorage.removeItem('ijesha_hub_classwork_submissions')
      // Reset any projects submissions
      const projects = getStudentProjects()
      for (const p of projects) {
        p.submission = {
          submitted_at: null,
          status: 'Draft',
          score: null,
          grade: null,
          trainer_feedback: null,
          improvement_notes: null,
        }
      }
      localStorage.setItem(STUDENT_PROJECTS_STORAGE_KEY, JSON.stringify(projects))
      window.dispatchEvent(new CustomEvent('grading-queue-updated'))
      window.dispatchEvent(new CustomEvent('grades-feedback-updated'))
    }
  } catch (err) {
    console.warn('Failed to clear grading queue and feedback:', err)
  }
}

export function gradeSubmission(params: {
  queueId: string
  sourceId: string
  itemType: 'Classwork' | 'Project' | 'Assignment' | 'Assessment'
  studentId: string
  score: number
  maximumScore: number
  feedback: string
  areasForImprovement?: string
  status: 'Graded' | 'Revision Required'
  trainerName?: string
}): { success: boolean; message: string } {
  const { sourceId, itemType, studentId, score, feedback, areasForImprovement, status } = params

  if (itemType === 'Classwork') {
    const subs = getStoredSubmissions()
    const existing = subs.find(s => s.classwork_id === sourceId && (!studentId || s.student_id === studentId))
    if (existing) {
      const updated: StudentSubmission = {
        ...existing,
        status: status === 'Revision Required' ? 'Revision Required' : 'Graded',
        score: status === 'Revision Required' ? null : score,
        feedback,
        areas_for_improvement: areasForImprovement || null,
        graded_at: new Date().toISOString(),
      }
      saveOrUpdateStudentSubmission(updated)
      return { success: true, message: status === 'Revision Required' ? 'Revision requested from student.' : 'Grade & feedback released successfully.' }
    }
  } else if (itemType === 'Project') {
    const projects = getStudentProjects()
    const project = projects.find(p => p.id === sourceId)
    if (project) {
      project.submission.status = status === 'Revision Required' ? 'Revision Required' : 'Approved'
      project.submission.score = status === 'Revision Required' ? null : score
      project.submission.grade = status === 'Revision Required' ? null : calculateLetterGrade(Math.round((score / project.maximum_score) * 100))
      project.submission.trainer_feedback = feedback
      project.submission.improvement_notes = areasForImprovement || null
      saveStudentProject(project)
      return { success: true, message: status === 'Revision Required' ? 'Revision requested on project.' : 'Project grade published successfully.' }
    }
  }

  return { success: true, message: 'Grade recorded successfully.' }
}

export function clearProjectsAndPortfolioData(): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STUDENT_PROJECTS_STORAGE_KEY)
      localStorage.removeItem(PORTFOLIO_STORAGE_KEY)
      localStorage.removeItem('ijesha_hub_student_projects')
      localStorage.removeItem('ijesha_hub_portfolio_items')
      localStorage.removeItem('ijesha_hub_portfolio_items_v2')
      localStorage.removeItem('ijesha_hub_student_portfolio_v2')
      window.dispatchEvent(new CustomEvent('student-projects-updated', { detail: [] }))
      window.dispatchEvent(new CustomEvent('portfolio-items-updated', { detail: [] }))
      window.dispatchEvent(new CustomEvent('app-data-cleared'))
    }
  } catch (err) {
    console.warn('Failed to clear projects and portfolio data:', err)
  }
}
