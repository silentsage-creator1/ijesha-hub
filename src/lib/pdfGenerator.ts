import { jsPDF } from 'jspdf'
import type { ProgressReport } from '@/lib/reports'
import { getOrganizationSettings } from '@/lib/orgSettings'

export interface GeneratedPdfResult {
  blob: Blob
  file: File
  filename: string
  url: string
  save: () => void
}

/**
 * Formats a clean date string for human viewing (e.g. September 5, 2026)
 */
function formatHumanDate(dateStr?: string | null): string {
  if (!dateStr) return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  } catch {
    return dateStr
  }
}

/**
 * Creates an official, publication-grade A4 Student Progress Report PDF.
 */
export function generateStudentProgressReportPdf(report: ProgressReport): GeneratedPdfResult {
  const org = getOrganizationSettings()
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = 210
  const pageHeight = 297
  const marginX = 14
  const contentWidth = pageWidth - marginX * 2 // 182mm
  const bottomMargin = 22

  let cursorY = marginX

  // Colors
  const inkPrimary = [15, 23, 42] // #0f172a
  const inkSecondary = [71, 85, 105] // #475569
  const inkMuted = [148, 163, 184] // #94a3b8
  const brandBlue = [29, 78, 216] // #1d4ed8
  const brandDark = [30, 58, 138] // #1e3a8a
  const brandLightBg = [239, 246, 255] // #eff6ff
  const cardBg = [248, 250, 252] // #f8fafc
  const cardBorder = [226, 232, 240] // #e2e8f0
  const successColor = [22, 101, 52] // #166534
  const alertColor = [154, 52, 18] // #9a3412

  /**
   * Check if adding requiredHeight would overflow into bottom margin.
   * If so, adds a new page and resets cursorY.
   */
  function checkPageBreak(requiredHeight: number) {
    if (cursorY + requiredHeight > pageHeight - bottomMargin) {
      doc.addPage()
      cursorY = marginX + 4
      drawPageHeaderContinuation()
    }
  }

  function drawPageHeaderContinuation() {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(inkMuted[0], inkMuted[1], inkMuted[2])
    doc.text(
      `${org.name.toUpperCase()} • STUDENT PROGRESS REPORT: ${report.student_name.toUpperCase()}`,
      marginX,
      cursorY
    )
    cursorY += 2
    doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2])
    doc.setLineWidth(0.2)
    doc.line(marginX, cursorY, marginX + contentWidth, cursorY)
    cursorY += 6
  }

  // ==========================================
  // 1. OFFICIAL INSTITUTIONAL HEADER
  // ==========================================
  const orgName = (org.name || 'IJESHA DIGITAL HUB').toUpperCase()
  
  // Header container band
  doc.setFillColor(brandDark[0], brandDark[1], brandDark[2])
  doc.roundedRect(marginX, cursorY, contentWidth, 24, 2, 2, 'F')

  // Accent emblem bar on the left
  doc.setFillColor(59, 130, 246)
  doc.rect(marginX, cursorY, 3.5, 24, 'F')

  // Organization Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(255, 255, 255)
  doc.text(orgName, marginX + 8, cursorY + 9)

  // Subtitle
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(191, 219, 254) // light blue
  doc.text('OFFICIAL STUDENT PROGRESS & PERFORMANCE REPORT', marginX + 8, cursorY + 16)

  // Right badge: Status
  const statusLabel = report.status === 'published' ? 'OFFICIALLY PUBLISHED' : 'DRAFT REVIEW'
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  const badgeWidth = 38
  const badgeX = marginX + contentWidth - badgeWidth - 6
  doc.setFillColor(report.status === 'published' ? 34 : 217, report.status === 'published' ? 197 : 119, report.status === 'published' ? 94 : 6, 0.25)
  doc.roundedRect(badgeX, cursorY + 6, badgeWidth, 11, 1.5, 1.5, 'F')
  doc.setTextColor(255, 255, 255)
  doc.text(statusLabel, badgeX + badgeWidth / 2, cursorY + 13, { align: 'center' })

  cursorY += 28

  // ==========================================
  // 2. STUDENT & REPORT METADATA GRID
  // ==========================================
  doc.setFillColor(cardBg[0], cardBg[1], cardBg[2])
  doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2])
  doc.setLineWidth(0.3)
  doc.roundedRect(marginX, cursorY, contentWidth, 22, 1.5, 1.5, 'FD')

  const metaCols = [
    { label: 'Student Name', value: report.student_name },
    { label: 'Course Track', value: report.course_name },
    { label: 'Cohort', value: report.cohort_name },
    { label: 'Reporting Period', value: report.reporting_period },
    { label: 'Student Status', value: report.student_status },
    { label: 'Report Date', value: formatHumanDate(report.published_at || report.updated_at) },
  ]

  const colWidth = contentWidth / 3
  metaCols.forEach((col, idx) => {
    const row = Math.floor(idx / 3)
    const c = idx % 3
    const x = marginX + c * colWidth + 4
    const y = cursorY + 6 + row * 9

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(inkSecondary[0], inkSecondary[1], inkSecondary[2])
    doc.text(col.label.toUpperCase(), x, y)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(inkPrimary[0], inkPrimary[1], inkPrimary[2])
    doc.text(col.value, x, y + 4.2)
  })

  cursorY += 26

  // ==========================================
  // 3. EXECUTIVE PROGRESS SUMMARY (CARDS)
  // ==========================================
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(brandDark[0], brandDark[1], brandDark[2])
  doc.text('EXECUTIVE PERFORMANCE SUMMARY', marginX, cursorY + 2)
  cursorY += 5

  const summaryCards = [
    { label: 'Overall Progress', val: `${report.metrics.overall_progress}%`, sub: 'Pacing vs Target' },
    { label: 'Attendance Rate', val: `${report.metrics.attendance_rate}%`, sub: `${report.attendance_summary.sessions_attended}/${report.attendance_summary.sessions_attended + report.attendance_summary.sessions_absent} Sessions` },
    { label: 'Assignments', val: `${report.metrics.assignment_performance}%`, sub: 'Lab Submissions' },
    { label: 'Projects', val: `${report.metrics.project_performance}%`, sub: 'Defensive Builds' },
    { label: 'Assessments', val: `${report.metrics.assessment_performance}%`, sub: 'Exam Average' },
    { label: 'Training Progress', val: `${report.metrics.training_progress}%`, sub: 'Milestones Completed' },
  ]

  const cardW = (contentWidth - 5 * 2.5) / 6 // 6 cards
  const cardH = 17
  summaryCards.forEach((card, idx) => {
    const cx = marginX + idx * (cardW + 2.5)
    
    // Fill card
    if (idx === 0) {
      doc.setFillColor(brandLightBg[0], brandLightBg[1], brandLightBg[2])
      doc.setDrawColor(191, 219, 254)
    } else {
      doc.setFillColor(cardBg[0], cardBg[1], cardBg[2])
      doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2])
    }
    doc.setLineWidth(0.3)
    doc.roundedRect(cx, cursorY, cardW, cardH, 1.5, 1.5, 'FD')

    // Card label
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(idx === 0 ? brandBlue[0] : inkSecondary[0], idx === 0 ? brandBlue[1] : inkSecondary[1], idx === 0 ? brandBlue[2] : inkSecondary[2])
    doc.text(card.label.toUpperCase(), cx + cardW / 2, cursorY + 4.5, { align: 'center' })

    // Value
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(idx === 0 ? brandDark[0] : inkPrimary[0], idx === 0 ? brandDark[1] : inkPrimary[1], idx === 0 ? brandDark[2] : inkPrimary[2])
    doc.text(card.val, cx + cardW / 2, cursorY + 11, { align: 'center' })

    // Subtext
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(5.5)
    doc.setTextColor(inkMuted[0], inkMuted[1], inkMuted[2])
    doc.text(card.sub, cx + cardW / 2, cursorY + 15, { align: 'center' })
  })

  cursorY += cardH + 7

  // ==========================================
  // 4. PROGRESS OVER TRAINING WEEKS GRAPH
  // ==========================================
  checkPageBreak(58)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(brandDark[0], brandDark[1], brandDark[2])
  doc.text('PROGRESS OVER TRAINING WEEKS', marginX, cursorY + 2)
  
  // Trend indicator badge
  const points = report.weekly_progress_graph || [
    { week: 1, progress: 30 },
    { week: 2, progress: 48 },
    { week: 3, progress: 65 },
    { week: 4, progress: 75 },
    { week: 5, progress: 85 },
  ]
  const lastPoint = points[points.length - 1]?.progress ?? 85
  const firstPoint = points[0]?.progress ?? 30
  const trendPositive = lastPoint >= firstPoint

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(trendPositive ? successColor[0] : alertColor[0], trendPositive ? successColor[1] : alertColor[1], trendPositive ? successColor[2] : alertColor[2])
  doc.text(
    `Trend: ${trendPositive ? 'Increasing (+ ' + (lastPoint - firstPoint) + '%)' : 'Steady'}`,
    marginX + contentWidth - 4,
    cursorY + 2,
    { align: 'right' }
  )

  cursorY += 5

  // Chart Container
  const chartH = 46
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2])
  doc.setLineWidth(0.3)
  doc.roundedRect(marginX, cursorY, contentWidth, chartH, 2, 2, 'FD')

  // Graph plotting area inside container
  const chartPaddingLeft = 20
  const chartPaddingRight = 18
  const chartPaddingTop = 7
  const chartPaddingBottom = 11

  const graphX = marginX + chartPaddingLeft
  const graphY = cursorY + chartPaddingTop
  const graphW = contentWidth - chartPaddingLeft - chartPaddingRight
  const graphH = chartH - chartPaddingTop - chartPaddingBottom

  // Y-axis grid lines (0%, 25%, 50%, 75%, 100%)
  const yTicks = [0, 25, 50, 75, 100]
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')

  yTicks.forEach((tick) => {
    const yPos = graphY + graphH - (tick / 100) * graphH
    
    // Dotted grid line
    doc.setDrawColor(241, 245, 249)
    doc.setLineWidth(0.2)
    doc.line(graphX, yPos, graphX + graphW, yPos)

    // Label
    doc.setTextColor(inkMuted[0], inkMuted[1], inkMuted[2])
    doc.text(`${tick}%`, graphX - 3, yPos + 1.2, { align: 'right' })
  })

  // Y-axis main line
  doc.setDrawColor(203, 213, 225)
  doc.setLineWidth(0.4)
  doc.line(graphX, graphY, graphX, graphY + graphH)

  // X-axis baseline
  doc.line(graphX, graphY + graphH, graphX + graphW, graphY + graphH)

  // Plot data points
  const numPoints = points.length
  const coords: Array<{ x: number; y: number; week: number; progress: number }> = []

  points.forEach((pt, i) => {
    const xPos = numPoints > 1 ? graphX + (i / (numPoints - 1)) * graphW : graphX + graphW / 2
    const yPos = graphY + graphH - (Math.min(100, Math.max(0, pt.progress)) / 100) * graphH
    coords.push({ x: xPos, y: yPos, week: pt.week, progress: pt.progress })

    // X-axis label
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(inkSecondary[0], inkSecondary[1], inkSecondary[2])
    doc.text(`Week ${pt.week}`, xPos, graphY + graphH + 5, { align: 'center' })
  })

  // Draw smooth polyline for progress
  if (coords.length > 1) {
    doc.setDrawColor(brandBlue[0], brandBlue[1], brandBlue[2])
    doc.setLineWidth(1.1)
    for (let i = 0; i < coords.length - 1; i++) {
      doc.line(coords[i].x, coords[i].y, coords[i + 1].x, coords[i + 1].y)
    }
  }

  // Draw node points and values
  coords.forEach((pt) => {
    // Outer white halo
    doc.setFillColor(255, 255, 255)
    doc.circle(pt.x, pt.y, 2.2, 'F')

    // Inner brand blue circle
    doc.setFillColor(brandBlue[0], brandBlue[1], brandBlue[2])
    doc.circle(pt.x, pt.y, 1.4, 'F')

    // Value tag above node
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(brandDark[0], brandDark[1], brandDark[2])
    doc.text(`${pt.progress}%`, pt.x, pt.y - 2.8, { align: 'center' })
  })

  cursorY += chartH + 7

  // ==========================================
  // 5. ATTENDANCE SUMMARY & WEEKLY TABLE
  // ==========================================
  checkPageBreak(52)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(brandDark[0], brandDark[1], brandDark[2])
  doc.text('ATTENDANCE RECORD & BREAKDOWN', marginX, cursorY + 2)
  cursorY += 5

  // Attendance KPI banner
  const attKpis = [
    { label: 'Overall Rate', val: `${report.attendance_summary.rate}%` },
    { label: 'Sessions Attended', val: `${report.attendance_summary.sessions_attended}` },
    { label: 'Sessions Absent', val: `${report.attendance_summary.sessions_absent}` },
    { label: 'Sessions Late', val: `${report.attendance_summary.sessions_late}` },
    { label: 'Excused Sessions', val: `${report.attendance_summary.excused_sessions}` },
  ]
  const attKpiW = contentWidth / 5
  doc.setFillColor(cardBg[0], cardBg[1], cardBg[2])
  doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2])
  doc.roundedRect(marginX, cursorY, contentWidth, 12, 1.5, 1.5, 'FD')

  attKpis.forEach((item, i) => {
    const x = marginX + i * attKpiW + attKpiW / 2
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.setTextColor(inkSecondary[0], inkSecondary[1], inkSecondary[2])
    doc.text(item.label.toUpperCase(), x, cursorY + 4.2, { align: 'center' })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(inkPrimary[0], inkPrimary[1], inkPrimary[2])
    doc.text(item.val, x, cursorY + 9.5, { align: 'center' })
  })

  cursorY += 15

  // Weekly Attendance Table
  const attHeaders = ['Training Week', 'Date Range', 'Sessions Held', 'Attended', 'Late', 'Absent', 'Rate (%)']
  const attColWidths = [26, 38, 28, 24, 20, 20, 26]
  
  // Table Header
  doc.setFillColor(brandDark[0], brandDark[1], brandDark[2])
  doc.rect(marginX, cursorY, contentWidth, 6.5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(255, 255, 255)

  let curX = marginX
  attHeaders.forEach((th, i) => {
    const w = attColWidths[i]
    const align = i >= 2 ? 'center' : 'left'
    const xPos = align === 'center' ? curX + w / 2 : curX + 2.5
    doc.text(th, xPos, cursorY + 4.5, { align: align as 'left' | 'center' })
    curX += w
  })

  cursorY += 6.5

  // Table Rows
  report.attendance_summary.weekly.forEach((row, idx) => {
    const rowH = 6
    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252)
    doc.rect(marginX, cursorY, contentWidth, rowH, 'F')
    doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2])
    doc.setLineWidth(0.15)
    doc.line(marginX, cursorY + rowH, marginX + contentWidth, cursorY + rowH)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(inkPrimary[0], inkPrimary[1], inkPrimary[2])

    let rX = marginX
    const vals = [
      `Week ${row.week}`,
      row.dates,
      `${row.sessionsHeld}`,
      `${row.attended}`,
      `${row.late}`,
      `${row.absent}`,
      `${row.rate}%`,
    ]

    vals.forEach((v, c) => {
      const w = attColWidths[c]
      const align = c >= 2 ? 'center' : 'left'
      const xPos = align === 'center' ? rX + w / 2 : rX + 2.5
      if (c === 6 && row.rate >= 80) {
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(successColor[0], successColor[1], successColor[2])
      } else if (c === 6 && row.rate < 75) {
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(alertColor[0], alertColor[1], alertColor[2])
      } else {
        doc.setFont('helvetica', c === 0 ? 'bold' : 'normal')
        doc.setTextColor(inkPrimary[0], inkPrimary[1], inkPrimary[2])
      }
      doc.text(v, xPos, cursorY + 4.2, { align: align as 'left' | 'center' })
      rX += w
    })

    cursorY += rowH
  })

  cursorY += 8

  // ==========================================
  // 6. ASSIGNMENT PERFORMANCE TABLE
  // ==========================================
  checkPageBreak(50)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(brandDark[0], brandDark[1], brandDark[2])
  doc.text('ASSIGNMENT PERFORMANCE', marginX, cursorY + 2)
  cursorY += 5

  const asgHeaders = ['Assignment Title', 'Training Week', 'Score', 'Maximum Marks', 'Status']
  const asgColWidths = [86, 28, 22, 26, 20]

  doc.setFillColor(brandDark[0], brandDark[1], brandDark[2])
  doc.rect(marginX, cursorY, contentWidth, 6.5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(255, 255, 255)

  let asgX = marginX
  asgHeaders.forEach((th, i) => {
    const w = asgColWidths[i]
    const align = i === 0 ? 'left' : 'center'
    const xPos = align === 'center' ? asgX + w / 2 : asgX + 2.5
    doc.text(th, xPos, cursorY + 4.5, { align: align as 'left' | 'center' })
    asgX += w
  })

  cursorY += 6.5

  report.assignments.forEach((row, idx) => {
    const rowH = 6
    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252)
    doc.rect(marginX, cursorY, contentWidth, rowH, 'F')
    doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2])
    doc.setLineWidth(0.15)
    doc.line(marginX, cursorY + rowH, marginX + contentWidth, cursorY + rowH)

    let rX = marginX
    const vals = [
      row.name,
      `Week ${row.week}`,
      `${row.score}`,
      `${row.maxScore}`,
      row.status,
    ]

    vals.forEach((v, c) => {
      const w = asgColWidths[c]
      const align = c === 0 ? 'left' : 'center'
      const xPos = align === 'center' ? rX + w / 2 : rX + 2.5
      doc.setFont('helvetica', c === 0 ? 'bold' : 'normal')
      doc.setFontSize(7)
      doc.setTextColor(inkPrimary[0], inkPrimary[1], inkPrimary[2])
      doc.text(v, xPos, cursorY + 4.2, { align: align as 'left' | 'center' })
      rX += w
    })

    cursorY += rowH
  })

  cursorY += 8

  // ==========================================
  // 7. PROJECT & ASSESSMENT PERFORMANCE
  // ==========================================
  checkPageBreak(50)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(brandDark[0], brandDark[1], brandDark[2])
  doc.text('PROJECTS & PRACTICAL EVALUATIONS', marginX, cursorY + 2)
  cursorY += 5

  const prjHeaders = ['Project Name', 'Training Week', 'Score', 'Maximum Marks', 'Status']
  const prjColWidths = [86, 28, 22, 26, 20]

  doc.setFillColor(brandDark[0], brandDark[1], brandDark[2])
  doc.rect(marginX, cursorY, contentWidth, 6.5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(255, 255, 255)

  let prjX = marginX
  prjHeaders.forEach((th, i) => {
    const w = prjColWidths[i]
    const align = i === 0 ? 'left' : 'center'
    const xPos = align === 'center' ? prjX + w / 2 : prjX + 2.5
    doc.text(th, xPos, cursorY + 4.5, { align: align as 'left' | 'center' })
    prjX += w
  })

  cursorY += 6.5

  report.projects.forEach((row, idx) => {
    const rowH = 6
    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252)
    doc.rect(marginX, cursorY, contentWidth, rowH, 'F')
    doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2])
    doc.setLineWidth(0.15)
    doc.line(marginX, cursorY + rowH, marginX + contentWidth, cursorY + rowH)

    let rX = marginX
    const vals = [
      row.name,
      `Week ${row.week}`,
      `${row.score}`,
      `${row.maxScore}`,
      row.status,
    ]

    vals.forEach((v, c) => {
      const w = prjColWidths[c]
      const align = c === 0 ? 'left' : 'center'
      const xPos = align === 'center' ? rX + w / 2 : rX + 2.5
      doc.setFont('helvetica', c === 0 ? 'bold' : 'normal')
      doc.setFontSize(7)
      doc.setTextColor(inkPrimary[0], inkPrimary[1], inkPrimary[2])
      doc.text(v, xPos, cursorY + 4.2, { align: align as 'left' | 'center' })
      rX += w
    })

    cursorY += rowH
  })

  cursorY += 8

  // Assessment performance table
  checkPageBreak(45)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(brandDark[0], brandDark[1], brandDark[2])
  doc.text('ASSESSMENT PERFORMANCE', marginX, cursorY + 2)
  cursorY += 5

  const asmHeaders = ['Assessment Title', 'Training Week', 'Score', 'Percentage', 'Result']
  const asmColWidths = [86, 28, 22, 26, 20]

  doc.setFillColor(brandDark[0], brandDark[1], brandDark[2])
  doc.rect(marginX, cursorY, contentWidth, 6.5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(255, 255, 255)

  let asmX = marginX
  asmHeaders.forEach((th, i) => {
    const w = asmColWidths[i]
    const align = i === 0 ? 'left' : 'center'
    const xPos = align === 'center' ? asmX + w / 2 : asmX + 2.5
    doc.text(th, xPos, cursorY + 4.5, { align: align as 'left' | 'center' })
    asmX += w
  })

  cursorY += 6.5

  report.assessments.forEach((row, idx) => {
    const rowH = 6
    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252)
    doc.rect(marginX, cursorY, contentWidth, rowH, 'F')
    doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2])
    doc.setLineWidth(0.15)
    doc.line(marginX, cursorY + rowH, marginX + contentWidth, cursorY + rowH)

    let rX = marginX
    const vals = [
      row.name,
      `Week ${row.week}`,
      `${row.score}`,
      `${row.percentage}%`,
      row.result,
    ]

    vals.forEach((v, c) => {
      const w = asmColWidths[c]
      const align = c === 0 ? 'left' : 'center'
      const xPos = align === 'center' ? rX + w / 2 : rX + 2.5
      doc.setFont('helvetica', c === 0 ? 'bold' : 'normal')
      doc.setFontSize(7)
      doc.setTextColor(inkPrimary[0], inkPrimary[1], inkPrimary[2])
      doc.text(v, xPos, cursorY + 4.2, { align: align as 'left' | 'center' })
      rX += w
    })

    cursorY += rowH
  })

  cursorY += 8

  // ==========================================
  // 8. WEEKLY PROGRESS MATRIX
  // ==========================================
  checkPageBreak(45)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(brandDark[0], brandDark[1], brandDark[2])
  doc.text('CONSOLIDATED WEEKLY PROGRESS MATRIX', marginX, cursorY + 2)
  cursorY += 5

  const wkpHeaders = ['Training Week', 'Progress', 'Attendance', 'Assignments', 'Projects', 'Assessments']
  const wkpColWidths = [28, 26, 28, 36, 32, 32]

  doc.setFillColor(brandDark[0], brandDark[1], brandDark[2])
  doc.rect(marginX, cursorY, contentWidth, 6.5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(255, 255, 255)

  let wkpX = marginX
  wkpHeaders.forEach((th, i) => {
    const w = wkpColWidths[i]
    const align = i === 0 ? 'left' : 'center'
    const xPos = align === 'center' ? wkpX + w / 2 : wkpX + 2.5
    doc.text(th, xPos, cursorY + 4.5, { align: align as 'left' | 'center' })
    wkpX += w
  })

  cursorY += 6.5

  report.weekly_progress.forEach((row, idx) => {
    const rowH = 6
    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252)
    doc.rect(marginX, cursorY, contentWidth, rowH, 'F')
    doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2])
    doc.setLineWidth(0.15)
    doc.line(marginX, cursorY + rowH, marginX + contentWidth, cursorY + rowH)

    let rX = marginX
    const vals = [
      `Week ${row.week}`,
      `${row.progress}%`,
      `${row.attendance}%`,
      row.assignments,
      row.projects,
      row.assessments,
    ]

    vals.forEach((v, c) => {
      const w = wkpColWidths[c]
      const align = c === 0 ? 'left' : 'center'
      const xPos = align === 'center' ? rX + w / 2 : rX + 2.5
      doc.setFont('helvetica', c === 0 ? 'bold' : 'normal')
      doc.setFontSize(7)
      doc.setTextColor(inkPrimary[0], inkPrimary[1], inkPrimary[2])
      doc.text(v, xPos, cursorY + 4.2, { align: align as 'left' | 'center' })
      rX += w
    })

    cursorY += rowH
  })

  cursorY += 8

  // ==========================================
  // 9. TRAINER / TUTOR QUALITATIVE EVALUATION
  // ==========================================
  checkPageBreak(58)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(brandDark[0], brandDark[1], brandDark[2])
  doc.text('TRAINER & TUTOR EVALUATION', marginX, cursorY + 2)
  cursorY += 5

  const evalSections = [
    { title: 'PROGRESS SUMMARY', text: report.evaluation.summary },
    { title: 'AREAS OF STRENGTH', text: report.evaluation.strengths },
    { title: 'AREAS REQUIRING IMPROVEMENT', text: report.evaluation.areas_for_improvement },
    { title: 'RECOMMENDATIONS', text: report.evaluation.recommendations },
    { title: 'NEXT STEPS', text: report.evaluation.next_steps },
  ]

  evalSections.forEach((sec) => {
    // Measure text height
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    const splitLines = doc.splitTextToSize(sec.text || 'No comments recorded.', contentWidth - 8)
    const blockHeight = 6.5 + splitLines.length * 3.8 + 2.5

    checkPageBreak(blockHeight + 3)

    // Background card
    doc.setFillColor(cardBg[0], cardBg[1], cardBg[2])
    doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2])
    doc.setLineWidth(0.2)
    doc.roundedRect(marginX, cursorY, contentWidth, blockHeight, 1.5, 1.5, 'FD')

    // Section title
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(brandBlue[0], brandBlue[1], brandBlue[2])
    doc.text(sec.title, marginX + 4, cursorY + 4.5)

    // Body text
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(inkPrimary[0], inkPrimary[1], inkPrimary[2])
    doc.text(splitLines, marginX + 4, cursorY + 8.5)

    cursorY += blockHeight + 2.5
  })

  // Sign-off verification block
  checkPageBreak(22)
  doc.setFillColor(brandLightBg[0], brandLightBg[1], brandLightBg[2])
  doc.setDrawColor(191, 219, 254)
  doc.roundedRect(marginX, cursorY, contentWidth, 16, 1.5, 1.5, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(brandDark[0], brandDark[1], brandDark[2])
  doc.text(`Lead Trainer: ${report.trainer_name || 'Academic Faculty'}`, marginX + 6, cursorY + 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(inkSecondary[0], inkSecondary[1], inkSecondary[2])
  doc.text(`Verified & Approved for Institutional Distribution • ${org.name}`, marginX + 6, cursorY + 11.5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(brandBlue[0], brandBlue[1], brandBlue[2])
  doc.text(formatHumanDate(report.published_at || report.updated_at), marginX + contentWidth - 6, cursorY + 11.5, { align: 'right' })

  cursorY += 22

  // ==========================================
  // 10. PROFESSIONAL FOOTERS ON ALL PAGES
  // ==========================================
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)

    // Footer divider line
    doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2])
    doc.setLineWidth(0.2)
    doc.line(marginX, pageHeight - 14, marginX + contentWidth, pageHeight - 14)

    // Left: Org name & doc name
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(inkSecondary[0], inkSecondary[1], inkSecondary[2])
    doc.text(`${org.name} • Student Progress Report`, marginX, pageHeight - 9.5)

    // Center: Generation date
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(inkMuted[0], inkMuted[1], inkMuted[2])
    doc.text(`Report generated on: ${formatHumanDate(new Date().toISOString())}`, marginX + contentWidth / 2, pageHeight - 9.5, { align: 'center' })

    // Right: Page number
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(inkSecondary[0], inkSecondary[1], inkSecondary[2])
    doc.text(`Page ${p} of ${totalPages}`, marginX + contentWidth, pageHeight - 9.5, { align: 'right' })
  }

  // Filename formulation: StudentName_Progress_Report.pdf (no internal IDs)
  const cleanName = report.student_name.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_')
  const filename = `${cleanName}_Progress_Report.pdf`

  const blob = doc.output('blob')
  const file = new File([blob], filename, { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)

  return {
    blob,
    file,
    filename,
    url,
    save: () => doc.save(filename),
  }
}
