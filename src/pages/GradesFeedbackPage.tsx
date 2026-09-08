import { useState, useMemo, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Search,
  CheckCircle2,
  Clock,
  MessageSquare,
  Award,
  ArrowLeft,
  RotateCcw,
  FileText,
  AlertCircle,
  Paperclip,
  Send,
  Sparkles,
  ChevronRight,
  ListChecks,
  SlidersHorizontal,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import { Card, Badge, SectionHeading } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import {
  getUnifiedGradedItems,
  submitResubmission,
  type GradedItem,
  gradeSubmission,
  clearGradingQueueAndFeedback,
} from '@/lib/studentFlow'
import { useAuth } from '@/app/auth'

export function GradesFeedbackPage() {
  const { id: paramId } = useParams<{ id?: string }>()
  const { role } = useAuth()
  const isStaff = role === 'trainer' || role === 'manager' || role === 'admin'
  const isParent = role === 'parent'

  const [items, setItems] = useState<GradedItem[]>(() => getUnifiedGradedItems())
  const [selectedId, setSelectedId] = useState<string | null>(paramId ?? null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | 'Graded' | 'Pending Review' | 'Revision Required' | 'Has Feedback'>('All')
  const [typeFilter, setTypeFilter] = useState<string>('All')
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  // Synchronize on events
  useEffect(() => {
    const handleUpdate = () => {
      setItems(getUnifiedGradedItems())
    }
    window.addEventListener('grades-feedback-updated', handleUpdate)
    window.addEventListener('app-data-cleared', handleUpdate)
    return () => {
      window.removeEventListener('grades-feedback-updated', handleUpdate)
      window.removeEventListener('app-data-cleared', handleUpdate)
    }
  }, [])

  // Resubmission form state (student)
  const [resubmitting, setResubmitting] = useState(false)
  const [responseText, setResponseText] = useState('')
  const [revisionNotes, setRevisionNotes] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; size: string }>>([])
  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Staff grading edit state
  const [staffEditingGrade, setStaffEditingGrade] = useState(false)
  const [staffScoreInput, setStaffScoreInput] = useState('')
  const [staffFeedbackInput, setStaffFeedbackInput] = useState('')
  const [staffAreasInput, setStaffAreasInput] = useState('')

  // Keep paramId synced
  const activeItem = useMemo(() => {
    const id = selectedId ?? paramId
    return items.find(i => i.id === id) ?? null
  }, [items, selectedId, paramId])

  // Overall calculations
  const gradedList = useMemo(() => items.filter(i => i.score !== null), [items])
  const pendingList = useMemo(() => items.filter(i => i.status === 'Pending Review' || i.score === null), [items])
  const feedbackList = useMemo(() => items.filter(i => Boolean(i.feedback)), [items])

  const overallAverage = useMemo(() => {
    if (gradedList.length === 0) return 0
    const sumPct = gradedList.reduce((acc, i) => acc + (i.percentage ?? 0), 0)
    return Math.round(sumPct / gradedList.length)
  }, [gradedList])

  const gpa = useMemo(() => {
    if (gradedList.length === 0) return '—'
    if (overallAverage >= 93) return '3.9'
    if (overallAverage >= 88) return '3.7'
    if (overallAverage >= 83) return '3.3'
    if (overallAverage >= 75) return '2.9'
    return '2.5'
  }, [overallAverage, gradedList.length])

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesQuery =
        !query.trim() ||
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.course_name.toLowerCase().includes(query.toLowerCase()) ||
        item.trainer_name.toLowerCase().includes(query.toLowerCase())

      const matchesStatus =
        statusFilter === 'All'
          ? true
          : statusFilter === 'Graded'
          ? item.status === 'Graded'
          : statusFilter === 'Pending Review'
          ? item.status === 'Pending Review'
          : statusFilter === 'Revision Required'
          ? item.status === 'Revision Required'
          : statusFilter === 'Has Feedback'
          ? Boolean(item.feedback)
          : true

      const matchesType = typeFilter === 'All' || item.item_type === typeFilter

      return matchesQuery && matchesStatus && matchesType
    })
  }, [items, query, statusFilter, typeFilter])

  const handleSelectItem = (item: GradedItem) => {
    setSelectedId(item.id)
    setResponseText(item.submission_details.response_text || '')
    setRevisionNotes('')
    setUploadedFiles([])
    setAlertMessage(null)
    setResubmitting(false)
    setStaffScoreInput(item.score !== null ? String(item.score) : '')
    setStaffFeedbackInput(item.feedback || '')
    setStaffAreasInput(item.areas_for_improvement || '')
    setStaffEditingGrade(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleBackToList = () => {
    setSelectedId(null)
    setAlertMessage(null)
    setResubmitting(false)
    setStaffEditingGrade(false)
  }

  const handleSaveStaffGrade = (newStatus: 'Graded' | 'Revision Required') => {
    if (!activeItem) return
    const num = parseFloat(staffScoreInput)
    if (newStatus === 'Graded' && (isNaN(num) || num < 0 || num > activeItem.maximum_marks)) {
      setAlertMessage({ type: 'error', text: `Please enter a valid score between 0 and ${activeItem.maximum_marks}.` })
      return
    }

    const res = gradeSubmission({
      queueId: `queue-${activeItem.id}`,
      sourceId: activeItem.source_id,
      itemType: activeItem.item_type,
      studentId: activeItem.student_id ?? '',
      score: newStatus === 'Graded' ? num : 0,
      maximumScore: activeItem.maximum_marks,
      feedback: staffFeedbackInput.trim() || 'Evaluated by trainer.',
      areasForImprovement: staffAreasInput.trim(),
      status: newStatus,
    })

    if (res.success) {
      const reloaded = getUnifiedGradedItems()
      setItems(reloaded)
      setStaffEditingGrade(false)
      setAlertMessage({ type: 'success', text: res.message })
    }
  }

  const handleStartResubmission = (item: GradedItem) => {
    setResponseText(item.submission_details.response_text || '')
    setRevisionNotes('')
    setUploadedFiles([])
    setResubmitting(true)
    setAlertMessage(null)
  }

  const handleFileDrop = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).map(f => ({
        name: f.name,
        size: `${(f.size / (1024 * 1024)).toFixed(1)} MB`,
      }))
      setUploadedFiles(prev => [...prev, ...newFiles])
    }
  }

  const handleSendResubmission = (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeItem) return

    if (!responseText.trim() && uploadedFiles.length === 0) {
      setAlertMessage({ type: 'error', text: 'Please provide either revised text or upload updated files.' })
      return
    }

    const res = submitResubmission(activeItem.id, responseText, revisionNotes, uploadedFiles)
    if (res.success) {
      // Reload items
      const updated = getUnifiedGradedItems()
      setItems(updated)
      setResubmitting(false)
      setAlertMessage({ type: 'success', text: res.message })
    } else {
      setAlertMessage({ type: 'error', text: res.message })
    }
  }

  return (
    <div id="grades-feedback-page" className="space-y-6 pb-12">
      {/* View 2: Grade Details View */}
      {activeItem ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button
              id="back-to-grades-btn"
              onClick={handleBackToList}
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-ink-600)] hover:text-[var(--color-harbor-600)] transition-colors"
            >
              <ArrowLeft size={16} />
              Back to Grades & Feedback
            </button>
            <Badge
              tone={
                activeItem.status === 'Graded'
                  ? 'success'
                  : activeItem.status === 'Revision Required'
                  ? 'warning'
                  : 'harbor'
              }
            >
              {activeItem.status}
            </Badge>
          </div>

          {alertMessage && (
            <div
              className={`p-4 rounded-[var(--radius-md)] text-sm flex items-center gap-3 ${
                alertMessage.type === 'success'
                  ? 'bg-[var(--color-success-100)] text-[var(--color-success-700)] border border-[var(--color-success-200)]'
                  : 'bg-[var(--color-danger-100)] text-[var(--color-danger-700)] border border-[var(--color-danger-200)]'
              }`}
            >
              {alertMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{alertMessage.text}</span>
            </div>
          )}

          {/* Top Score Banner */}
          <Card className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge tone="harbor">{activeItem.item_type}</Badge>
                  <span className="text-xs text-[var(--color-ink-400)]">{activeItem.course_name} · {activeItem.cohort_name}</span>
                </div>
                <h1 className="font-display text-2xl font-bold text-[var(--color-ink-900)]">
                  {activeItem.title}
                </h1>
                <p className="mt-1 text-sm text-[var(--color-ink-500)]">
                  Evaluated by <strong className="text-[var(--color-ink-700)]">{activeItem.trainer_name}</strong>
                  {activeItem.graded_at && (
                    <span> on {new Date(activeItem.graded_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  )}
                </p>
              </div>

              {/* Score Box */}
              <div className="flex items-center gap-4 bg-[var(--color-surface)] border border-[var(--color-line)] p-4 rounded-[var(--radius-lg)] shrink-0">
                <div className="text-center pr-4 border-r border-[var(--color-line)]">
                  <span className="text-xs font-semibold uppercase text-[var(--color-ink-400)] block">Grade</span>
                  <span className="font-display text-3xl font-black text-[var(--color-harbor-600)]">
                    {activeItem.letter_grade ?? '—'}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase text-[var(--color-ink-400)] block">Score</span>
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-2xl font-bold text-[var(--color-ink-900)]">
                      {activeItem.score !== null ? activeItem.score : 'Pending'}
                    </span>
                    <span className="text-sm text-[var(--color-ink-400)]">/ {activeItem.maximum_marks}</span>
                  </div>
                  {activeItem.percentage !== null && (
                    <span className="text-xs font-medium text-[var(--color-success-600)]">
                      {activeItem.percentage}% earned
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Feedback & Areas for Improvement */}
            <div className="lg:col-span-2 space-y-6">
              {/* Trainer Feedback */}
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-8 w-8 rounded-full bg-[var(--color-harbor-100)] text-[var(--color-harbor-600)] flex items-center justify-center">
                    <MessageSquare size={16} />
                  </div>
                  <div>
                    <h2 className="font-display text-base font-semibold text-[var(--color-ink-900)]">Trainer Feedback</h2>
                    <p className="text-xs text-[var(--color-ink-400)]">Comprehensive evaluation from {activeItem.trainer_name}</p>
                  </div>
                </div>

                {activeItem.feedback ? (
                  <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-line)] p-4 text-sm text-[var(--color-ink-800)] leading-relaxed whitespace-pre-wrap">
                    {activeItem.feedback}
                  </div>
                ) : (
                  <div className="p-6 text-center text-sm text-[var(--color-ink-400)] bg-[var(--color-surface)] rounded-[var(--radius-md)]">
                    <Clock className="mx-auto mb-2 text-[var(--color-ink-300)]" size={20} />
                    Trainer evaluation is currently in progress. Feedback will appear here once published.
                  </div>
                )}

                {/* Areas for Improvement */}
                {activeItem.areas_for_improvement && (
                  <div className="mt-6 pt-6 border-t border-[var(--color-line)]">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles size={16} className="text-[var(--color-ember-500)]" />
                      <h3 className="text-sm font-semibold text-[var(--color-ink-900)]">Areas for Improvement</h3>
                    </div>
                    <div className="rounded-[var(--radius-md)] bg-[var(--color-ember-50)] border border-[var(--color-ember-200)] p-4 text-sm text-[var(--color-ember-900)] leading-relaxed">
                      {activeItem.areas_for_improvement}
                    </div>
                  </div>
                )}
              </Card>

              {/* Submission Details */}
              <Card className="p-6">
                <SectionHeading
                  eyebrow="Deliverables"
                  title="Your Submitted Work"
                />

                <div className="mt-4 space-y-4">
                  <div>
                    <span className="text-xs font-medium text-[var(--color-ink-400)] uppercase block mb-1">
                      Submitted Response / Notes
                    </span>
                    <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-line)] p-4 text-sm text-[var(--color-ink-700)] leading-relaxed whitespace-pre-wrap">
                      {activeItem.submission_details.response_text || 'No written response text provided.'}
                    </div>
                  </div>

                  {activeItem.submission_details.files.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-[var(--color-ink-400)] uppercase block mb-2">
                        Attached Files ({activeItem.submission_details.files.length})
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {activeItem.submission_details.files.map((file, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white text-xs"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <FileText size={16} className="text-[var(--color-harbor-600)] shrink-0" />
                              <span className="font-medium text-[var(--color-ink-800)] truncate">{file.name}</span>
                            </div>
                            <span className="text-[var(--color-ink-400)] shrink-0 ml-2">{file.size}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeItem.submission_details.links.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-[var(--color-ink-400)] uppercase block mb-2">
                        Submitted Links
                      </span>
                      <div className="space-y-1.5">
                        {activeItem.submission_details.links.map((link, idx) => (
                          <a
                            key={idx}
                            href={link}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-medium text-[var(--color-harbor-600)] hover:underline block truncate"
                          >
                            🔗 {link}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-[var(--color-ink-400)] pt-2">
                    Submitted on:{' '}
                    {activeItem.submitted_at
                      ? new Date(activeItem.submitted_at).toLocaleString()
                      : 'Pending initial submission'}
                    {activeItem.resubmission_count > 0 && (
                      <span className="ml-2 font-medium text-[var(--color-harbor-600)]">
                        (Revision #{activeItem.resubmission_count})
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            </div>

            {/* Right: Actions tailored to role */}
            <div className="space-y-6">
              {isStaff ? (
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <SectionHeading eyebrow="Staff Actions" title="Trainer Grading & Evaluation" />
                    <Badge tone="harbor">Staff Mode</Badge>
                  </div>

                  {!staffEditingGrade ? (
                    <div className="space-y-4">
                      <p className="text-xs text-[var(--color-ink-500)] leading-relaxed">
                        Review this student deliverable and adjust awarded marks, rubric evaluation, or revision requests.
                      </p>

                      <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-3.5 bg-[var(--color-ink-50)]/40 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-[var(--color-ink-500)]">Current Score:</span>
                          <span className="font-bold text-[var(--color-ink-900)]">
                            {activeItem.score !== null ? `${activeItem.score} / ${activeItem.maximum_marks} pts` : 'Ungraded'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-[var(--color-ink-500)]">Letter Grade:</span>
                          <span className="font-bold text-[var(--color-success-700)]">
                            {activeItem.letter_grade ?? 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-[var(--color-ink-500)]">Current Status:</span>
                          <Badge
                            tone={
                              activeItem.status === 'Graded'
                                ? 'success'
                                : activeItem.status === 'Revision Required'
                                ? 'danger'
                                : 'warning'
                            }
                          >
                            {activeItem.status}
                          </Badge>
                        </div>
                      </div>

                      <button
                        id="staff-edit-grade-btn"
                        onClick={() => setStaffEditingGrade(true)}
                        className="w-full flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[var(--color-harbor-600)] transition-colors"
                      >
                        <SlidersHorizontal size={14} />
                        Modify Grade & Feedback
                      </button>

                      <Link
                        to="/grading-queue"
                        className="w-full flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3 py-2 text-xs font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)] transition-colors"
                      >
                        <ListChecks size={14} />
                        Open Batch Grading Queue
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-4 pt-1">
                      <div>
                        <label className="block text-xs font-semibold text-[var(--color-ink-700)] mb-1">
                          Awarded Score (Max {activeItem.maximum_marks} pts)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={activeItem.maximum_marks}
                          value={staffScoreInput}
                          onChange={e => setStaffScoreInput(e.target.value)}
                          className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-xs font-bold text-[var(--color-ink-900)] focus:border-[var(--color-harbor-500)] focus:outline-none"
                          placeholder={`e.g. ${activeItem.maximum_marks}`}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[var(--color-ink-700)] mb-1">
                          Trainer Feedback
                        </label>
                        <textarea
                          rows={4}
                          value={staffFeedbackInput}
                          onChange={e => setStaffFeedbackInput(e.target.value)}
                          placeholder="Provide detailed feedback on strengths and criteria..."
                          className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] p-3 text-xs focus:border-[var(--color-harbor-500)] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[var(--color-ink-700)] mb-1">
                          Areas for Improvement
                        </label>
                        <textarea
                          rows={3}
                          value={staffAreasInput}
                          onChange={e => setStaffAreasInput(e.target.value)}
                          placeholder="Specific action items for the student..."
                          className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] p-3 text-xs focus:border-[var(--color-harbor-500)] focus:outline-none"
                        />
                      </div>

                      <div className="flex flex-col gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => handleSaveStaffGrade('Graded')}
                          className="w-full inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-success-600)] px-3 py-2.5 text-xs font-semibold text-white hover:bg-[var(--color-success-700)] shadow-xs transition-colors"
                        >
                          <CheckCircle2 size={14} />
                          Save Grade & Publish
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSaveStaffGrade('Revision Required')}
                          className="w-full inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-warning-500)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--color-warning-600)] transition-colors"
                        >
                          <RotateCcw size={14} />
                          Request Student Revision
                        </button>

                        <button
                          type="button"
                          onClick={() => setStaffEditingGrade(false)}
                          className="w-full px-3 py-2 text-xs font-medium text-[var(--color-ink-600)] hover:bg-[var(--color-line)] rounded-[var(--radius-md)]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </Card>
              ) : isParent ? (
                <Card className="p-6">
                  <SectionHeading eyebrow="Guardian View" title="Evaluation Summary" />
                  <div className="mt-4 space-y-3">
                    <p className="text-xs text-[var(--color-ink-500)] leading-relaxed">
                      This evaluation was completed by the course instructor. Scores and trainer feedback are archived in your child&apos;s permanent academic record.
                    </p>

                    <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-3.5 bg-[var(--color-ink-50)]/40 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[var(--color-ink-500)]">Grading Status:</span>
                        <Badge
                          tone={
                            activeItem.status === 'Graded'
                              ? 'success'
                              : activeItem.status === 'Revision Required'
                              ? 'danger'
                              : 'warning'
                          }
                        >
                          {activeItem.status}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[var(--color-ink-500)]">Assigned Instructor:</span>
                        <span className="font-semibold text-[var(--color-ink-800)]">{activeItem.trainer_name}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[var(--color-ink-500)]">Revision Policy:</span>
                        <span className="text-[var(--color-ink-700)]">
                          {activeItem.allow_resubmission ? 'Resubmissions permitted' : 'Final submission'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 text-xs text-[var(--color-ink-500)]">
                      Need to discuss this grade? Consult the bi-weekly report or schedule time with the trainer in{' '}
                      <Link to="/reports" className="text-[var(--color-harbor-600)] font-semibold hover:underline">
                        Progress Reports
                      </Link>.
                    </div>
                  </div>
                </Card>
              ) : (
                <Card className="p-6">
                  <SectionHeading
                    eyebrow="Actions"
                    title="Resubmission"
                  />

                  <div className="mt-4 space-y-4">
                    {activeItem.allow_resubmission ? (
                      <>
                        <p className="text-xs text-[var(--color-ink-500)] leading-relaxed">
                          Resubmission is enabled for this item. You can incorporate your trainer&apos;s feedback and upload an updated deliverable for regrading.
                        </p>

                        {!resubmitting ? (
                          <button
                            id="open-resubmit-btn"
                            onClick={() => handleStartResubmission(activeItem)}
                            className="w-full flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[var(--color-harbor-600)] transition-colors"
                          >
                            <RotateCcw size={14} />
                            Resubmit Updated Work
                          </button>
                        ) : (
                          <form onSubmit={handleSendResubmission} className="space-y-4 pt-2">
                            <div>
                              <label className="block text-xs font-medium text-[var(--color-ink-700)] mb-1">
                                Updated Response / Text
                              </label>
                              <textarea
                                rows={5}
                                value={responseText}
                                onChange={e => setResponseText(e.target.value)}
                                placeholder="Describe your revisions and address the trainer feedback..."
                                className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] p-3 text-xs focus:border-[var(--color-harbor-500)] focus:outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-[var(--color-ink-700)] mb-1">
                                Revision Notes for Trainer
                              </label>
                              <input
                                type="text"
                                value={revisionNotes}
                                onChange={e => setRevisionNotes(e.target.value)}
                                placeholder="e.g. Fixed CSS Grid breakpoints and updated tests"
                                className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-xs focus:border-[var(--color-harbor-500)] focus:outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-[var(--color-ink-700)] mb-1">
                                Upload Revised Files
                              </label>
                              <label className="flex flex-col items-center justify-center border-2 border-dashed border-[var(--color-line)] rounded-[var(--radius-md)] p-4 text-center cursor-pointer hover:border-[var(--color-harbor-400)] transition-colors">
                                <Paperclip size={18} className="text-[var(--color-ink-400)] mb-1" />
                                <span className="text-xs font-medium text-[var(--color-ink-600)]">Choose file or drag here</span>
                                <input type="file" multiple className="hidden" onChange={handleFileDrop} />
                              </label>
                              {uploadedFiles.length > 0 && (
                                <ul className="mt-2 space-y-1">
                                  {uploadedFiles.map((f, i) => (
                                    <li key={i} className="text-[11px] text-[var(--color-ink-600)] flex items-center gap-1">
                                      <CheckCircle2 size={12} className="text-[var(--color-success-600)]" />
                                      {f.name} ({f.size})
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                              <button
                                type="submit"
                                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--color-harbor-600)]"
                              >
                                <Send size={13} />
                                Send Revision
                              </button>
                              <button
                                type="button"
                                onClick={() => setResubmitting(false)}
                                className="px-3 py-2 text-xs font-medium text-[var(--color-ink-600)] hover:bg-[var(--color-line)] rounded-[var(--radius-md)]"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        )}
                      </>
                    ) : (
                      <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] p-4 text-xs text-[var(--color-ink-500)] text-center">
                        Resubmission is not configured for this formal evaluation item.
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Assessment Context Card */}
              <Card className="p-6">
                <h3 className="font-display text-sm font-semibold text-[var(--color-ink-900)] mb-3">Evaluation Metadata</h3>
                <dl className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-[var(--color-line)]">
                    <dt className="text-[var(--color-ink-500)]">Item Type</dt>
                    <dd className="font-medium text-[var(--color-ink-800)]">{activeItem.item_type}</dd>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[var(--color-line)]">
                    <dt className="text-[var(--color-ink-500)]">Course</dt>
                    <dd className="font-medium text-[var(--color-ink-800)] truncate max-w-[150px]">{activeItem.course_name}</dd>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[var(--color-line)]">
                    <dt className="text-[var(--color-ink-500)]">Assigned Date</dt>
                    <dd className="font-medium text-[var(--color-ink-800)]">{activeItem.assigned_date}</dd>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[var(--color-line)]">
                    <dt className="text-[var(--color-ink-500)]">Max Score</dt>
                    <dd className="font-medium text-[var(--color-ink-800)]">{activeItem.maximum_marks} pts</dd>
                  </div>
                  <div className="flex justify-between py-1">
                    <dt className="text-[var(--color-ink-500)]">Status</dt>
                    <dd className="font-medium text-[var(--color-ink-800)]">{activeItem.status}</dd>
                  </div>
                </dl>
              </Card>
            </div>
          </div>
        </div>
      ) : (
        /* View 1: Grades Overview */
        <div className="space-y-6">
          <PageHeader
            title={
              isStaff
                ? 'Staff Gradebook & Evaluations'
                : isParent
                ? 'Grades & Academic Feedback'
                : 'Grades & Feedback'
            }
            subtitle={
              isStaff
                ? 'Review cohort student submissions, track evaluation turnaround, and adjust qualitative feedback.'
                : isParent
                ? 'Guardian portal: Review formal evaluations, rubric scores, and instructor feedback for your enrolled child.'
                : 'What did my trainer say about my work? Review scores, instructor evaluations, and resubmission options.'
            }
            actions={
              isStaff ? (
                <div className="flex items-center gap-2">
                  <button
                    id="clear-grades-feedback-btn"
                    type="button"
                    onClick={() => setShowClearConfirm(true)}
                    className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-danger-300)] bg-white px-3 py-2 text-xs font-semibold text-[var(--color-danger-700)] hover:bg-[var(--color-danger-50)] shadow-xs transition-colors"
                  >
                    <Trash2 size={14} />
                    Clear Grades Data
                  </button>
                  <Link
                    to="/grading-queue"
                    className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[var(--color-harbor-600)] transition-colors"
                  >
                    <ListChecks size={15} />
                    Open Grading Queue
                  </Link>
                </div>
              ) : undefined
            }
          />

          {/* Metric Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[var(--color-harbor-100)] text-[var(--color-harbor-600)] flex items-center justify-center shrink-0">
                <Award size={20} />
              </div>
              <div>
                <span className="text-xs text-[var(--color-ink-400)] block font-medium">Overall Standing</span>
                <span className="font-display text-xl font-bold text-[var(--color-ink-900)]">
                  {gradedList.length === 0 ? '—' : `${overallAverage}% · ${gpa} GPA`}
                </span>
              </div>
            </Card>

            <Card className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[var(--color-success-100)] text-[var(--color-success-600)] flex items-center justify-center shrink-0">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <span className="text-xs text-[var(--color-ink-400)] block font-medium">Graded Items</span>
                <span className="font-display text-xl font-bold text-[var(--color-ink-900)]">
                  {gradedList.length} completed
                </span>
              </div>
            </Card>

            <Card className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[var(--color-warning-100)] text-[var(--color-warning-600)] flex items-center justify-center shrink-0">
                <Clock size={20} />
              </div>
              <div>
                <span className="text-xs text-[var(--color-ink-400)] block font-medium">Pending Grades</span>
                <span className="font-display text-xl font-bold text-[var(--color-ink-900)]">
                  {pendingList.length} awaiting
                </span>
              </div>
            </Card>

            <Card className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[var(--color-ember-100)] text-[var(--color-ember-600)] flex items-center justify-center shrink-0">
                <MessageSquare size={20} />
              </div>
              <div>
                <span className="text-xs text-[var(--color-ink-400)] block font-medium">Feedback Ready</span>
                <span className="font-display text-xl font-bold text-[var(--color-ink-900)]">
                  {feedbackList.length} evaluations
                </span>
              </div>
            </Card>
          </div>

          {/* Search and Filters Bar */}
          <Card className="p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              {/* Search */}
              <div className="relative w-full sm:w-72">
                <Search size={16} className="absolute left-3 top-2.5 text-[var(--color-ink-400)]" />
                <input
                  id="grades-search-input"
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search work, course, or trainer..."
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-[var(--radius-md)] border border-[var(--color-line)] focus:outline-none focus:border-[var(--color-harbor-500)]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                {/* Type Filter */}
                <div className="flex items-center gap-2">
                  <label htmlFor="grades-type-select" className="text-xs text-[var(--color-ink-500)] shrink-0">
                    Type:
                  </label>
                  <select
                    id="grades-type-select"
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value)}
                    className="text-xs rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 bg-white focus:outline-none focus:border-[var(--color-harbor-500)]"
                  >
                    <option value="All">All Formats</option>
                    <option value="Classwork">Classwork</option>
                    <option value="Project">Project</option>
                    <option value="Assessment">Assessment</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Status Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-[var(--color-line)]">
              {(['All', 'Graded', 'Pending Review', 'Revision Required', 'Has Feedback'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    statusFilter === tab
                      ? 'bg-[var(--color-harbor-500)] text-white'
                      : 'bg-[var(--color-surface)] text-[var(--color-ink-600)] hover:bg-[var(--color-line)]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </Card>

          {/* Graded & Feedback Items List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-[var(--color-ink-900)]">
                Evaluations & Submissions ({filteredItems.length})
              </h2>
              <span className="text-xs text-[var(--color-ink-400)]">
                Showing {filteredItems.length} of {items.length} records
              </span>
            </div>

            {filteredItems.length === 0 ? (
              <Card className="p-8 text-center text-sm text-[var(--color-ink-400)]">
                No evaluated items match the selected filter criteria.
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredItems.map(item => (
                  <Card
                    key={item.id}
                    id={`grade-item-${item.id}`}
                    onClick={() => handleSelectItem(item)}
                    className="p-5 hover:border-[var(--color-harbor-300)] transition-all cursor-pointer group"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      {/* Left: Info */}
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            tone={
                              item.item_type === 'Project'
                                ? 'ember'
                                : item.item_type === 'Assessment'
                                ? 'harbor'
                                : 'neutral'
                            }
                          >
                            {item.item_type}
                          </Badge>
                          <Badge
                            tone={
                              item.status === 'Graded'
                                ? 'success'
                                : item.status === 'Revision Required'
                                ? 'warning'
                                : 'harbor'
                            }
                          >
                            {item.status}
                          </Badge>
                          <span className="text-xs text-[var(--color-ink-400)] truncate">
                            {item.course_name}
                          </span>
                        </div>

                        <h3 className="font-display text-base font-semibold text-[var(--color-ink-900)] group-hover:text-[var(--color-harbor-600)] transition-colors">
                          {item.title}
                        </h3>

                        {item.feedback && (
                          <div className="flex items-start gap-1.5 text-xs text-[var(--color-ink-600)] line-clamp-1 bg-[var(--color-surface)] p-2 rounded-[var(--radius-sm)]">
                            <MessageSquare size={13} className="text-[var(--color-harbor-500)] shrink-0 mt-0.5" />
                            <span className="truncate">&quot;{item.feedback}&quot;</span>
                          </div>
                        )}

                        <div className="flex items-center gap-4 text-xs text-[var(--color-ink-400)] pt-1">
                          <span>Trainer: <strong className="text-[var(--color-ink-600)]">{item.trainer_name}</strong></span>
                          {item.graded_at && (
                            <span>Graded: {new Date(item.graded_at).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>

                      {/* Right: Score & CTA */}
                      <div className="flex items-center gap-4 sm:flex-col sm:items-end justify-between sm:justify-center shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-[var(--color-line)]">
                        <div className="text-right">
                          {item.score !== null ? (
                            <div className="flex items-baseline gap-1.5 sm:justify-end">
                              <span className="font-display text-xl font-bold text-[var(--color-ink-900)]">
                                {item.score}
                              </span>
                              <span className="text-xs text-[var(--color-ink-400)]">/ {item.maximum_marks}</span>
                              <span className="ml-1 text-xs font-bold text-[var(--color-harbor-600)] px-2 py-0.5 rounded-md bg-[var(--color-harbor-100)]">
                                {item.letter_grade}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs font-medium text-[var(--color-warning-600)] bg-[var(--color-warning-100)] px-2 py-0.5 rounded-full">
                              Pending Evaluation
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 text-xs font-semibold text-[var(--color-harbor-600)] group-hover:translate-x-0.5 transition-transform">
                          <span>View Details</span>
                          <ChevronRight size={14} />
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <Modal title="Clear Grades & Feedback" onClose={() => setShowClearConfirm(false)}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-[var(--radius-md)] bg-[var(--color-danger-50)] p-3 text-xs text-[var(--color-danger-800)] border border-[var(--color-danger-200)]">
              <AlertTriangle className="h-5 w-5 shrink-0 text-[var(--color-danger-600)]" />
              <div>
                <p className="font-semibold">Reset all evaluated grades and qualitative feedback?</p>
                <p className="mt-1">
                  This will purge all graded submission records, feedback notes, and evaluation histories across student classwork and capstones.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3.5 py-2 text-xs font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-surface)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  clearGradingQueueAndFeedback()
                  setItems([])
                  setSelectedId(null)
                  setShowClearConfirm(false)
                }}
                className="rounded-[var(--radius-md)] bg-[var(--color-danger-600)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--color-danger-700)]"
              >
                Clear Grades Now
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
