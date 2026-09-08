import { useState } from 'react'
import {
  X,
  Download,
  FileText,
  FileSpreadsheet,
  User,
  Users,
} from 'lucide-react'
import type {
  CohortProgressOverviewData,
  WeeklyCohortProgress,
} from '@/lib/progress'

interface DownloadReportModalProps {
  isOpen: boolean
  onClose: () => void
  cohortData: CohortProgressOverviewData
  selectedStudentId?: string
  userRole?: string
  currentUserName?: string
}

export function DownloadReportModal({
  isOpen,
  onClose,
  cohortData,
  selectedStudentId,
  userRole,
  currentUserName,
}: DownloadReportModalProps) {
  const isStudent = userRole === 'student'
  const isParent = userRole === 'parent'

  // Pre-filter / constrain student choice if user is student or parent
  const matchedStudent =
    isStudent || isParent
      ? cohortData.students.find(
          (s) =>
            s.studentName.toLowerCase() === (currentUserName || '').toLowerCase() ||
            (s.studentEmail && s.studentEmail.toLowerCase().includes('david'))
        ) || cohortData.students[0]
      : selectedStudentId
      ? cohortData.students.find((s) => s.id === selectedStudentId) || cohortData.students[0]
      : cohortData.students[0]

  const [reportType, setReportType] = useState<'individual' | 'cohort'>(
    isStudent || isParent ? 'individual' : selectedStudentId ? 'individual' : 'cohort'
  )
  const [chosenStudentId, setChosenStudentId] = useState<string>(
    matchedStudent?.id || cohortData.students[0]?.id || ''
  )
  const [reportingPeriod, setReportingPeriod] = useState<
    'all' | 'current' | 'custom'
  >('all')
  const [startWeek, setStartWeek] = useState<number>(1)
  const [endWeek, setEndWeek] = useState<number>(cohortData.weeks.length || 5)
  const [format, setFormat] = useState<'pdf' | 'excel'>('pdf')
  const [isGenerating, setIsGenerating] = useState(false)

  if (!isOpen) return null

  const selectedStudent =
    cohortData.students.find((s) => s.id === chosenStudentId) || matchedStudent

  // Filter weeks based on reporting period
  const effectiveWeeks: WeeklyCohortProgress[] = cohortData.weeks.filter((w) => {
    if (reportingPeriod === 'current') {
      return w.week === cohortData.weeks[cohortData.weeks.length - 1]?.week
    }
    if (reportingPeriod === 'custom') {
      return w.week >= startWeek && w.week <= endWeek
    }
    return true // 'all'
  })

  const periodLabel =
    reportingPeriod === 'all'
      ? `All Training Weeks (Weeks 1–${cohortData.weeks.length})`
      : reportingPeriod === 'current'
      ? `Current Training Week (Week ${cohortData.weeks[cohortData.weeks.length - 1]?.week})`
      : `Weeks ${startWeek} through ${endWeek}`

  // ==========================================
  // Report Exporters (PDF & Excel)
  // ==========================================

  const handleDownload = () => {
    setIsGenerating(true)
    setTimeout(() => {
      try {
        if (format === 'excel') {
          exportExcel()
        } else {
          exportPDF()
        }
      } catch (err) {
        console.error('Error downloading progress report:', err)
      } finally {
        setIsGenerating(false)
        onClose()
      }
    }, 400)
  }

  // Generate Excel / CSV File
  const exportExcel = () => {
    let csvContent = ''

    if (reportType === 'individual' && selectedStudent) {
      csvContent += `IJESHA DIGITAL HUB - INDIVIDUAL STUDENT PROGRESS REPORT\n`
      csvContent += `Student Name,${selectedStudent.studentName}\n`
      csvContent += `Course,${cohortData.courseName}\n`
      csvContent += `Cohort,${cohortData.cohortName}\n`
      csvContent += `Reporting Period,${periodLabel}\n`
      csvContent += `Student Status,${selectedStudent.status}\n`
      csvContent += `Generated On,${new Date().toLocaleDateString()}\n\n`

      csvContent += `PROGRESS SUMMARY\n`
      csvContent += `Metric,Value\n`
      csvContent += `Overall Progress,${selectedStudent.overallProgress}%\n`
      csvContent += `Attendance Rate,${selectedStudent.attendanceRate}%\n`
      csvContent += `Assignment Performance,${selectedStudent.assignmentsProgress}%\n`
      csvContent += `Project Performance,${selectedStudent.projectsProgress}%\n`
      csvContent += `Assessment Performance,${selectedStudent.assessmentsProgress}%\n`
      csvContent += `Training Session Progress,${selectedStudent.trainingSessionsProgress}%\n\n`

      csvContent += `PROGRESS BREAKDOWN COUNTS\n`
      csvContent += `Category,Completed,Total\n`
      csvContent += `Training Sessions,${selectedStudent.trainingSessionsCount.completed},${selectedStudent.trainingSessionsCount.total}\n`
      csvContent += `Assignments,${selectedStudent.assignmentsCount.completed},${selectedStudent.assignmentsCount.total}\n`
      csvContent += `Projects,${selectedStudent.projectsCount.completed},${selectedStudent.projectsCount.total}\n`
      csvContent += `Assessments,${selectedStudent.assessmentsCount.completed},${selectedStudent.assessmentsCount.total}\n\n`

      csvContent += `WEEKLY PROGRESS HISTORY\n`
      csvContent += `Training Week,Progress Percentage\n`
      selectedStudent.weeklyProgressPoints
        .filter((p) => {
          if (reportingPeriod === 'current') return p.week === effectiveWeeks[0]?.week
          if (reportingPeriod === 'custom') return p.week >= startWeek && p.week <= endWeek
          return true
        })
        .forEach((pt) => {
          csvContent += `Week ${pt.week},${pt.progress}%\n`
        })

      csvContent += `\nPROGRESS EVENT LOG\n`
      csvContent += `Week,Milestone Title,Details,Recorded At\n`
      selectedStudent.history.forEach((h) => {
        csvContent += `Week ${h.week},"${h.title.replace(/"/g, '""')}","${h.details.replace(/"/g, '""')}",${h.recordedAt}\n`
      })
    } else {
      // Cohort Progress Report Excel
      csvContent += `IJESHA DIGITAL HUB - COHORT PROGRESS REPORT\n`
      csvContent += `Course,${cohortData.courseName}\n`
      csvContent += `Cohort,${cohortData.cohortName}\n`
      csvContent += `Reporting Period,${periodLabel}\n`
      csvContent += `Generated On,${new Date().toLocaleDateString()}\n\n`

      csvContent += `COHORT SUMMARY\n`
      csvContent += `Metric,Value\n`
      csvContent += `Total Students,${cohortData.students.length}\n`
      csvContent += `Average Progress,${cohortData.overallProgress}%\n`
      csvContent += `Average Attendance,${cohortData.averageAttendance}%\n`
      csvContent += `Students On Track,${cohortData.studentsOnTrack}\n`
      csvContent += `Students At Risk,${cohortData.studentsAtRisk}\n`
      csvContent += `Completed Students,${cohortData.completed}\n\n`

      csvContent += `COHORT WEEKLY PROGRESS OVER TIME\n`
      csvContent += `Week,Overall Progress,Training Sessions Completed,Attendance Rate,Assignments Completed,Projects Completed,Assessments Completed\n`
      effectiveWeeks.forEach((w) => {
        csvContent += `Week ${w.week},${w.overallProgress}%,${w.trainingSessions.completed}/${w.trainingSessions.total},${w.attendanceRate}%,${w.assignments.completed}/${w.assignments.total},${w.projects.completed}/${w.projects.total},${w.assessments.completed}/${w.assessments.total}\n`
      })

      csvContent += `\nSTUDENT PROGRESS ROSTER\n`
      csvContent += `Student Name,Overall Progress,Attendance,Assignments,Projects,Assessments,Status\n`
      cohortData.students.forEach((s) => {
        csvContent += `"${s.studentName}",${s.overallProgress}%,${s.attendanceRate}%,${s.assignmentsProgress}%,${s.projectsProgress}%,${s.assessmentsProgress}%,${s.status}\n`
      })
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const fileName =
      reportType === 'individual'
        ? `Progress_Report_${selectedStudent?.studentName.replace(/\s+/g, '_')}_${cohortData.cohortName.replace(/\s+/g, '_')}.csv`
        : `Cohort_Progress_Report_${cohortData.cohortName.replace(/\s+/g, '_')}.csv`
    link.setAttribute('href', url)
    link.setAttribute('download', fileName)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Generate Print-Ready PDF Window
  const exportPDF = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    let contentHtml = ''

    if (reportType === 'individual' && selectedStudent) {
      // Individual Student Progress Report
      const points = selectedStudent.weeklyProgressPoints.filter((p) => {
        if (reportingPeriod === 'current') return p.week === effectiveWeeks[0]?.week
        if (reportingPeriod === 'custom') return p.week >= startWeek && p.week <= endWeek
        return true
      })

      const graphSvg = `
        <svg viewBox="0 0 600 160" style="width: 100%; height: 160px; background: #fafbfc; border-radius: 8px; border: 1px solid #e2e8f0; margin-top: 10px;">
          <line x1="50" y1="120" x2="550" y2="120" stroke="#cbd5e1" stroke-width="1" />
          <line x1="50" y1="75" x2="550" y2="75" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3 3" />
          <line x1="50" y1="30" x2="550" y2="30" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3 3" />
          <text x="35" y="123" font-size="10" fill="#64748b" text-anchor="end">0%</text>
          <text x="35" y="78" font-size="10" fill="#64748b" text-anchor="end">50%</text>
          <text x="35" y="33" font-size="10" fill="#64748b" text-anchor="end">100%</text>
          ${points
            .map((pt, i) => {
              const x = 70 + (i / Math.max(1, points.length - 1)) * 460
              const y = 120 - (pt.progress / 100) * 90
              return `
                <circle cx="${x}" cy="${y}" r="5" fill="#26478A" stroke="#ffffff" stroke-width="2" />
                <text x="${x}" y="${y - 8}" font-size="11" font-weight="bold" fill="#1E3A6E" text-anchor="middle">${pt.progress}%</text>
                <text x="${x}" y="140" font-size="10" fill="#475569" text-anchor="middle">Week ${pt.week}</text>
              `
            })
            .join('')}
          <polyline
            fill="none"
            stroke="#26478A"
            stroke-width="3"
            points="${points
              .map((pt, i) => {
                const x = 70 + (i / Math.max(1, points.length - 1)) * 460
                const y = 120 - (pt.progress / 100) * 90
                return `${x},${y}`
              })
              .join(' ')}"
          />
        </svg>
      `

      contentHtml = `
        <div class="header">
          <div class="brand">
            <h1>IJESHA DIGITAL HUB</h1>
            <p class="subtitle">Official Student Progress & Performance Report</p>
          </div>
          <div class="meta-badge">
            <span class="status-pill status-${selectedStudent.status.toLowerCase().replace(' ', '-')}">${selectedStudent.status}</span>
          </div>
        </div>

        <div class="info-grid">
          <div><strong>Student Name:</strong> ${selectedStudent.studentName}</div>
          <div><strong>Course:</strong> ${cohortData.courseName}</div>
          <div><strong>Cohort:</strong> ${cohortData.cohortName}</div>
          <div><strong>Reporting Period:</strong> ${periodLabel}</div>
          <div><strong>Student Status:</strong> ${selectedStudent.status}</div>
          <div><strong>Generated:</strong> ${new Date().toLocaleDateString('en-US', { dateStyle: 'medium' })}</div>
        </div>

        <div class="section-title">Progress Summary</div>
        <div class="kpi-row">
          <div class="kpi-card highlight">
            <div class="kpi-value">${selectedStudent.overallProgress}%</div>
            <div class="kpi-label">Overall Progress</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value">${selectedStudent.attendanceRate}%</div>
            <div class="kpi-label">Attendance Rate</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value">${selectedStudent.assignmentsProgress}%</div>
            <div class="kpi-label">Assignment Score</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value">${selectedStudent.projectsProgress}%</div>
            <div class="kpi-label">Project Score</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value">${selectedStudent.assessmentsProgress}%</div>
            <div class="kpi-label">Assessment Score</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value">${selectedStudent.trainingSessionsProgress}%</div>
            <div class="kpi-label">Session Progress</div>
          </div>
        </div>

        <div class="section-title">Individual Progress Graph (Training Weeks)</div>
        ${graphSvg}

        <div class="section-title" style="margin-top: 25px;">Progress Breakdown</div>
        <table>
          <thead>
            <tr>
              <th>Component</th>
              <th>Completion Count</th>
              <th>Performance Rate</th>
              <th>Status Evaluation</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Training Sessions</td>
              <td>${selectedStudent.trainingSessionsCount.completed} / ${selectedStudent.trainingSessionsCount.total} sessions</td>
              <td>${selectedStudent.trainingSessionsProgress}%</td>
              <td><span class="status-pill status-on-track">Completed</span></td>
            </tr>
            <tr>
              <td>Assignments</td>
              <td>${selectedStudent.assignmentsCount.completed} / ${selectedStudent.assignmentsCount.total} completed</td>
              <td>${selectedStudent.assignmentsProgress}%</td>
              <td><span class="status-pill ${selectedStudent.assignmentsProgress >= 75 ? 'status-on-track' : 'status-at-risk'}">${selectedStudent.assignmentsProgress >= 75 ? 'On Track' : 'Needs Review'}</span></td>
            </tr>
            <tr>
              <td>Projects</td>
              <td>${selectedStudent.projectsCount.completed} / ${selectedStudent.projectsCount.total} completed</td>
              <td>${selectedStudent.projectsProgress}%</td>
              <td><span class="status-pill ${selectedStudent.projectsProgress >= 75 ? 'status-on-track' : 'status-at-risk'}">${selectedStudent.projectsProgress >= 75 ? 'On Track' : 'In Progress'}</span></td>
            </tr>
            <tr>
              <td>Assessments & Quizzes</td>
              <td>${selectedStudent.assessmentsCount.completed} / ${selectedStudent.assessmentsCount.total} completed</td>
              <td>${selectedStudent.assessmentsProgress}%</td>
              <td><span class="status-pill ${selectedStudent.assessmentsProgress >= 75 ? 'status-on-track' : 'status-at-risk'}">${selectedStudent.assessmentsProgress >= 75 ? 'Passed' : 'Follow-up Needed'}</span></td>
            </tr>
            <tr>
              <td>Attendance Track Record</td>
              <td>Recorded across all scheduled modules</td>
              <td>${selectedStudent.attendanceRate}%</td>
              <td><span class="status-pill ${selectedStudent.attendanceRate >= 80 ? 'status-on-track' : 'status-at-risk'}">${selectedStudent.attendanceRate >= 80 ? 'Excellent' : 'Low Attendance'}</span></td>
            </tr>
          </tbody>
        </table>

        <div class="section-title" style="margin-top: 25px;">Chronological Progress History & Key Milestones</div>
        <div class="history-list">
          ${selectedStudent.history
            .map(
              (h) => `
            <div class="history-entry">
              <div class="history-week">Week ${h.week}</div>
              <div class="history-body">
                <strong>${h.title}</strong>
                <p>${h.details}</p>
                <small>Progress updated to ${h.progressPercentage}% on ${h.recordedAt}</small>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      `
    } else {
      // Cohort Progress Report
      const cohortPoints = effectiveWeeks.map((w) => ({
        week: w.week,
        progress: w.overallProgress,
      }))

      const graphSvg = `
        <svg viewBox="0 0 600 160" style="width: 100%; height: 160px; background: #fafbfc; border-radius: 8px; border: 1px solid #e2e8f0; margin-top: 10px;">
          <line x1="50" y1="120" x2="550" y2="120" stroke="#cbd5e1" stroke-width="1" />
          <line x1="50" y1="75" x2="550" y2="75" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3 3" />
          <line x1="50" y1="30" x2="550" y2="30" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3 3" />
          <text x="35" y="123" font-size="10" fill="#64748b" text-anchor="end">0%</text>
          <text x="35" y="78" font-size="10" fill="#64748b" text-anchor="end">50%</text>
          <text x="35" y="33" font-size="10" fill="#64748b" text-anchor="end">100%</text>
          ${cohortPoints
            .map((pt, i) => {
              const x = 70 + (i / Math.max(1, cohortPoints.length - 1)) * 460
              const y = 120 - (pt.progress / 100) * 90
              return `
                <circle cx="${x}" cy="${y}" r="5" fill="#26478A" stroke="#ffffff" stroke-width="2" />
                <text x="${x}" y="${y - 8}" font-size="11" font-weight="bold" fill="#1E3A6E" text-anchor="middle">${pt.progress}%</text>
                <text x="${x}" y="140" font-size="10" fill="#475569" text-anchor="middle">Week ${pt.week}</text>
              `
            })
            .join('')}
          <polyline
            fill="none"
            stroke="#26478A"
            stroke-width="3"
            points="${cohortPoints
              .map((pt, i) => {
                const x = 70 + (i / Math.max(1, cohortPoints.length - 1)) * 460
                const y = 120 - (pt.progress / 100) * 90
                return `${x},${y}`
              })
              .join(' ')}"
          />
        </svg>
      `

      contentHtml = `
        <div class="header">
          <div class="brand">
            <h1>IJESHA DIGITAL HUB</h1>
            <p class="subtitle">Cohort Progress & Completion Report</p>
          </div>
        </div>

        <div class="info-grid">
          <div><strong>Course:</strong> ${cohortData.courseName}</div>
          <div><strong>Cohort:</strong> ${cohortData.cohortName}</div>
          <div><strong>Reporting Period:</strong> ${periodLabel}</div>
          <div><strong>Generated:</strong> ${new Date().toLocaleDateString('en-US', { dateStyle: 'medium' })}</div>
        </div>

        <div class="section-title">Cohort Summary</div>
        <div class="kpi-row">
          <div class="kpi-card highlight">
            <div class="kpi-value">${cohortData.overallProgress}%</div>
            <div class="kpi-label">Average Progress</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value">${cohortData.students.length}</div>
            <div class="kpi-label">Total Students</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value">${cohortData.averageAttendance}%</div>
            <div class="kpi-label">Average Attendance</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value" style="color: #17915E;">${cohortData.studentsOnTrack}</div>
            <div class="kpi-label">Students On Track</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value" style="color: #C93A3E;">${cohortData.studentsAtRisk}</div>
            <div class="kpi-label">Students At Risk</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value" style="color: #2E4876;">${cohortData.completed}</div>
            <div class="kpi-label">Completed</div>
          </div>
        </div>

        <div class="section-title">Cohort Progress Graph Across Training Weeks</div>
        ${graphSvg}

        <div class="section-title" style="margin-top: 25px;">Weekly Progress Milestones</div>
        <table>
          <thead>
            <tr>
              <th>Week</th>
              <th>Overall Progress</th>
              <th>Training Sessions</th>
              <th>Attendance</th>
              <th>Assignments</th>
              <th>Projects</th>
              <th>Assessments</th>
            </tr>
          </thead>
          <tbody>
            ${effectiveWeeks
              .map(
                (w) => `
              <tr>
                <td><strong>Week ${w.week}</strong></td>
                <td><strong>${w.overallProgress}%</strong></td>
                <td>${w.trainingSessions.completed}/${w.trainingSessions.total}</td>
                <td>${w.attendanceRate}%</td>
                <td>${w.assignments.completed}/${w.assignments.total} completed</td>
                <td>${w.projects.completed}/${w.projects.total} completed</td>
                <td>${w.assessments.completed}/${w.assessments.total} completed</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        <div class="section-title" style="margin-top: 25px;">Student Progress Table</div>
        <table>
          <thead>
            <tr>
              <th>Student Name</th>
              <th>Overall Progress</th>
              <th>Attendance</th>
              <th>Assignments</th>
              <th>Projects</th>
              <th>Assessments</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${cohortData.students
              .map(
                (s) => `
              <tr>
                <td><strong>${s.studentName}</strong></td>
                <td><strong>${s.overallProgress}%</strong></td>
                <td>${s.attendanceRate}%</td>
                <td>${s.assignmentsProgress}%</td>
                <td>${s.projectsProgress}%</td>
                <td>${s.assessmentsProgress}%</td>
                <td>
                  <span class="status-pill status-${s.status.toLowerCase().replace(' ', '-')}">
                    ${s.status}
                  </span>
                </td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      `
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Progress Report - Ijesha Digital Hub</title>
          <meta charset="utf-8" />
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              color: #10192B;
              line-height: 1.5;
              padding: 30px;
              max-width: 900px;
              margin: 0 auto;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #26478A;
              padding-bottom: 15px;
              margin-bottom: 20px;
            }
            .brand h1 {
              margin: 0;
              font-size: 24px;
              letter-spacing: 0.5px;
              color: #10192B;
            }
            .brand p {
              margin: 3px 0 0;
              color: #6C85B3;
              font-size: 13px;
              font-weight: 500;
            }
            .info-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 8px 24px;
              background: #F6F7FB;
              padding: 14px 18px;
              border-radius: 8px;
              margin-bottom: 20px;
              font-size: 13px;
            }
            .section-title {
              font-size: 15px;
              font-weight: 700;
              color: #10192B;
              border-bottom: 1px solid #E4E8F1;
              padding-bottom: 6px;
              margin-bottom: 12px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .kpi-row {
              display: grid;
              grid-template-columns: repeat(6, 1fr);
              gap: 10px;
              margin-bottom: 20px;
            }
            .kpi-card {
              background: #FFFFFF;
              border: 1px solid #E4E8F1;
              padding: 10px;
              border-radius: 6px;
              text-align: center;
            }
            .kpi-card.highlight {
              background: #E3E9F7;
              border-color: #CBD5EA;
            }
            .kpi-value {
              font-size: 18px;
              font-weight: 800;
              color: #10192B;
            }
            .kpi-label {
              font-size: 10px;
              text-transform: uppercase;
              color: #6C85B3;
              font-weight: 600;
              margin-top: 2px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
              font-size: 12px;
            }
            th, td {
              border: 1px solid #E4E8F1;
              padding: 8px 10px;
              text-align: left;
            }
            th {
              background: #F6F7FB;
              color: #2E4876;
              font-weight: 600;
            }
            .status-pill {
              display: inline-block;
              padding: 2px 8px;
              border-radius: 12px;
              font-size: 10px;
              font-weight: 700;
              text-transform: uppercase;
            }
            .status-on-track { background: #DDF3EA; color: #17915E; }
            .status-at-risk { background: #FBDFDF; color: #C93A3E; }
            .status-completed { background: #E3E9F7; color: #26478A; }
            .history-list {
              display: flex;
              flex-direction: column;
              gap: 10px;
              margin-top: 10px;
            }
            .history-entry {
              display: flex;
              gap: 15px;
              border-left: 2px solid #26478A;
              padding-left: 12px;
              font-size: 12px;
            }
            .history-week {
              font-weight: 700;
              color: #26478A;
              min-width: 60px;
            }
            .history-body p {
              margin: 2px 0 4px;
              color: #3E5D96;
            }
            .history-body small {
              color: #6C85B3;
              font-size: 11px;
            }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="background: #1E3A6E; color: white; padding: 12px 20px; margin-bottom: 20px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
            <span>Document ready for print or saving as PDF.</span>
            <button onclick="window.print()" style="background: white; color: #1E3A6E; border: none; padding: 6px 14px; font-weight: bold; border-radius: 4px; cursor: pointer;">
              Print / Save as PDF
            </button>
          </div>
          ${contentHtml}
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-4">
          <div>
            <h2 className="font-display text-lg font-bold text-[var(--color-ink-900)]">
              Download Progress Report
            </h2>
            <p className="mt-0.5 text-xs text-[var(--color-ink-500)]">
              Export official progress metrics for {cohortData.cohortName} ({cohortData.courseName})
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-[var(--color-ink-400)] hover:bg-[var(--color-paper)] hover:text-[var(--color-ink-700)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {/* Report Type */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-ink-700)] uppercase tracking-wider mb-2">
              Report Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={isStudent || isParent}
                onClick={() => setReportType('cohort')}
                className={`flex items-center gap-2.5 rounded-[var(--radius-md)] border p-3 text-left transition-all ${
                  reportType === 'cohort'
                    ? 'border-[var(--color-harbor-600)] bg-[var(--color-harbor-100)]/40 text-[var(--color-harbor-700)] ring-1 ring-[var(--color-harbor-600)]'
                    : 'border-[var(--color-line)] bg-white text-[var(--color-ink-700)] hover:bg-[var(--color-paper)]'
                } ${isStudent || isParent ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Users size={18} className="shrink-0" />
                <div>
                  <div className="text-sm font-semibold">Cohort Progress</div>
                  <div className="text-xs text-[var(--color-ink-500)]">
                    All students in {cohortData.cohortName}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setReportType('individual')}
                className={`flex items-center gap-2.5 rounded-[var(--radius-md)] border p-3 text-left transition-all ${
                  reportType === 'individual'
                    ? 'border-[var(--color-harbor-600)] bg-[var(--color-harbor-100)]/40 text-[var(--color-harbor-700)] ring-1 ring-[var(--color-harbor-600)]'
                    : 'border-[var(--color-line)] bg-white text-[var(--color-ink-700)] hover:bg-[var(--color-paper)]'
                }`}
              >
                <User size={18} className="shrink-0" />
                <div>
                  <div className="text-sm font-semibold">Individual Student</div>
                  <div className="text-xs text-[var(--color-ink-500)]">
                    Single student detailed view
                  </div>
                </div>
              </button>
            </div>
            {(isStudent || isParent) && (
              <p className="mt-1.5 text-xs text-[var(--color-ink-500)] italic">
                Role policy: {isStudent ? 'Students' : 'Parents'} can only export individual progress records.
              </p>
            )}
          </div>

          {/* Student Selector if Individual */}
          {reportType === 'individual' && (
            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink-700)] uppercase tracking-wider mb-1.5">
                Select Student
              </label>
              <select
                disabled={isStudent || isParent}
                value={chosenStudentId}
                onChange={(e) => setChosenStudentId(e.target.value)}
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm text-[var(--color-ink-900)] focus:border-[var(--color-harbor-500)] focus:outline-none"
              >
                {cohortData.students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.studentName} ({s.status} · {s.overallProgress}% Overall)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Reporting Period */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-ink-700)] uppercase tracking-wider mb-1.5">
              Reporting Period
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setReportingPeriod('all')}
                className={`rounded-[var(--radius-md)] border py-2 px-2.5 text-center text-xs font-semibold transition-all ${
                  reportingPeriod === 'all'
                    ? 'border-[var(--color-harbor-600)] bg-[var(--color-harbor-100)]/60 text-[var(--color-harbor-700)]'
                    : 'border-[var(--color-line)] bg-white text-[var(--color-ink-600)] hover:bg-[var(--color-paper)]'
                }`}
              >
                All Training Weeks
              </button>
              <button
                type="button"
                onClick={() => setReportingPeriod('current')}
                className={`rounded-[var(--radius-md)] border py-2 px-2.5 text-center text-xs font-semibold transition-all ${
                  reportingPeriod === 'current'
                    ? 'border-[var(--color-harbor-600)] bg-[var(--color-harbor-100)]/60 text-[var(--color-harbor-700)]'
                    : 'border-[var(--color-line)] bg-white text-[var(--color-ink-600)] hover:bg-[var(--color-paper)]'
                }`}
              >
                Current Week (Week {cohortData.weeks[cohortData.weeks.length - 1]?.week || 5})
              </button>
              <button
                type="button"
                onClick={() => setReportingPeriod('custom')}
                className={`rounded-[var(--radius-md)] border py-2 px-2.5 text-center text-xs font-semibold transition-all ${
                  reportingPeriod === 'custom'
                    ? 'border-[var(--color-harbor-600)] bg-[var(--color-harbor-100)]/60 text-[var(--color-harbor-700)]'
                    : 'border-[var(--color-line)] bg-white text-[var(--color-ink-600)] hover:bg-[var(--color-paper)]'
                }`}
              >
                Custom Range
              </button>
            </div>

            {reportingPeriod === 'custom' && (
              <div className="mt-2.5 flex items-center gap-2 text-xs">
                <span className="text-[var(--color-ink-600)] font-medium">From:</span>
                <select
                  value={startWeek}
                  onChange={(e) => setStartWeek(Number(e.target.value))}
                  className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-xs text-[var(--color-ink-800)]"
                >
                  {cohortData.weeks.map((w) => (
                    <option key={w.week} value={w.week}>
                      Week {w.week}
                    </option>
                  ))}
                </select>
                <span className="text-[var(--color-ink-600)] font-medium">To:</span>
                <select
                  value={endWeek}
                  onChange={(e) => setEndWeek(Number(e.target.value))}
                  className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-xs text-[var(--color-ink-800)]"
                >
                  {cohortData.weeks.map((w) => (
                    <option key={w.week} value={w.week}>
                      Week {w.week}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Format Selection */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-ink-700)] uppercase tracking-wider mb-1.5">
              Format
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormat('pdf')}
                className={`flex items-center gap-2.5 rounded-[var(--radius-md)] border p-2.5 transition-all ${
                  format === 'pdf'
                    ? 'border-[var(--color-harbor-600)] bg-[var(--color-harbor-100)]/40 text-[var(--color-harbor-700)] ring-1 ring-[var(--color-harbor-600)]'
                    : 'border-[var(--color-line)] bg-white text-[var(--color-ink-700)] hover:bg-[var(--color-paper)]'
                }`}
              >
                <FileText size={18} className="text-[var(--color-danger-600)] shrink-0" />
                <div className="text-left">
                  <div className="text-xs font-bold">PDF Document</div>
                  <div className="text-[11px] text-[var(--color-ink-500)]">
                    Print-ready official layout
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat('excel')}
                className={`flex items-center gap-2.5 rounded-[var(--radius-md)] border p-2.5 transition-all ${
                  format === 'excel'
                    ? 'border-[var(--color-harbor-600)] bg-[var(--color-harbor-100)]/40 text-[var(--color-harbor-700)] ring-1 ring-[var(--color-harbor-600)]'
                    : 'border-[var(--color-line)] bg-white text-[var(--color-ink-700)] hover:bg-[var(--color-paper)]'
                }`}
              >
                <FileSpreadsheet size={18} className="text-[var(--color-success-600)] shrink-0" />
                <div className="text-left">
                  <div className="text-xs font-bold">Excel Spreadsheet</div>
                  <div className="text-[11px] text-[var(--color-ink-500)]">
                    Structured CSV data tables
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-[var(--color-line)] pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-paper)]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isGenerating}
            onClick={handleDownload}
            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-harbor-600)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-harbor-700)] shadow-xs disabled:opacity-50"
          >
            <Download size={16} />
            <span>{isGenerating ? 'Preparing Report...' : 'Download Report'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
