import { useState, useMemo } from 'react'
import {
  FileText,
  Plus,
  Search,
  Eye,
  Edit3,
  Trash2,
  Download,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertCircle,
  FolderKanban,
  Sparkles,
  Compass,
  Award,
  BookOpen,
} from 'lucide-react'
import type {
  StudentReport,
  StudentReportStatus,
  StudentReportType,
} from '@/lib/studentReports'
import { generateStudentReportPdf } from '@/lib/studentReports'
import { useAuth } from '@/app/auth'

interface StudentReportsListProps {
  reports: StudentReport[]
  onCreateClick: () => void
  onViewReport: (report: StudentReport) => void
  onEditReport: (report: StudentReport) => void
  onDeleteReport: (reportId: string) => void
  onResubmitReport: (report: StudentReport) => void
}

const TYPE_ICONS: Record<StudentReportType, typeof BookOpen> = {
  'Learning Report': BookOpen,
  'Project Report': FolderKanban,
  'Training Report': Compass,
  'Reflection Report': Sparkles,
  'Achievement Report': Award,
}

export function StudentReportsList({
  reports,
  onCreateClick,
  onViewReport,
  onEditReport,
  onDeleteReport,
  onResubmitReport,
}: StudentReportsListProps) {
  const { role } = useAuth()
  const isStaff = ['admin', 'manager', 'trainer'].includes(role ?? '')

  // Filter States
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StudentReportStatus | 'All'>('All')
  const [typeFilter, setTypeFilter] = useState<StudentReportType | 'All'>('All')

  // Delete draft modal state
  const [deletingReport, setDeletingReport] = useState<StudentReport | null>(null)

  // Metrics counters calculation
  const metrics = useMemo(() => {
    return {
      total: reports.length,
      drafts: reports.filter((r) => r.status === 'Draft').length,
      submitted: reports.filter((r) => r.status === 'Submitted').length,
      underReview: reports.filter((r) => r.status === 'Under Review').length,
      approved: reports.filter((r) => r.status === 'Approved').length,
      returned: reports.filter((r) => r.status === 'Returned').length,
    }
  }, [reports])

  // Filtered reports
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchTitle = r.title.toLowerCase().includes(q)
        const matchCourse = r.course.toLowerCase().includes(q)
        const matchCohort = r.cohort.toLowerCase().includes(q)
        const matchStudent = r.student_name.toLowerCase().includes(q)
        if (!matchTitle && !matchCourse && !matchCohort && !matchStudent) return false
      }

      // Status
      if (statusFilter !== 'All' && r.status !== statusFilter) {
        return false
      }

      // Type
      if (typeFilter !== 'All' && r.type !== typeFilter) {
        return false
      }

      return true
    })
  }, [reports, searchQuery, statusFilter, typeFilter])

  // Quick download helper
  const handleDownload = (r: StudentReport, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const generated = generateStudentReportPdf(r)
      generated.save()
    } catch (err) {
      console.error('Download error:', err)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Metrics Cards (Section 1) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Reports */}
        <div
          onClick={() => setStatusFilter('All')}
          className={`cursor-pointer rounded-[var(--radius-lg)] border p-4 transition-all ${
            statusFilter === 'All'
              ? 'border-[var(--color-harbor-500)] bg-[var(--color-harbor-50)]/50 shadow-xs'
              : 'border-[var(--color-line)] bg-white hover:border-[var(--color-ink-300)]'
          }`}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-500)]">
            Total Reports
          </span>
          <div className="font-display text-2xl font-bold text-[var(--color-ink-900)] mt-1">
            {metrics.total}
          </div>
          <span className="text-[11px] text-[var(--color-ink-400)]">All records</span>
        </div>

        {/* Drafts */}
        <div
          onClick={() => setStatusFilter('Draft')}
          className={`cursor-pointer rounded-[var(--radius-lg)] border p-4 transition-all ${
            statusFilter === 'Draft'
              ? 'border-[var(--color-ink-700)] bg-[var(--color-ink-100)] shadow-xs'
              : 'border-[var(--color-line)] bg-white hover:border-[var(--color-ink-300)]'
          }`}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-500)]">
            Drafts
          </span>
          <div className="font-display text-2xl font-bold text-[var(--color-ink-700)] mt-1">
            {metrics.drafts}
          </div>
          <span className="text-[11px] text-[var(--color-ink-400)]">In progress</span>
        </div>

        {/* Submitted */}
        <div
          onClick={() => setStatusFilter('Submitted')}
          className={`cursor-pointer rounded-[var(--radius-lg)] border p-4 transition-all ${
            statusFilter === 'Submitted'
              ? 'border-[var(--color-harbor-500)] bg-[var(--color-harbor-50)] shadow-xs'
              : 'border-[var(--color-line)] bg-white hover:border-[var(--color-ink-300)]'
          }`}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-500)]">
            Submitted
          </span>
          <div className="font-display text-2xl font-bold text-[var(--color-harbor-700)] mt-1">
            {metrics.submitted}
          </div>
          <span className="text-[11px] text-[var(--color-ink-400)]">Awaiting queue</span>
        </div>

        {/* Under Review */}
        <div
          onClick={() => setStatusFilter('Under Review')}
          className={`cursor-pointer rounded-[var(--radius-lg)] border p-4 transition-all ${
            statusFilter === 'Under Review'
              ? 'border-amber-500 bg-amber-50 shadow-xs'
              : 'border-[var(--color-line)] bg-white hover:border-[var(--color-ink-300)]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-500)]">
              Under Review
            </span>
            <span className="text-xs">🟡</span>
          </div>
          <div className="font-display text-2xl font-bold text-amber-700 mt-1">
            {metrics.underReview}
          </div>
          <span className="text-[11px] text-amber-700/80">Trainer reviewing</span>
        </div>

        {/* Approved */}
        <div
          onClick={() => setStatusFilter('Approved')}
          className={`cursor-pointer rounded-[var(--radius-lg)] border p-4 transition-all ${
            statusFilter === 'Approved'
              ? 'border-emerald-500 bg-emerald-50 shadow-xs'
              : 'border-[var(--color-line)] bg-white hover:border-[var(--color-ink-300)]'
          }`}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-500)]">
            Approved
          </span>
          <div className="font-display text-2xl font-bold text-emerald-700 mt-1">
            {metrics.approved}
          </div>
          <span className="text-[11px] text-emerald-700/80">Accepted</span>
        </div>

        {/* Returned */}
        <div
          onClick={() => setStatusFilter('Returned')}
          className={`cursor-pointer rounded-[var(--radius-lg)] border p-4 transition-all ${
            statusFilter === 'Returned'
              ? 'border-rose-500 bg-rose-50 shadow-xs'
              : 'border-[var(--color-line)] bg-white hover:border-[var(--color-ink-300)]'
          }`}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-500)]">
            Returned
          </span>
          <div className="font-display text-2xl font-bold text-rose-700 mt-1">
            {metrics.returned}
          </div>
          <span className="text-[11px] text-rose-700/80">Edits required</span>
        </div>
      </div>

      {/* Action Header & Search Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-[var(--radius-lg)] border border-[var(--color-line)] shadow-2xs">
        <div className="flex flex-1 items-center gap-2 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-ink-400)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reports by title, course, cohort, or student..."
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white pl-9 pr-3 py-1.5 text-xs text-[var(--color-ink-900)] focus:border-[var(--color-harbor-500)] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as StudentReportType | 'All')}
            className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-xs text-[var(--color-ink-700)] focus:border-[var(--color-harbor-500)] focus:outline-none"
          >
            <option value="All">All Report Types</option>
            <option value="Learning Report">Learning Report</option>
            <option value="Project Report">Project Report</option>
            <option value="Training Report">Training Report</option>
            <option value="Reflection Report">Reflection Report</option>
            <option value="Achievement Report">Achievement Report</option>
          </select>

          {/* Create Report Button (Section 1) */}
          <button
            type="button"
            onClick={onCreateClick}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[var(--color-harbor-600)] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Report
          </button>
        </div>
      </div>

      {/* Reports Table (Section 1) */}
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--color-line)] bg-[var(--color-ink-50)] font-semibold text-[var(--color-ink-700)]">
              <tr>
                <th className="px-4 py-3">Report</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Course / Cohort</th>
                {isStaff && <th className="px-4 py-3">Student</th>}
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {filteredReports.length === 0 ? (
                <tr>
                  <td
                    colSpan={isStaff ? 7 : 6}
                    className="px-4 py-10 text-center text-xs text-[var(--color-ink-500)]"
                  >
                    No reports match your current filter. Click "Create Report" to start a new document.
                  </td>
                </tr>
              ) : (
                filteredReports.map((r) => {
                  const Icon = TYPE_ICONS[r.type] || FileText

                  return (
                    <tr
                      key={r.id}
                      onClick={() => onViewReport(r)}
                      className="hover:bg-[var(--color-ink-50)] cursor-pointer transition-colors"
                    >
                      {/* Report Title */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-[var(--radius-md)] bg-[var(--color-harbor-50)] text-[var(--color-harbor-700)] flex items-center justify-center shrink-0">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="font-display font-semibold text-[var(--color-ink-900)] block truncate max-w-xs sm:max-w-sm">
                              {r.title}
                            </span>
                            <span className="text-[11px] text-[var(--color-ink-400)] font-mono">
                              #{r.id} · {r.sections.length} sections
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3.5 text-[var(--color-ink-700)] font-medium">
                        {r.type}
                      </td>

                      {/* Course / Cohort */}
                      <td className="px-4 py-3.5">
                        <div className="text-[var(--color-ink-900)] font-medium">{r.course}</div>
                        <div className="text-[11px] text-[var(--color-ink-500)]">{r.cohort}</div>
                      </td>

                      {/* Student (staff only) */}
                      {isStaff && (
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-[var(--color-ink-900)]">
                            {r.student_name}
                          </div>
                          <div className="text-[11px] text-[var(--color-ink-500)] truncate max-w-[140px]">
                            {r.student_email}
                          </div>
                        </td>
                      )}

                      {/* Date */}
                      <td className="px-4 py-3.5 text-[var(--color-ink-600)] font-mono whitespace-nowrap">
                        {r.report_date}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {r.status === 'Approved' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" />
                            Approved
                          </span>
                        )}
                        {r.status === 'Under Review' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200">
                            <span>🟡</span>
                            Under Review
                          </span>
                        )}
                        {r.status === 'Submitted' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200">
                            <Clock className="h-3 w-3" />
                            Submitted
                          </span>
                        )}
                        {r.status === 'Returned' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 border border-rose-200">
                            <AlertCircle className="h-3 w-3" />
                            Returned
                          </span>
                        )}
                        {r.status === 'Draft' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-ink-100)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-ink-700)] border border-[var(--color-ink-200)]">
                            Draft
                          </span>
                        )}
                      </td>

                      {/* Action (Section 1: View, Edit, Delete Draft, Download, Resubmit) */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div
                          className="inline-flex items-center justify-end gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* View - always available */}
                          <button
                            type="button"
                            onClick={() => onViewReport(r)}
                            className="rounded p-1 text-[var(--color-ink-500)] hover:bg-[var(--color-ink-100)] hover:text-[var(--color-ink-900)] transition-colors"
                            title="View Report"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {/* Edit - available for Draft and Returned */}
                          {(r.status === 'Draft' || r.status === 'Returned') && (
                            <button
                              type="button"
                              onClick={() => onEditReport(r)}
                              className="rounded p-1 text-[var(--color-harbor-600)] hover:bg-[var(--color-harbor-50)] hover:text-[var(--color-harbor-800)] transition-colors"
                              title="Edit Report"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                          )}

                          {/* Resubmit - quick action for Returned */}
                          {r.status === 'Returned' && (
                            <button
                              type="button"
                              onClick={() => onResubmitReport(r)}
                              className="rounded p-1 text-amber-600 hover:bg-amber-50 hover:text-amber-800 transition-colors"
                              title="Resubmit Report"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          )}

                          {/* Download - available for Approved (and viewable reports) */}
                          {r.status === 'Approved' && (
                            <button
                              type="button"
                              onClick={(e) => handleDownload(r, e)}
                              className="rounded p-1 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-800 transition-colors"
                              title="Download Report PDF"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          )}

                          {/* Delete Draft - only for Drafts */}
                          {r.status === 'Draft' && (
                            <button
                              type="button"
                              onClick={() => setDeletingReport(r)}
                              className="rounded p-1 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                              title="Delete Draft"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DELETE DRAFT CONFIRMATION MODAL */}
      {deletingReport && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-5 shadow-2xl space-y-3">
            <div className="flex items-center gap-2.5 text-rose-600">
              <Trash2 className="h-5 w-5" />
              <h3 className="font-display text-sm font-bold text-[var(--color-ink-900)]">
                Delete Draft Report?
              </h3>
            </div>
            <p className="text-xs text-[var(--color-ink-600)] leading-relaxed">
              Are you sure you want to permanently delete{' '}
              <strong>"{deletingReport.title}"</strong>? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingReport(null)}
                className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteReport(deletingReport.id)
                  setDeletingReport(null)
                }}
                className="rounded-[var(--radius-md)] bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 shadow-xs"
              >
                Delete Draft
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
