import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Search,
  Filter,
  Plus,
  Download,
  Share2,
  ChevronRight,
  FileBarChart,
  ClipboardList,
} from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import type { ProgressReport } from '@/lib/reports'
import {
  getStoredReports,
  saveStoredReports,
  logReportAudit,
} from '@/lib/reports'
import type { StudentReport } from '@/lib/studentReports'
import {
  getStoredStudentReports,
  saveStoredStudentReports,
  getStudentReportsForUser,
} from '@/lib/studentReports'
import { generateStudentProgressReportPdf } from '@/lib/pdfGenerator'
import { ReportDetailView } from '@/components/reports/ReportDetailView'
import { ShareReportModal } from '@/components/reports/ShareReportModal'
import { StudentReportsList } from '@/components/studentReports/StudentReportsList'
import { CreateReportWizard } from '@/components/studentReports/CreateReportWizard'
import { StudentReportDetailModal } from '@/components/studentReports/StudentReportDetailModal'
import { useAuth } from '@/app/auth'

export function ReportsPage() {
  const { user, profile, role, session } = useAuth()
  const isStaff = ['admin', 'manager', 'trainer'].includes(role ?? '')
  const [searchParams, setSearchParams] = useSearchParams()

  // Tab State: 'student-reports' vs 'progress-reports'
  const initialTab = searchParams.get('tab') === 'progress' ? 'progress-reports' : 'student-reports'
  const [activeTab, setActiveTab] = useState<'student-reports' | 'progress-reports'>(initialTab)

  // STUDENT REPORTS STATES (Sections 1-12)
  const [allStudentReports, setAllStudentReports] = useState<StudentReport[]>([])
  const [isCreateWizardOpen, setIsCreateWizardOpen] = useState(false)
  const [editingStudentReport, setEditingStudentReport] = useState<StudentReport | null>(null)
  const [viewingStudentReport, setViewingStudentReport] = useState<StudentReport | null>(null)

  // STAFF PROGRESS REPORTS STATES (Existing)
  const [progressReports, setProgressReports] = useState<ProgressReport[]>([])
  const [selectedProgressReportId, setSelectedProgressReportId] = useState<string | null>(null)

  // Filter states for Progress Reports
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all')
  const [cohortFilter, setCohortFilter] = useState<string>('all')

  // Modals for Progress Reports
  const [sharingReport, setSharingReport] = useState<ProgressReport | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newStudentName, setNewStudentName] = useState('')
  const [newCourseName, setNewCourseName] = useState('')
  const [newCohortName, setNewCohortName] = useState('')
  const [newPeriod, setNewPeriod] = useState('')

  // Load both report sets on mount
  useEffect(() => {
    // 1. Load Student Reports
    const loadedStudentReports = getStoredStudentReports()
    setAllStudentReports(loadedStudentReports)

    // 2. Load Progress Reports
    const loadedProgressReports = getStoredReports()
    setProgressReports(loadedProgressReports)

    // Check URL parameters
    const srepId = searchParams.get('srep')
    if (srepId) {
      const match = loadedStudentReports.find((r) => r.id === srepId)
      if (match) {
        setViewingStudentReport(match)
        setActiveTab('student-reports')
      }
    }

    const reportParam = searchParams.get('id') || searchParams.get('report')
    if (reportParam) {
      const match = loadedProgressReports.find((r) => r.id === reportParam)
      if (match) {
        setSelectedProgressReportId(match.id)
        setActiveTab('progress-reports')
      }
    }
  }, [searchParams])

  // Filter student reports according to role-based permissions (Section 11)
  const userStudentReports = useMemo(() => {
    const userId = profile?.id || session?.user?.id
    const userEmail = session?.user?.email || profile?.organization || (user as { email?: string })?.email
    return getStudentReportsForUser(allStudentReports, role ?? undefined, userId, userEmail)
  }, [allStudentReports, role, profile, session, user])

  // ==========================================
  // STUDENT REPORTS HANDLERS (Sections 1-12)
  // ==========================================
  const handleOpenCreate = () => {
    setEditingStudentReport(null)
    setIsCreateWizardOpen(true)
  }

  const handleOpenEdit = (report: StudentReport) => {
    setEditingStudentReport(report)
    setIsCreateWizardOpen(true)
  }

  const handleViewStudentReport = (report: StudentReport) => {
    setViewingStudentReport(report)
  }

  const handleDeleteStudentReport = (reportId: string) => {
    const updated = allStudentReports.filter((r) => r.id !== reportId)
    setAllStudentReports(updated)
    saveStoredStudentReports(updated)
  }

  const handleResubmitStudentReport = (report: StudentReport) => {
    const updatedReport: StudentReport = {
      ...report,
      status: 'Under Review',
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const updatedList = allStudentReports.map((r) =>
      r.id === report.id ? updatedReport : r
    )
    setAllStudentReports(updatedList)
    saveStoredStudentReports(updatedList)
  }

  const handleStudentReportSaved = (saved: StudentReport) => {
    const exists = allStudentReports.some((r) => r.id === saved.id)
    let updatedList: StudentReport[]
    if (exists) {
      updatedList = allStudentReports.map((r) => (r.id === saved.id ? saved : r))
    } else {
      updatedList = [saved, ...allStudentReports]
    }
    setAllStudentReports(updatedList)
    saveStoredStudentReports(updatedList)
    if (viewingStudentReport && viewingStudentReport.id === saved.id) {
      setViewingStudentReport(saved)
    }
  }

  // ==========================================
  // PROGRESS REPORTS HANDLERS (Staff/Cohort)
  // ==========================================
  const handleSelectProgressReport = (id: string | null) => {
    setSelectedProgressReportId(id)
    if (id) {
      setSearchParams({ id, tab: 'progress' })
    } else {
      searchParams.delete('id')
      searchParams.delete('report')
      setSearchParams(searchParams)
    }
  }

  const handleProgressReportUpdated = (updated: ProgressReport) => {
    setProgressReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
  }

  const activeProgressReport = useMemo(() => {
    if (!selectedProgressReportId) return null
    return progressReports.find((r) => r.id === selectedProgressReportId) || null
  }, [progressReports, selectedProgressReportId])

  const handleQuickProgressDownload = (report: ProgressReport, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const actor = {
        name: profile?.full_name || user?.name || 'Authorized Staff',
        role: profile?.role || 'staff',
      }
      const generated = generateStudentProgressReportPdf(report)
      generated.save()

      const updated = logReportAudit(report.id, 'downloaded', actor, {
        note: `PDF downloaded from Progress Reports roster (${generated.filename}).`,
      })
      if (updated) handleProgressReportUpdated(updated)
    } catch (err) {
      console.error('Quick download failed:', err)
    }
  }

  const handleQuickShare = (report: ProgressReport, e: React.MouseEvent) => {
    e.stopPropagation()
    setSharingReport(report)
  }

  const handleCreateProgressReport = (e: React.FormEvent) => {
    e.preventDefault()
    const cleanId = `rep-${Date.now().toString().slice(-6)}`
    const newReport: ProgressReport = {
      id: cleanId,
      student_id: `std-${Date.now()}`,
      student_name: newStudentName,
      student_email: `${newStudentName.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      course_name: newCourseName,
      cohort_name: newCohortName,
      reporting_period: newPeriod,
      student_status: 'On Track',
      status: 'draft',
      created_at: new Date().toISOString(),
      published_at: null,
      updated_at: new Date().toISOString(),
      trainer_name: profile?.full_name || 'Technical Trainer',
      metrics: {
        overall_progress: 0,
        attendance_rate: 0,
        assignment_performance: 0,
        project_performance: 0,
        assessment_performance: 0,
        training_progress: 0,
      },
      weekly_progress_graph: [],
      attendance_summary: {
        rate: 88,
        sessions_attended: 13,
        sessions_absent: 2,
        sessions_late: 0,
        excused_sessions: 0,
        weekly: [
          { week: 1, dates: 'Aug 03 – Aug 07', sessionsHeld: 3, attended: 3, late: 0, absent: 0, rate: 100 },
          { week: 2, dates: 'Aug 10 – Aug 14', sessionsHeld: 3, attended: 3, late: 0, absent: 0, rate: 100 },
          { week: 3, dates: 'Aug 17 – Aug 21', sessionsHeld: 3, attended: 2, late: 0, absent: 1, rate: 67 },
          { week: 4, dates: 'Aug 24 – Aug 28', sessionsHeld: 3, attended: 2, late: 0, absent: 1, rate: 67 },
          { week: 5, dates: 'Aug 31 – Sep 04', sessionsHeld: 3, attended: 3, late: 0, absent: 0, rate: 100 },
        ],
      },
      assignments: [
        { name: 'CIA Triad & Threat Vector Analysis', week: 1, score: 25, maxScore: 30, status: 'Graded' },
        { name: 'Packet Analysis & Wireshark Log Inspection', week: 2, score: 26, maxScore: 30, status: 'Graded' },
      ],
      projects: [
        { name: 'Enterprise Network Topology Defense Architecture', week: 2, score: 38, maxScore: 50, status: 'Completed' },
      ],
      assessments: [
        { name: 'Cybersecurity Fundamentals Quiz', week: 1, score: 35, percentage: 88, result: 'Passed' },
      ],
      weekly_progress: [
        { week: 1, progress: 25, attendance: 100, assignments: '1/1 submitted', projects: '0/0', assessments: '1/1 passed' },
      ],
      evaluation: {
        summary: `${newStudentName} is demonstrating consistent engagement across coursework modules.`,
        strengths: 'Disciplined laboratory participation and punctual deliverables.',
        areas_for_improvement: 'Focus on speed during packet analysis quizzes.',
        recommendations: 'Complete extra command line practice modules.',
        next_steps: 'Review incident response simulations for Week 6.',
      },
      audit_trail: [
        {
          id: `aud-${Date.now()}`,
          action: 'created',
          actor_name: profile?.full_name || user?.name || 'Authorized Staff',
          actor_role: profile?.role || 'staff',
          timestamp: new Date().toISOString(),
          details: 'New draft student progress report created.',
        },
      ],
    }

    const updated = [newReport, ...progressReports]
    setProgressReports(updated)
    saveStoredReports(updated)
    setIsCreateModalOpen(false)
    handleSelectProgressReport(newReport.id)
  }

  // Filtered Progress Reports
  const filteredProgressReports = useMemo(() => {
    return progressReports.filter((r) => {
      if (profile?.role === 'student') {
        const studentNameClean = (profile?.full_name || '').toLowerCase()
        const isOwn =
          (studentNameClean && r.student_name.toLowerCase().includes(studentNameClean)) ||
          (profile.id && r.student_id === profile.id)
        if (!isOwn || r.status !== 'published') return false
      }

      if (
        searchQuery &&
        !r.student_name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !r.course_name.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false
      }

      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (cohortFilter !== 'all' && r.cohort_name !== cohortFilter) return false
      return true
    })
  }, [progressReports, searchQuery, statusFilter, cohortFilter, profile])

  // Progress Metrics
  const progressMetrics = useMemo(() => {
    const total = progressReports.length
    const published = progressReports.filter((r) => r.status === 'published').length
    const draft = progressReports.filter((r) => r.status === 'draft').length
    const downloadsOrShares = progressReports.reduce((acc, r) => {
      const actions = r.audit_trail.filter((a) => a.action === 'downloaded' || a.action === 'shared').length
      return acc + actions
    }, 0)
    return { total, published, draft, downloadsOrShares }
  }, [progressReports])

  // If a single Progress Report is open, show its full view
  if (activeProgressReport) {
    return (
      <div className="space-y-6">
        <ReportDetailView
          report={activeProgressReport}
          onBack={() => handleSelectProgressReport(null)}
          onReportUpdated={handleProgressReportUpdated}
        />
      </div>
    )
  }

  return (
    <div id="reports-page-container" className="space-y-6 pb-16">
      {/* Page Header (Section 1) */}
      <PageHeader
        title="Reports"
        subtitle={
          role === 'student'
            ? 'Document your learning progress, completed project milestones, and training reflections for instructor evaluation.'
            : isStaff
            ? 'Review submitted student training reports, evaluate learning milestones, and manage cohort progress reports.'
            : 'Guardian portal: Review verified training reports, instructor evaluations, and milestone achievements for your enrolled child.'
        }
        actions={
          <div className="flex items-center gap-2.5">
            {/* Create Report Button (Section 1) */}
            <button
              id="header-create-report-btn"
              type="button"
              onClick={handleOpenCreate}
              className="px-4 py-2 bg-[var(--color-harbor-600)] hover:bg-[var(--color-harbor-500)] text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create Report</span>
            </button>
          </div>
        }
      />

      {/* Top Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-[var(--color-line)] pb-2 text-xs font-semibold">
        <button
          type="button"
          onClick={() => {
            setActiveTab('student-reports')
            setSearchParams({ tab: 'student' })
          }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-[var(--radius-md)] transition-colors ${
            activeTab === 'student-reports'
              ? 'bg-[var(--color-harbor-500)] text-white shadow-2xs'
              : 'text-[var(--color-ink-600)] hover:bg-[var(--color-ink-100)]'
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          <span>{isStaff ? 'Student Reports (Review Queue)' : 'My Reports'}</span>
          <span
            className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'student-reports'
                ? 'bg-white/20 text-white'
                : 'bg-[var(--color-ink-200)] text-[var(--color-ink-700)]'
            }`}
          >
            {userStudentReports.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('progress-reports')
            setSearchParams({ tab: 'progress' })
          }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-[var(--radius-md)] transition-colors ${
            activeTab === 'progress-reports'
              ? 'bg-[var(--color-harbor-500)] text-white shadow-2xs'
              : 'text-[var(--color-ink-600)] hover:bg-[var(--color-ink-100)]'
          }`}
        >
          <FileBarChart className="h-4 w-4" />
          <span>{isStaff ? 'Cohort Progress Reports' : 'Trainer Evaluations'}</span>
          <span
            className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'progress-reports'
                ? 'bg-white/20 text-white'
                : 'bg-[var(--color-ink-200)] text-[var(--color-ink-700)]'
            }`}
          >
            {progressReports.length}
          </span>
        </button>
      </div>

      {/* ==================================================== */}
      {/* TAB 1: STUDENT REPORTS DASHBOARD (Sections 1 to 12)  */}
      {/* ==================================================== */}
      {activeTab === 'student-reports' && (
        <StudentReportsList
          reports={userStudentReports}
          onCreateClick={handleOpenCreate}
          onViewReport={handleViewStudentReport}
          onEditReport={handleOpenEdit}
          onDeleteReport={handleDeleteStudentReport}
          onResubmitReport={handleResubmitStudentReport}
        />
      )}

      {/* ==================================================== */}
      {/* TAB 2: COHORT PROGRESS REPORTS (Staff / Evaluation) */}
      {/* ==================================================== */}
      {activeTab === 'progress-reports' && (
        <div className="space-y-6">
          {/* KPI Stats Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-[var(--color-ink-50)] border border-[var(--color-line)] rounded-xl">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-500)]">
                Total Reports
              </div>
              <div className="text-2xl font-bold text-[var(--color-ink-900)] mt-1">
                {progressMetrics.total}
              </div>
              <div className="text-[10px] text-[var(--color-ink-400)] mt-0.5">Across active cohorts</div>
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                Published Reports
              </div>
              <div className="text-2xl font-bold text-emerald-700 mt-1">
                {progressMetrics.published}
              </div>
              <div className="text-[10px] text-emerald-600 mt-0.5">Ready to download & share</div>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">
                Draft Reviews
              </div>
              <div className="text-2xl font-bold text-amber-700 mt-1">
                {progressMetrics.draft}
              </div>
              <div className="text-[10px] text-amber-700/80 mt-0.5">Pending tutor sign-off</div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
                Distribution Actions
              </div>
              <div className="text-2xl font-bold text-blue-700 mt-1">
                {progressMetrics.downloadsOrShares}
              </div>
              <div className="text-[10px] text-blue-600 mt-0.5">Logged downloads & shares</div>
            </div>
          </div>

          {/* Search and Filters Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-[var(--color-line)] shadow-2xs">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[var(--color-ink-400)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="reports-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by student name or course..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-[var(--color-line)] rounded-lg text-[var(--color-ink-900)] text-xs placeholder:text-[var(--color-ink-400)] focus:outline-hidden focus:border-[var(--color-harbor-500)]"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-ink-500)] flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Status:
              </span>
              <select
                id="reports-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'published' | 'draft')}
                className="px-2.5 py-1.5 bg-white border border-[var(--color-line)] rounded-lg text-xs text-[var(--color-ink-800)] focus:outline-hidden focus:border-[var(--color-harbor-500)]"
              >
                <option value="all">All Statuses</option>
                <option value="published">Published</option>
                <option value="draft">Drafts</option>
              </select>
            </div>

            {/* Cohort Filter */}
            <div className="flex items-center gap-2">
              <select
                id="reports-cohort-filter"
                value={cohortFilter}
                onChange={(e) => setCohortFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-[var(--color-line)] rounded-lg text-xs text-[var(--color-ink-800)] focus:outline-hidden focus:border-[var(--color-harbor-500)]"
              >
                <option value="all">All Cohorts</option>
                <option value="Cohort 2026-A">Cohort 2026-A</option>
                <option value="Cohort 2026-B">Cohort 2026-B</option>
                <option value="Cohort 2026-C">Cohort 2026-C</option>
              </select>
            </div>

            {isStaff && (
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="px-3 py-1.5 bg-[var(--color-harbor-600)] text-white text-xs font-semibold rounded-lg hover:bg-[var(--color-harbor-500)]"
              >
                + New Evaluation
              </button>
            )}
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-white shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--color-ink-50)] text-[var(--color-ink-600)] font-semibold border-b border-[var(--color-line)]">
                  <tr>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Course & Cohort</th>
                    <th className="px-4 py-3">Period</th>
                    <th className="px-4 py-3">Attendance</th>
                    <th className="px-4 py-3">Assignments</th>
                    <th className="px-4 py-3">Overall Progress</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-line)]">
                  {filteredProgressReports.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-xs text-[var(--color-ink-400)]">
                        No progress reports found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredProgressReports.map((report) => (
                      <tr
                        key={report.id}
                        onClick={() => handleSelectProgressReport(report.id)}
                        className="hover:bg-[var(--color-ink-50)] cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 font-semibold text-[var(--color-ink-900)]">
                          {report.student_name}
                        </td>
                        <td className="px-4 py-3 text-[var(--color-ink-700)]">
                          {report.course_name}
                          <span className="block text-[11px] text-[var(--color-ink-400)]">
                            {report.cohort_name}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[var(--color-ink-600)]">
                          {report.reporting_period}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-emerald-700">
                            {report.metrics.attendance_rate}%
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-blue-700">
                            {report.metrics.assignment_performance}%
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-[var(--color-ink-900)]">
                          {report.metrics.overall_progress}%
                        </td>
                        <td className="px-4 py-3">
                          {report.status === 'published' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                              Published
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
                              Draft
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div
                            className="inline-flex items-center justify-end gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={(e) => handleQuickProgressDownload(report, e)}
                              className="p-1 text-[var(--color-ink-500)] hover:text-emerald-700 hover:bg-emerald-50 rounded"
                              title="Download PDF"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            {isStaff && (
                              <button
                                type="button"
                                onClick={(e) => handleQuickShare(report, e)}
                                className="p-1 text-[var(--color-ink-500)] hover:text-blue-700 hover:bg-blue-50 rounded"
                                title="Share Report"
                              >
                                <Share2 className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleSelectProgressReport(report.id)}
                              className="p-1 text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)] hover:bg-[var(--color-ink-100)] rounded"
                              title="View Details"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CREATE STUDENT REPORT WIZARD (Sections 2-7) */}
      <CreateReportWizard
        isOpen={isCreateWizardOpen}
        initialReport={editingStudentReport}
        onClose={() => {
          setIsCreateWizardOpen(false)
          setEditingStudentReport(null)
        }}
        onSaved={handleStudentReportSaved}
      />

      {/* STUDENT REPORT DETAIL MODAL (Sections 8-10, 12) */}
      <StudentReportDetailModal
        report={viewingStudentReport}
        isOpen={!!viewingStudentReport}
        onClose={() => setViewingStudentReport(null)}
        onEdit={(r) => {
          setViewingStudentReport(null)
          handleOpenEdit(r)
        }}
        onReportUpdated={(updated) => {
          handleStudentReportSaved(updated)
          setViewingStudentReport(updated)
        }}
      />

      {/* Share Progress Report Modal */}
      {sharingReport && (
        <ShareReportModal
          report={sharingReport}
          isOpen={!!sharingReport}
          onClose={() => setSharingReport(null)}
          onReportUpdated={handleProgressReportUpdated}
        />
      )}

      {/* Create Progress Report Modal */}
      {isCreateModalOpen && (
        <div
          id="create-report-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCreateModalOpen(false)
          }}
        >
          <div
            id="create-report-modal-content"
            className="w-full max-w-md bg-white border border-[var(--color-line)] rounded-xl p-6 shadow-2xl space-y-4"
          >
            <h2 className="text-base font-semibold text-[var(--color-ink-900)]">
              Create New Cohort Evaluation
            </h2>
            <form onSubmit={handleCreateProgressReport} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-[var(--color-ink-700)] mb-1">
                  Student Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[var(--color-line)] rounded text-[var(--color-ink-900)] text-xs focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[var(--color-ink-700)] mb-1">
                  Course Track
                </label>
                <input
                  type="text"
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[var(--color-line)] rounded text-[var(--color-ink-900)] text-xs focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[var(--color-ink-700)] mb-1">
                  Cohort
                </label>
                <input
                  type="text"
                  value={newCohortName}
                  onChange={(e) => setNewCohortName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[var(--color-line)] rounded text-[var(--color-ink-900)] text-xs focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[var(--color-ink-700)] mb-1">
                  Reporting Period
                </label>
                <input
                  type="text"
                  value={newPeriod}
                  onChange={(e) => setNewPeriod(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[var(--color-line)] rounded text-[var(--color-ink-900)] text-xs focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-[var(--color-ink-600)] hover:text-[var(--color-ink-900)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[var(--color-harbor-600)] hover:bg-[var(--color-harbor-500)] text-white font-semibold text-xs rounded"
                >
                  Generate Draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
