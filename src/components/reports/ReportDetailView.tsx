import { useState } from 'react'
import {
  Download,
  Share2,
  Edit3,
  Globe,
  Lock,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Award,
  FileText,
  Calendar,
  Layers,
  History,
} from 'lucide-react'
import type { ProgressReport } from '@/lib/reports'
import { togglePublishReport, logReportAudit } from '@/lib/reports'
import { generateStudentProgressReportPdf } from '@/lib/pdfGenerator'
import { sendReportPublishedNotification } from '@/lib/notifications'
import { ShareReportModal } from './ShareReportModal'
import { EditReportModal } from './EditReportModal'
import { useAuth } from '@/app/auth'

interface ReportDetailViewProps {
  report: ProgressReport
  onBack: () => void
  onReportUpdated: (updated: ProgressReport) => void
}

export function ReportDetailView({
  report,
  onBack,
  onReportUpdated,
}: ReportDetailViewProps) {
  const { user, profile } = useAuth()

  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadSuccessToast, setDownloadSuccessToast] = useState<string | null>(null)

  const actor = {
    name: profile?.full_name || user?.name || 'Authorized Staff',
    role: profile?.role || 'staff',
  }

  // Permission checks
  const canEdit = ['admin', 'manager', 'trainer'].includes(profile?.role || 'admin')
  const isPublished = report.status === 'published'

  // Main Action: Download PDF
  const handleDownloadPdf = () => {
    setIsDownloading(true)
    try {
      const generated = generateStudentProgressReportPdf(report)
      generated.save()

      // Record audit log
      const updated = logReportAudit(report.id, 'downloaded', actor, {
        note: `Official PDF downloaded (${generated.filename}).`,
      })
      if (updated) onReportUpdated(updated)

      setDownloadSuccessToast(`Downloaded ${generated.filename}`)
      setTimeout(() => setDownloadSuccessToast(null), 4000)
    } catch (err) {
      console.error('Failed to generate PDF:', err)
      setDownloadSuccessToast('Error generating PDF. Please try again.')
    } finally {
      setIsDownloading(false)
    }
  }

  // Toggle publish
  const handleTogglePublish = () => {
    const updated = togglePublishReport(report.id, actor)
    if (updated) {
      if (updated.status === 'published') {
        sendReportPublishedNotification({
          studentId: report.student_id,
          studentName: report.student_name,
          courseName: report.course_name,
          reportId: report.id,
        })
      }
      onReportUpdated(updated)
    }
  }

  return (
    <div id="report-detail-container" className="space-y-6 pb-16 animate-fade-in">
      {/* Top Navigation & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--color-ink-800)]">
        <button
          id="back-to-reports-roster-btn"
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-medium text-[var(--color-ink-300)] hover:text-white transition-colors w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Progress Reports Roster</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Status badge */}
          <span
            id="report-status-badge"
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
              isPublished
                ? 'bg-emerald-950/70 border border-emerald-800 text-emerald-300'
                : 'bg-amber-950/70 border border-amber-800 text-amber-300'
            }`}
          >
            {isPublished ? <Globe className="w-3.5 h-3.5 text-emerald-400" /> : <Lock className="w-3.5 h-3.5 text-amber-400" />}
            {isPublished ? 'Published Report' : 'Draft Review'}
          </span>

          <span className="text-xs text-[var(--color-ink-400)] hidden sm:inline">
            Updated {new Date(report.updated_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Success Notification Toast */}
      {downloadSuccessToast && (
        <div
          id="download-toast-banner"
          className="p-3 bg-emerald-950/80 border border-emerald-700 text-emerald-200 text-xs rounded-lg flex items-center justify-between shadow-lg"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{downloadSuccessToast}</span>
          </div>
          <button
            onClick={() => setDownloadSuccessToast(null)}
            className="text-emerald-400 hover:text-white text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Hero Header Card with Core Actions */}
      <div className="bg-[var(--color-ink-850)] border border-[var(--color-ink-700)] rounded-xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Title & Metadata */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-[var(--color-harbor-500)]/20 text-[var(--color-harbor-300)] border border-[var(--color-harbor-500)]/30">
                {report.cohort_name}
              </span>
              <span className="text-xs text-[var(--color-ink-400)]">•</span>
              <span className="text-xs text-[var(--color-ink-300)] font-medium">
                {report.course_name}
              </span>
            </div>

            <h1 id="report-detail-student-name" className="text-2xl font-bold text-white tracking-tight">
              {report.student_name}
            </h1>

            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-[var(--color-ink-300)]">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[var(--color-harbor-400)]" />
                Reporting Period: <strong className="text-white font-medium">{report.reporting_period}</strong>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-amber-400" />
                Status: <strong className="text-white font-medium">{report.student_status}</strong>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                Evaluator: <strong className="text-white font-medium">{report.trainer_name}</strong>
              </span>
            </div>
          </div>

          {/* Action Buttons Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* 1. Edit Report */}
            {canEdit && (
              <button
                id="edit-report-action-btn"
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="px-3.5 py-2.5 bg-[var(--color-ink-800)] hover:bg-[var(--color-ink-750)] text-white text-xs font-medium rounded-lg border border-[var(--color-ink-700)] flex items-center gap-1.5 transition-colors"
              >
                <Edit3 className="w-4 h-4 text-[var(--color-ink-300)]" />
                <span>Edit Report</span>
              </button>
            )}

            {/* 2. Publish / Unpublish Report */}
            {canEdit && (
              <button
                id="publish-report-toggle-btn"
                type="button"
                onClick={handleTogglePublish}
                className={`px-3.5 py-2.5 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition-colors ${
                  isPublished
                    ? 'bg-[var(--color-ink-800)] hover:bg-[var(--color-ink-750)] text-amber-300 border-amber-800/60'
                    : 'bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border-emerald-700'
                }`}
              >
                {isPublished ? <Lock className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                <span>{isPublished ? 'Revert to Draft' : 'Publish Report'}</span>
              </button>
            )}

            {/* 4. Share Report */}
            <button
              id="share-report-action-btn"
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              className="px-4 py-2.5 bg-[var(--color-ink-750)] hover:bg-[var(--color-ink-700)] text-white text-xs font-semibold rounded-lg border border-[var(--color-ink-600)] flex items-center gap-2 transition-all shadow-sm"
            >
              <Share2 className="w-4 h-4 text-[var(--color-harbor-400)]" />
              <span>Share Report</span>
            </button>

            {/* 3. Main Action: Download PDF */}
            <button
              id="download-pdf-main-action-btn"
              type="button"
              disabled={isDownloading}
              onClick={handleDownloadPdf}
              className="px-5 py-2.5 bg-[var(--color-harbor-600)] hover:bg-[var(--color-harbor-500)] text-white text-xs font-bold rounded-lg shadow-md flex items-center gap-2 transition-all ring-1 ring-[var(--color-harbor-400)]/40 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloading ? 'Generating PDF...' : 'Download PDF'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Progress Summary Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Overall Progress', value: `${report.metrics.overall_progress}%`, sub: 'Pacing vs Target', highlight: true },
          { label: 'Attendance Rate', value: `${report.metrics.attendance_rate}%`, sub: `${report.attendance_summary.sessions_attended} Sessions Attended` },
          { label: 'Assignments', value: `${report.metrics.assignment_performance}%`, sub: 'Lab Practical Scores' },
          { label: 'Projects', value: `${report.metrics.project_performance}%`, sub: 'Defensive Builds' },
          { label: 'Assessments', value: `${report.metrics.assessment_performance}%`, sub: 'Test & Exam Average' },
          { label: 'Training Progress', value: `${report.metrics.training_progress}%`, sub: 'Curriculum Completed' },
        ].map((card, idx) => (
          <div
            key={idx}
            id={`metric-card-${idx}`}
            className={`p-4 rounded-xl border transition-all ${
              card.highlight
                ? 'bg-[var(--color-harbor-500)]/15 border-[var(--color-harbor-500)]/40 text-white'
                : 'bg-[var(--color-ink-850)] border-[var(--color-ink-750)] text-[var(--color-ink-200)]'
            }`}
          >
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)] mb-1">
              {card.label}
            </div>
            <div className="text-2xl font-bold text-white mb-0.5">
              {card.value}
            </div>
            <div className="text-[10px] text-[var(--color-ink-400)]">
              {card.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Progress Over Training Weeks Graph */}
      <div className="bg-[var(--color-ink-850)] border border-[var(--color-ink-700)] rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Progress Over Training Weeks
            </h2>
            <p className="text-xs text-[var(--color-ink-300)]">
              Cumulative mastery and milestone completion across {report.weekly_progress_graph.length} training weeks
            </p>
          </div>
          <div className="text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-3 py-1 rounded-full w-fit">
            Trend: Increasing (+{report.weekly_progress_graph[report.weekly_progress_graph.length - 1]?.progress - report.weekly_progress_graph[0]?.progress}%)
          </div>
        </div>

        {/* SVG Progress Graph */}
        <div className="bg-[var(--color-ink-900)] border border-[var(--color-ink-750)] rounded-lg p-5">
          <div className="relative w-full h-56">
            <svg viewBox="0 0 700 200" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="detailProgressGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0, 25, 50, 75, 100].map((tick) => {
                const y = 170 - (tick / 100) * 140
                return (
                  <g key={tick}>
                    <line x1="45" y1={y} x2="680" y2={y} stroke="rgba(255,255,255,0.07)" strokeDasharray="3 3" />
                    <text x="35" y={y + 4} fill="#64748b" fontSize="10" textAnchor="end" fontFamily="sans-serif">
                      {tick}%
                    </text>
                  </g>
                )
              })}

              {/* Area & Polyline */}
              {(() => {
                const pts = report.weekly_progress_graph
                const n = pts.length
                const coords = pts.map((p, i) => {
                  const x = 70 + (i / Math.max(1, n - 1)) * 590
                  const y = 170 - (p.progress / 100) * 140
                  return { x, y, week: p.week, val: p.progress }
                })

                const dArea =
                  coords.reduce((acc, c, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`, '') +
                  ` L ${coords[coords.length - 1].x} 170 L ${coords[0].x} 170 Z`

                const dLine = coords.reduce((acc, c, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`, '')

                return (
                  <>
                    <path d={dArea} fill="url(#detailProgressGrad)" />
                    <path d={dLine} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
                    {coords.map((c, i) => (
                      <g key={i}>
                        <circle cx={c.x} cy={c.y} r="6" fill="#0f172a" stroke="#3b82f6" strokeWidth="2.5" />
                        <circle cx={c.x} cy={c.y} r="2.5" fill="#60a5fa" />
                        <text x={c.x} y={c.y - 10} fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle">
                          {c.val}%
                        </text>
                        <text x={c.x} y="190" fill="#94a3b8" fontSize="11" fontWeight="600" textAnchor="middle">
                          Week {c.week}
                        </text>
                      </g>
                    ))}
                  </>
                )
              })()}
            </svg>
          </div>
        </div>
      </div>

      {/* Attendance Record & Breakdown */}
      <div className="bg-[var(--color-ink-850)] border border-[var(--color-ink-700)] rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <Clock className="w-4 h-4 text-[var(--color-harbor-400)]" />
            Attendance Summary & Weekly Sessions
          </h2>
          <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-3 py-1 rounded-full">
            {report.attendance_summary.rate}% Attendance Rate
          </span>
        </div>

        {/* KPI metrics row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Overall Rate', val: `${report.attendance_summary.rate}%` },
            { label: 'Sessions Attended', val: `${report.attendance_summary.sessions_attended}` },
            { label: 'Sessions Absent', val: `${report.attendance_summary.sessions_absent}` },
            { label: 'Sessions Late', val: `${report.attendance_summary.sessions_late}` },
            { label: 'Excused Sessions', val: `${report.attendance_summary.excused_sessions}` },
          ].map((item, i) => (
            <div key={i} className="p-3 bg-[var(--color-ink-900)] border border-[var(--color-ink-750)] rounded-lg text-center">
              <div className="text-[10px] uppercase font-semibold text-[var(--color-ink-400)]">{item.label}</div>
              <div className="text-lg font-bold text-white mt-0.5">{item.val}</div>
            </div>
          ))}
        </div>

        {/* Weekly Attendance Table */}
        <div className="overflow-x-auto rounded-lg border border-[var(--color-ink-750)]">
          <table className="w-full text-xs text-left">
            <thead className="bg-[var(--color-ink-900)] text-[var(--color-ink-300)] uppercase font-semibold border-b border-[var(--color-ink-750)]">
              <tr>
                <th className="px-4 py-2.5">Training Week</th>
                <th className="px-4 py-2.5">Date Range</th>
                <th className="px-4 py-2.5 text-center">Sessions Held</th>
                <th className="px-4 py-2.5 text-center">Attended</th>
                <th className="px-4 py-2.5 text-center">Late</th>
                <th className="px-4 py-2.5 text-center">Absent</th>
                <th className="px-4 py-2.5 text-right">Attendance Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-ink-750)] text-[var(--color-ink-200)]">
              {report.attendance_summary.weekly.map((row) => (
                <tr key={row.week} className="hover:bg-[var(--color-ink-800)]/50 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-white">Week {row.week}</td>
                  <td className="px-4 py-2.5 text-[var(--color-ink-300)]">{row.dates}</td>
                  <td className="px-4 py-2.5 text-center">{row.sessionsHeld}</td>
                  <td className="px-4 py-2.5 text-center text-emerald-400 font-semibold">{row.attended}</td>
                  <td className="px-4 py-2.5 text-center text-amber-400">{row.late}</td>
                  <td className="px-4 py-2.5 text-center text-rose-400">{row.absent}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-white">{row.rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Two Column Grid: Assignments and Projects */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assignment Performance */}
        <div className="bg-[var(--color-ink-850)] border border-[var(--color-ink-700)] rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
            <FileText className="w-4 h-4 text-[var(--color-harbor-400)]" />
            Assignment Performance
          </h2>
          <div className="overflow-x-auto rounded-lg border border-[var(--color-ink-750)]">
            <table className="w-full text-xs text-left">
              <thead className="bg-[var(--color-ink-900)] text-[var(--color-ink-300)] uppercase font-semibold border-b border-[var(--color-ink-750)]">
                <tr>
                  <th className="px-3.5 py-2">Assignment</th>
                  <th className="px-3 py-2 text-center">Week</th>
                  <th className="px-3 py-2 text-center">Score</th>
                  <th className="px-3 py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-ink-750)] text-[var(--color-ink-200)]">
                {report.assignments.map((asg, i) => (
                  <tr key={i} className="hover:bg-[var(--color-ink-800)]/50">
                    <td className="px-3.5 py-2 font-medium text-white max-w-[200px] truncate">{asg.name}</td>
                    <td className="px-3 py-2 text-center text-[var(--color-ink-300)]">W{asg.week}</td>
                    <td className="px-3 py-2 text-center font-semibold text-white">
                      {asg.score}/{asg.maxScore}
                    </td>
                    <td className="px-3 py-2 text-right text-emerald-400">{asg.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Project & Assessment Performance */}
        <div className="bg-[var(--color-ink-850)] border border-[var(--color-ink-700)] rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" />
            Assessment Performance
          </h2>
          <div className="overflow-x-auto rounded-lg border border-[var(--color-ink-750)]">
            <table className="w-full text-xs text-left">
              <thead className="bg-[var(--color-ink-900)] text-[var(--color-ink-300)] uppercase font-semibold border-b border-[var(--color-ink-750)]">
                <tr>
                  <th className="px-3.5 py-2">Assessment Title</th>
                  <th className="px-3 py-2 text-center">Week</th>
                  <th className="px-3 py-2 text-center">Score</th>
                  <th className="px-3 py-2 text-right">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-ink-750)] text-[var(--color-ink-200)]">
                {report.assessments.map((asm, i) => (
                  <tr key={i} className="hover:bg-[var(--color-ink-800)]/50">
                    <td className="px-3.5 py-2 font-medium text-white max-w-[200px] truncate">{asm.name}</td>
                    <td className="px-3 py-2 text-center text-[var(--color-ink-300)]">W{asm.week}</td>
                    <td className="px-3 py-2 text-center font-semibold text-white">{asm.percentage}%</td>
                    <td className="px-3 py-2 text-right">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                        {asm.result}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Consolidated Weekly Progress Matrix */}
      <div className="bg-[var(--color-ink-850)] border border-[var(--color-ink-700)] rounded-xl p-6 space-y-4">
        <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
          <Layers className="w-4 h-4 text-[var(--color-harbor-400)]" />
          Consolidated Weekly Progress Table
        </h2>
        <div className="overflow-x-auto rounded-lg border border-[var(--color-ink-750)]">
          <table className="w-full text-xs text-left">
            <thead className="bg-[var(--color-ink-900)] text-[var(--color-ink-300)] uppercase font-semibold border-b border-[var(--color-ink-750)]">
              <tr>
                <th className="px-4 py-2.5">Training Week</th>
                <th className="px-4 py-2.5 text-center">Progress %</th>
                <th className="px-4 py-2.5 text-center">Attendance %</th>
                <th className="px-4 py-2.5">Assignments</th>
                <th className="px-4 py-2.5">Projects</th>
                <th className="px-4 py-2.5">Assessments</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-ink-750)] text-[var(--color-ink-200)]">
              {report.weekly_progress.map((row) => (
                <tr key={row.week} className="hover:bg-[var(--color-ink-800)]/50">
                  <td className="px-4 py-2.5 font-semibold text-white">Week {row.week}</td>
                  <td className="px-4 py-2.5 text-center font-bold text-[var(--color-harbor-300)]">{row.progress}%</td>
                  <td className="px-4 py-2.5 text-center font-semibold text-emerald-400">{row.attendance}%</td>
                  <td className="px-4 py-2.5 text-[var(--color-ink-300)]">{row.assignments}</td>
                  <td className="px-4 py-2.5 text-[var(--color-ink-300)]">{row.projects}</td>
                  <td className="px-4 py-2.5 text-[var(--color-ink-300)]">{row.assessments}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Qualitative Trainer Evaluation */}
      <div className="bg-[var(--color-ink-850)] border border-[var(--color-ink-700)] rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Trainer & Tutor Evaluation
            </h2>
            <p className="text-xs text-[var(--color-ink-300)]">
              Official qualitative assessment provided by {report.trainer_name}
            </p>
          </div>
          {canEdit && (
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="text-xs text-[var(--color-harbor-400)] hover:text-white flex items-center gap-1 font-medium"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit Notes
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-[var(--color-ink-900)] border border-[var(--color-ink-750)] rounded-lg space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-harbor-400)]">
              Progress Summary
            </span>
            <p className="text-[var(--color-ink-200)] leading-relaxed">{report.evaluation.summary}</p>
          </div>

          <div className="p-4 bg-[var(--color-ink-900)] border border-[var(--color-ink-750)] rounded-lg space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              Areas of Strength
            </span>
            <p className="text-[var(--color-ink-200)] leading-relaxed">{report.evaluation.strengths}</p>
          </div>

          <div className="p-4 bg-[var(--color-ink-900)] border border-[var(--color-ink-750)] rounded-lg space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
              Areas Requiring Improvement
            </span>
            <p className="text-[var(--color-ink-200)] leading-relaxed">{report.evaluation.areas_for_improvement}</p>
          </div>

          <div className="p-4 bg-[var(--color-ink-900)] border border-[var(--color-ink-750)] rounded-lg space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
              Recommendations & Next Steps
            </span>
            <p className="text-[var(--color-ink-200)] leading-relaxed">
              <strong>Recommendations:</strong> {report.evaluation.recommendations}
              <br />
              <strong className="mt-1 inline-block">Next Steps:</strong> {report.evaluation.next_steps}
            </p>
          </div>
        </div>
      </div>

      {/* Audit Log & Distribution Trail */}
      <div className="bg-[var(--color-ink-850)] border border-[var(--color-ink-700)] rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
          <History className="w-4 h-4 text-[var(--color-harbor-400)]" />
          Report Audit Trail & Distribution History
        </h2>
        <p className="text-xs text-[var(--color-ink-400)]">
          Cryptographically logged events for report generation, downloads, and external sharing.
        </p>

        <div className="divide-y divide-[var(--color-ink-750)] border border-[var(--color-ink-750)] rounded-lg bg-[var(--color-ink-900)] overflow-hidden text-xs">
          {report.audit_trail.map((item) => (
            <div key={item.id} className="p-3 flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      item.action === 'published'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : item.action === 'downloaded'
                        ? 'bg-blue-950 text-blue-300 border border-blue-800'
                        : item.action === 'shared'
                        ? 'bg-purple-950 text-purple-300 border border-purple-800'
                        : 'bg-[var(--color-ink-800)] text-[var(--color-ink-300)]'
                    }`}
                  >
                    {item.action}
                  </span>
                  <span className="font-semibold text-white">{item.actor_name}</span>
                  <span className="text-[var(--color-ink-400)]">({item.actor_role})</span>
                </div>
                {item.details && <p className="text-[var(--color-ink-300)] text-[11px]">{item.details}</p>}
              </div>
              <span className="text-[11px] text-[var(--color-ink-400)] shrink-0">
                {new Date(item.timestamp).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Share Report Modal */}
      {isShareModalOpen && (
        <ShareReportModal
          report={report}
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          onReportUpdated={onReportUpdated}
        />
      )}

      {/* Edit Report Modal */}
      {isEditModalOpen && (
        <EditReportModal
          report={report}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSaved={onReportUpdated}
        />
      )}
    </div>
  )
}
