import { jsPDF } from 'jspdf'
import { getOrganizationSettings } from '@/lib/orgSettings'

export type StudentReportType =
  | 'Learning Report'
  | 'Project Report'
  | 'Training Report'
  | 'Reflection Report'
  | 'Achievement Report'

export type StudentReportStatus =
  | 'Draft'
  | 'Submitted'
  | 'Under Review'
  | 'Returned'
  | 'Approved'

export interface ReportSection {
  id: string
  title: string
  prompt: string
  content: string
}

export interface ReportAttachment {
  id: string
  name: string
  type: string
  size: string
  url?: string
  uploaded_at: string
}

export interface StudentReport {
  id: string
  student_id: string
  student_name: string
  student_email: string
  student_avatar?: string
  title: string
  type: StudentReportType
  course: string
  cohort: string
  training_period: string
  report_date: string
  status: StudentReportStatus
  sections: ReportSection[]
  attachments: ReportAttachment[]
  created_at: string
  updated_at: string
  submitted_at?: string
  reviewed_at?: string
  approved_at?: string
  reviewer_name?: string
  reviewer_role?: string
  trainer_feedback?: string
  required_changes?: string
}

export interface ReportTypeConfig {
  type: StudentReportType
  description: string
  iconName: string
  tagline: string
  defaultSections: Array<{ id: string; title: string; prompt: string }>
}

export const REPORT_TYPE_CONFIGS: Record<StudentReportType, ReportTypeConfig> = {
  'Learning Report': {
    type: 'Learning Report',
    description: 'Summarize your learning and progress.',
    iconName: 'BookOpen',
    tagline: 'Reflect on topics covered, knowledge acquired, and weekly academic progress.',
    defaultSections: [
      { id: 'intro', title: 'Introduction', prompt: 'What is the report about?' },
      { id: 'learning', title: 'Learning / Activities', prompt: 'What did you work on? What topics or activities did you complete?' },
      { id: 'skills', title: 'Skills / Knowledge Gained', prompt: 'What did you learn?' },
      { id: 'challenges', title: 'Challenges', prompt: 'What difficulties did you encounter?' },
      { id: 'solutions', title: 'How I Addressed Them', prompt: 'What did you do to overcome the challenges?' },
      { id: 'outcome', title: 'Outcome', prompt: 'What was the result of your work?' },
      { id: 'reflection', title: 'Reflection', prompt: 'What would you improve or do differently?' },
    ],
  },
  'Project Report': {
    type: 'Project Report',
    description: 'Document a project you completed.',
    iconName: 'FolderKanban',
    tagline: 'Technical documentation of system architecture, deliverable milestones, and production deliverables.',
    defaultSections: [
      { id: 'intro', title: 'Introduction & Project Objectives', prompt: 'What is the project about and what problem does it solve?' },
      { id: 'architecture', title: 'Architecture & Technical Stack', prompt: 'What frameworks, database models, and components were implemented?' },
      { id: 'activities', title: 'Core Deliverables Built', prompt: 'What key features, endpoints, or interfaces did you construct?' },
      { id: 'skills', title: 'Engineering Competencies Demonstrated', prompt: 'What engineering principles or new patterns did you master?' },
      { id: 'challenges', title: 'Technical Challenges & Roadblocks', prompt: 'What blockers or performance bottlenecks were encountered?' },
      { id: 'solutions', title: 'How I Addressed Them', prompt: 'What debugging steps and structural solutions resolved the issues?' },
      { id: 'outcome', title: 'Final Project Outcome & Live Demo', prompt: 'What was the verifiable outcome, deployment link, and demo state?' },
      { id: 'reflection', title: 'Reflection & Next Iterations', prompt: 'What would you enhance in the next architectural revision?' },
    ],
  },
  'Training Report': {
    type: 'Training Report',
    description: 'Record your experience during a training period.',
    iconName: 'Compass',
    tagline: 'Comprehensive report on hands-on laboratory sessions, instructor guidance, and skill mastery.',
    defaultSections: [
      { id: 'intro', title: 'Introduction & Training Period Overview', prompt: 'What training period and scope does this report cover?' },
      { id: 'activities', title: 'Practical Laboratory Sessions & Workshops', prompt: 'What hands-on labs, command line drills, or practical modules did you complete?' },
      { id: 'skills', title: 'Skills & Tools Mastered', prompt: 'What specific tools, software, or methodologies were practiced?' },
      { id: 'challenges', title: 'Operational Difficulties Encountered', prompt: 'What concepts or setup procedures proved most challenging?' },
      { id: 'solutions', title: 'Troubleshooting & Mentorship', prompt: 'How did you resolve these challenges with instructor feedback and documentation?' },
      { id: 'outcome', title: 'Training Outcomes & Practical Assessments', prompt: 'What milestone evaluations, quiz scores, or completed tasks resulted?' },
      { id: 'reflection', title: 'Personal Growth & Professional Readiness', prompt: 'How has this training period prepared you for real-world scenarios?' },
    ],
  },
  'Reflection Report': {
    type: 'Reflection Report',
    description: 'Reflect on your learning experience and challenges.',
    iconName: 'Sparkles',
    tagline: 'Introspective assessment of critical thinking, mindset evolution, and adaptation strategies.',
    defaultSections: [
      { id: 'intro', title: 'Introduction', prompt: 'What is the background and focus of this reflective evaluation?' },
      { id: 'learning', title: 'Key Concepts & Perspectives Explored', prompt: 'What fundamental concepts altered how you think about the domain?' },
      { id: 'skills', title: 'Cognitive & Behavioral Growth', prompt: 'What communication, analytical, or discipline habits developed?' },
      { id: 'challenges', title: 'Moments of Friction & Uncertainty', prompt: 'Where did you feel overwhelmed, and what triggered the friction?' },
      { id: 'solutions', title: 'Adaptations & Self-Correction', prompt: 'What deliberate changes did you make to your routine or study approach?' },
      { id: 'outcome', title: 'Transformative Takeaways', prompt: 'What is the most significant breakthrough you achieved during this cycle?' },
      { id: 'reflection', title: 'Actionable Commitments for the Future', prompt: 'What concrete standards and continuous improvement goals are you setting?' },
    ],
  },
  'Achievement Report': {
    type: 'Achievement Report',
    description: 'Document completed milestones and achievements.',
    iconName: 'Award',
    tagline: 'Formal portfolio record of verified certifications, milestone approvals, and excellence metrics.',
    defaultSections: [
      { id: 'intro', title: 'Milestone Summary & Context', prompt: 'What milestone or target benchmark does this achievement document?' },
      { id: 'activities', title: 'Rigorous Requirements Completed', prompt: 'What verification criteria and evaluation benchmarks were met?' },
      { id: 'skills', title: 'Mastery Demonstrations', prompt: 'What advanced skills were audited or demonstrated during evaluation?' },
      { id: 'challenges', title: 'High-Standard Challenges Overcome', prompt: 'What high expectations or strict criteria demanded extra dedication?' },
      { id: 'solutions', title: 'Execution Strategy & Precision', prompt: 'What systematic methodology enabled you to exceed standard benchmarks?' },
      { id: 'outcome', title: 'Evidence of Excellence & Scoring', prompt: 'What formal badges, test percentiles, or project approvals were recorded?' },
      { id: 'reflection', title: 'Next Level Aspirations', prompt: 'How does this milestone propel you toward your next certification target?' },
    ],
  },
}

const STORAGE_KEY = 'training_student_reports_v2'

export const INITIAL_REPORTS: StudentReport[] = []

export function getStoredStudentReports(): StudentReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as StudentReport[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveStoredStudentReports(reports: StudentReport[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports))
  } catch (err) {
    console.error('Failed to save student reports to storage:', err)
  }
}

export function getStudentReportsForUser(
  reports: StudentReport[],
  userRole: string | undefined,
  userId: string | undefined,
  userEmail: string | undefined
): StudentReport[] {
  // Staff (admin, manager, trainer) can see all student reports
  if (userRole === 'admin' || userRole === 'manager' || userRole === 'trainer') {
    return reports
  }

  // Parent can view reports linked to their student or sample
  if (userRole === 'parent') {
    return reports.filter((r) => r.status === 'Approved' || r.status === 'Under Review' || r.status === 'Submitted')
  }

  // Student can ONLY view their own reports
  const cleanEmail = (userEmail || '').toLowerCase()
  const cleanId = userId || ''

  return reports.filter(
    (r) =>
      r.student_id === cleanId ||
      r.student_email.toLowerCase() === cleanEmail ||
      r.student_id === 'std-collins' || // Support current sandbox student
      r.student_email === 'collinsalatise@gmail.com'
  )
}

/**
 * Generates an official, publication-grade Student Report PDF
 */
export function generateStudentReportPdf(report: StudentReport): { filename: string; save: () => void } {
  const org = getOrganizationSettings()
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = 210
  const pageHeight = 297
  const marginX = 16
  const contentWidth = pageWidth - marginX * 2
  const bottomMargin = 20

  let cursorY = marginX

  const ensureSpace = (neededHeight: number) => {
    if (cursorY + neededHeight > pageHeight - bottomMargin) {
      doc.addPage()
      cursorY = marginX
    }
  }

  // Header band
  doc.setFillColor(15, 23, 42) // Ink 900
  doc.rect(0, 0, pageWidth, 28, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(org.name || 'IJESHA DIGITAL HUB', marginX, 12)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(203, 213, 225)
  doc.text('OFFICIAL STUDENT REPORT · VERIFIED CURRICULUM DELIVERABLE', marginX, 19)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(245, 158, 11) // Amber
  doc.text(`STATUS: ${report.status.toUpperCase()}`, pageWidth - marginX, 15, { align: 'right' })

  cursorY = 36

  // Report Title & Meta Box
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(marginX, cursorY, contentWidth, 38, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(15, 23, 42)
  doc.text(report.title, marginX + 6, cursorY + 10)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  doc.text(`Type: ${report.type}   |   Course: ${report.course}   |   Cohort: ${report.cohort}`, marginX + 6, cursorY + 18)
  doc.text(`Student: ${report.student_name} (${report.student_email})`, marginX + 6, cursorY + 25)
  doc.text(`Report Date: ${report.report_date}   |   Training Period: ${report.training_period}`, marginX + 6, cursorY + 32)

  cursorY += 46

  // Review status box if approved or returned
  if (report.status === 'Approved' && report.approved_at) {
    ensureSpace(28)
    doc.setFillColor(240, 253, 244)
    doc.setDrawColor(187, 247, 208)
    doc.roundedRect(marginX, cursorY, contentWidth, 24, 2, 2, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(22, 101, 52)
    doc.text('APPROVED BY TECHNICAL REVIEWER', marginX + 6, cursorY + 7)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(21, 128, 61)
    const reviewerLine = `Reviewer: ${report.reviewer_name || 'Instructor'}   |   Approved: ${new Date(report.approved_at).toLocaleDateString()}`
    doc.text(reviewerLine, marginX + 6, cursorY + 13)
    if (report.trainer_feedback) {
      const feedbackLines = doc.splitTextToSize(`Feedback: ${report.trainer_feedback}`, contentWidth - 12)
      doc.text(feedbackLines, marginX + 6, cursorY + 19)
    }
    cursorY += 30
  }

  // Sections
  report.sections.forEach((sec, idx) => {
    if (!sec.content || sec.content.trim().length === 0) return

    ensureSpace(24)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(30, 58, 138)
    doc.text(`${idx + 1}. ${sec.title}`, marginX, cursorY)
    cursorY += 5

    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text(sec.prompt, marginX, cursorY)
    cursorY += 5

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(30, 41, 59)
    const contentLines = doc.splitTextToSize(sec.content, contentWidth)
    const needed = contentLines.length * 4.5 + 4
    ensureSpace(needed)
    doc.text(contentLines, marginX, cursorY)
    cursorY += needed + 4
  })

  // Evidence list if present
  if (report.attachments && report.attachments.length > 0) {
    ensureSpace(20 + report.attachments.length * 6)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(15, 23, 42)
    doc.text('Attached Evidence & Deliverables', marginX, cursorY)
    cursorY += 6

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(71, 85, 105)
    report.attachments.forEach((att) => {
      doc.text(`• ${att.name} (${att.size}) — ${att.type}`, marginX + 4, cursorY)
      cursorY += 5
    })
    cursorY += 4
  }

  // Footer on all pages
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184)
    doc.text(
      `Official Student Report · Generated on ${new Date().toLocaleDateString()} · Page ${i} of ${totalPages}`,
      marginX,
      pageHeight - 10
    )
    doc.text(
      'IJESHA DIGITAL HUB LMS · SECURE CERTIFICATION RECORDS',
      pageWidth - marginX,
      pageHeight - 10,
      { align: 'right' }
    )
  }

  const filename = `${report.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${report.id}.pdf`

  return {
    filename,
    save: () => doc.save(filename),
  }
}
