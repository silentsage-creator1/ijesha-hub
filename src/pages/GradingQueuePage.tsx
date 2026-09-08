import { useState, useMemo, useEffect } from 'react'
import {
  ListChecks,
  CheckCircle2,
  Clock,
  RotateCcw,
  Search,
  ExternalLink,
  FileText,
  Filter,
  ArrowRight,
  X,
  Send,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import { Card, Badge, SectionHeading, Avatar } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import {
  getGradingQueueSubmissions,
  gradeSubmission,
  clearGradingQueueAndFeedback,
  type GradingQueueItem,
  calculateLetterGrade,
} from '@/lib/studentFlow'
import { useAuth } from '@/app/auth'

export function GradingQueuePage() {
  const { role } = useAuth()
  const [queue, setQueue] = useState<GradingQueueItem[]>(() => getGradingQueueSubmissions())
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedCohort, setSelectedCohort] = useState<string>('')
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  // Listen for data clear / update events
  useEffect(() => {
    const handleUpdate = () => {
      setQueue(getGradingQueueSubmissions())
    }
    window.addEventListener('grading-queue-updated', handleUpdate)
    window.addEventListener('app-data-cleared', handleUpdate)
    return () => {
      window.removeEventListener('grading-queue-updated', handleUpdate)
      window.removeEventListener('app-data-cleared', handleUpdate)
    }
  }, [])

  // Selected item for evaluation drawer / modal
  const [evaluatingItem, setEvaluatingItem] = useState<GradingQueueItem | null>(null)
  const [scoreInput, setScoreInput] = useState<string>('')
  const [feedbackInput, setFeedbackInput] = useState<string>('')
  const [areasInput, setAreasInput] = useState<string>('')
  const [rubricTier, setRubricTier] = useState<'Mastery' | 'Proficient' | 'Approaching' | 'Needs Support'>('Proficient')
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  function openEvaluation(item: GradingQueueItem) {
    setEvaluatingItem(item)
    setScoreInput(item.score !== null ? String(item.score) : '')
    setFeedbackInput(item.feedback || '')
    setAreasInput(item.areas_for_improvement || '')
    if (item.score !== null) {
      const pct = (item.score / item.maximum_marks) * 100
      if (pct >= 90) setRubricTier('Mastery')
      else if (pct >= 80) setRubricTier('Proficient')
      else if (pct >= 70) setRubricTier('Approaching')
      else setRubricTier('Needs Support')
    } else {
      setRubricTier('Proficient')
    }
  }

  function handleClearQueue() {
    clearGradingQueueAndFeedback()
    setQueue([])
    setShowClearConfirm(false)
    setToastMessage('Grading queue and submissions cleared successfully.')
    setTimeout(() => setToastMessage(null), 4000)
  }

  function handleSaveGrade(status: 'Graded' | 'Revision Required') {
    if (!evaluatingItem) return

    const numScore = parseFloat(scoreInput)
    if (status === 'Graded' && (isNaN(numScore) || numScore < 0 || numScore > evaluatingItem.maximum_marks)) {
      alert(`Please enter a valid score between 0 and ${evaluatingItem.maximum_marks}`)
      return
    }

    const res = gradeSubmission({
      queueId: evaluatingItem.id,
      sourceId: evaluatingItem.source_id,
      itemType: evaluatingItem.item_type,
      studentId: evaluatingItem.student_id,
      score: status === 'Graded' ? numScore : 0,
      maximumScore: evaluatingItem.maximum_marks,
      feedback: feedbackInput.trim() || 'Evaluated by trainer.',
      areasForImprovement: areasInput.trim(),
      status,
    })

    if (res.success) {
      setToastMessage(res.message)
      setTimeout(() => setToastMessage(null), 4000)
      setQueue(getGradingQueueSubmissions())
      setEvaluatingItem(null)
    }
  }

  // Filtered queue
  const filtered = useMemo(() => {
    return queue.filter((item) => {
      const matchesSearch =
        !searchQuery ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.course_name.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesCat = selectedCategory === 'all' || item.item_type === selectedCategory
      const matchesStat =
        selectedStatus === 'all' ||
        (selectedStatus === 'pending' && (item.status === 'Pending Review' || item.status === 'Resubmitted')) ||
        (selectedStatus === 'resubmitted' && item.status === 'Resubmitted') ||
        (selectedStatus === 'graded' && item.status === 'Graded') ||
        (selectedStatus === 'revision' && item.status === 'Revision Required')

      const matchesCohort = !selectedCohort || item.cohort_name === selectedCohort

      return matchesSearch && matchesCat && matchesStat && matchesCohort
    })
  }, [queue, searchQuery, selectedCategory, selectedStatus, selectedCohort])

  // Aggregate stats
  const stats = useMemo(() => {
    const total = queue.length
    const pending = queue.filter((i) => i.status === 'Pending Review').length
    const resubmitted = queue.filter((i) => i.status === 'Resubmitted').length
    const graded = queue.filter((i) => i.status === 'Graded').length
    return { total, pending, resubmitted, graded }
  }, [queue])
  const queueCohorts = useMemo(() => [...new Set(queue.map((item) => item.cohort_name).filter(Boolean))].sort(), [queue])

  const calculatedPct = useMemo(() => {
    if (!evaluatingItem) return null
    const num = parseFloat(scoreInput)
    if (isNaN(num)) return null
    return Math.round((num / evaluatingItem.maximum_marks) * 100)
  }, [scoreInput, evaluatingItem])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Grading Queue"
        subtitle={
          role === 'trainer'
            ? 'Review cohort student submissions, assess learning deliverables, and publish rubric evaluations.'
            : 'Academic evaluation queue and trainer assessment turnaround overview.'
        }
        actions={
          (role === 'trainer' || role === 'manager' || role === 'admin') ? (
            <button
              id="clear-grading-queue-btn"
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-danger-300)] bg-white px-3 py-2 text-xs font-semibold text-[var(--color-danger-700)] hover:bg-[var(--color-danger-50)] shadow-xs transition-colors"
            >
              <Trash2 size={14} />
              Clear Queue Data
            </button>
          ) : undefined
        }
      />

      {toastMessage && (
        <div className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-success-100)] p-4 text-sm font-medium text-[var(--color-success-600)] shadow-sm">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--color-ink-500)]">TOTAL IN QUEUE</span>
            <ListChecks size={16} className="text-[var(--color-harbor-500)]" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-[var(--color-ink-900)]">{stats.total}</p>
          <p className="text-xs text-[var(--color-ink-400)]">Active coursework tasks</p>
        </Card>

        <Card className="p-4 border-l-4 border-[var(--color-warning-500)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--color-warning-700)]">PENDING REVIEW</span>
            <Clock size={16} className="text-[var(--color-warning-600)]" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-[var(--color-warning-700)]">{stats.pending}</p>
          <p className="text-xs text-[var(--color-ink-400)]">Awaiting initial assessment</p>
        </Card>

        <Card className="p-4 border-l-4 border-[var(--color-ember-500)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--color-ember-700)]">RE-SUBMITTED</span>
            <RotateCcw size={16} className="text-[var(--color-ember-600)]" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-[var(--color-ember-700)]">{stats.resubmitted}</p>
          <p className="text-xs text-[var(--color-ink-400)]">Revised per trainer feedback</p>
        </Card>

        <Card className="p-4 border-l-4 border-[var(--color-success-500)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--color-success-700)]">EVALUATED</span>
            <CheckCircle2 size={16} className="text-[var(--color-success-600)]" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-[var(--color-success-700)]">{stats.graded}</p>
          <p className="text-xs text-[var(--color-ink-400)]">Scores & feedback released</p>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-2.5 text-[var(--color-ink-400)]" />
            <input
              type="text"
              placeholder="Search by student name, task title, or course..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white py-2 pl-9 pr-3 text-sm text-[var(--color-ink-900)] placeholder:text-[var(--color-ink-400)] focus:border-[var(--color-harbor-500)] focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-ink-500)]">
              <Filter size={14} />
              <span>Category:</span>
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-xs font-medium text-[var(--color-ink-700)] focus:border-[var(--color-harbor-500)] focus:outline-none"
            >
              <option value="all">All Categories</option>
              <option value="Classwork">Classwork / Labs</option>
              <option value="Project">Projects & Capstones</option>
              <option value="Assignment">Assignments</option>
              <option value="Assessment">Assessments</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-xs font-medium text-[var(--color-ink-700)] focus:border-[var(--color-harbor-500)] focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending Evaluation</option>
              <option value="resubmitted">Re-submitted Only</option>
              <option value="graded">Graded</option>
              <option value="revision">Revision Requested</option>
            </select>

            <select
              value={selectedCohort}
              onChange={(e) => setSelectedCohort(e.target.value)}
              className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-xs font-medium text-[var(--color-ink-700)] focus:border-[var(--color-harbor-500)] focus:outline-none"
            >
              <option value="">{queueCohorts.length ? 'All cohorts' : 'No cohorts with submissions'}</option>
              {queueCohorts.map((cohort) => <option key={cohort} value={cohort}>{cohort}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {/* Submissions Queue Table */}
      <Card className="overflow-hidden">
        <div className="border-b border-[var(--color-line)] bg-[var(--color-ink-50)] px-4 py-3">
          <SectionHeading title={`Submissions Awaiting Action (${filtered.length})`} />
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <ListChecks size={36} className="mx-auto text-[var(--color-ink-300)]" />
            <p className="mt-3 font-display font-medium text-[var(--color-ink-800)]">Queue is clear</p>
            <p className="mt-1 text-xs text-[var(--color-ink-500)]">
              No student submissions match your active filter criteria.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-line)]">
            {filtered.map((item) => {
              const isResubmitted = item.status === 'Resubmitted'
              const isGraded = item.status === 'Graded'
              const isRevision = item.status === 'Revision Required'

              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 p-4 transition-colors hover:bg-[var(--color-ink-50)]/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <Avatar initials={item.student_initials} size={42} />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-sm font-bold text-[var(--color-ink-900)]">
                          {item.student_name}
                        </span>
                        <span className="text-xs text-[var(--color-ink-400)]">•</span>
                        <span className="text-xs font-medium text-[var(--color-ink-600)]">{item.cohort_name}</span>
                        <Badge tone="neutral" className="text-[10px]">
                          {item.item_type}
                        </Badge>
                      </div>

                      <p className="mt-1 text-sm font-medium text-[var(--color-ink-800)]">{item.title}</p>
                      <p className="text-xs text-[var(--color-ink-500)]">{item.course_name}</p>

                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-ink-400)]">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          Submitted {new Date(item.submitted_at).toLocaleDateString()} at{' '}
                          {new Date(item.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>

                        {item.files.length > 0 && (
                          <span className="flex items-center gap-1 text-[var(--color-harbor-600)]">
                            <FileText size={12} />
                            {item.files.length} attachment{item.files.length > 1 ? 's' : ''}
                          </span>
                        )}

                        {item.links.length > 0 && (
                          <span className="flex items-center gap-1 text-[var(--color-harbor-600)]">
                            <ExternalLink size={12} />
                            {item.links.length} repository/demo link{item.links.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                    <div>
                      {isResubmitted && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700 border border-purple-200">
                          <RotateCcw size={12} /> Revision Provided
                        </span>
                      )}
                      {item.status === 'Pending Review' && (
                        <Badge tone="warning">Pending Review</Badge>
                      )}
                      {isGraded && (
                        <div className="text-right">
                          <span className="rounded-full bg-[var(--color-success-100)] px-2.5 py-1 text-xs font-bold text-[var(--color-success-700)]">
                            {item.score} / {item.maximum_marks}
                          </span>
                        </div>
                      )}
                      {isRevision && (
                        <Badge tone="danger">Revision Requested</Badge>
                      )}
                    </div>

                    <button
                      onClick={() => openEvaluation(item)}
                      className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--color-harbor-600)]"
                    >
                      {isGraded ? 'Update Evaluation' : 'Grade & Feedback'}
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Evaluation Drawer / Modal */}
      {evaluatingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[var(--radius-lg)] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-[var(--color-line)] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Badge tone="neutral">{evaluatingItem.item_type}</Badge>
                  <span className="text-xs text-[var(--color-ink-500)]">{evaluatingItem.cohort_name}</span>
                </div>
                <h2 className="mt-1 font-display text-lg font-bold text-[var(--color-ink-900)]">
                  {evaluatingItem.title}
                </h2>
                <p className="text-xs text-[var(--color-ink-500)]">
                  Student: <strong className="text-[var(--color-ink-800)]">{evaluatingItem.student_name}</strong> •{' '}
                  {evaluatingItem.course_name}
                </p>
              </div>
              <button
                onClick={() => setEvaluatingItem(null)}
                className="rounded-full p-1 text-[var(--color-ink-400)] hover:bg-[var(--color-ink-100)] hover:text-[var(--color-ink-700)]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-5 space-y-5">
              {/* Student Submission Card */}
              <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-ink-50)]/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink-600)]">
                    Student Deliverable & Response
                  </span>
                  <span className="text-xs text-[var(--color-ink-400)]">
                    Submitted: {new Date(evaluatingItem.submitted_at).toLocaleString()}
                  </span>
                </div>

                {evaluatingItem.resubmission_notes && (
                  <div className="mt-3 rounded-[var(--radius-md)] bg-purple-50 p-2.5 text-xs text-purple-800 border border-purple-200">
                    <span className="font-semibold">Student Re-submission Note: </span>
                    {evaluatingItem.resubmission_notes}
                  </div>
                )}

                <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--color-ink-800)]">
                  {evaluatingItem.response_text || 'No written response text provided.'}
                </p>

                {/* Attached Files */}
                {evaluatingItem.files.length > 0 && (
                  <div className="mt-4 border-t border-[var(--color-line)] pt-3">
                    <p className="text-xs font-semibold text-[var(--color-ink-600)]">Attached Files:</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {evaluatingItem.files.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-xs text-[var(--color-ink-800)]"
                        >
                          <FileText size={13} className="text-[var(--color-harbor-600)]" />
                          <span className="font-medium">{file.name}</span>
                          <span className="text-[10px] text-[var(--color-ink-400)]">({file.size})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attached Links */}
                {evaluatingItem.links.length > 0 && (
                  <div className="mt-3 border-t border-[var(--color-line)] pt-3">
                    <p className="text-xs font-semibold text-[var(--color-ink-600)]">Project Links:</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {evaluatingItem.links.map((link, idx) => (
                        <a
                          key={idx}
                          href={link}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-xs font-medium text-[var(--color-harbor-600)] hover:underline"
                        >
                          <ExternalLink size={12} />
                          {link}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Evaluation Controls */}
              <div className="rounded-[var(--radius-md)] border border-[var(--color-harbor-200)] bg-[var(--color-harbor-50)]/30 p-4">
                <SectionHeading title="Trainer Assessment & Rubric Score" />

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-ink-700)]">
                      Score (out of {evaluatingItem.maximum_marks})
                    </label>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max={evaluatingItem.maximum_marks}
                        value={scoreInput}
                        onChange={(e) => setScoreInput(e.target.value)}
                        placeholder={`e.g. ${evaluatingItem.maximum_marks}`}
                        className="w-28 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm font-bold text-[var(--color-ink-900)] focus:border-[var(--color-harbor-500)] focus:outline-none"
                      />
                      {calculatedPct !== null && (
                        <span className="text-sm font-semibold text-[var(--color-ink-700)]">
                          = {calculatedPct}% ({calculateLetterGrade(calculatedPct)})
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-ink-700)]">
                      Competency Rubric Tier
                    </label>
                    <select
                      value={rubricTier}
                      onChange={(e) => setRubricTier(e.target.value as any)}
                      className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3 py-2 text-xs font-medium text-[var(--color-ink-800)] focus:border-[var(--color-harbor-500)] focus:outline-none"
                    >
                      <option value="Mastery">Mastery (90 - 100%)</option>
                      <option value="Proficient">Proficient (80 - 89%)</option>
                      <option value="Approaching">Approaching Benchmark (70 - 79%)</option>
                      <option value="Needs Support">Needs Support (&lt; 70%)</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-xs font-semibold text-[var(--color-ink-700)]">
                    Trainer Evaluation & Strengths Feedback
                  </label>
                  <textarea
                    rows={3}
                    value={feedbackInput}
                    onChange={(e) => setFeedbackInput(e.target.value)}
                    placeholder="Provide constructive feedback highlighting demonstrated skills, design decisions, and code clarity..."
                    className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-2.5 text-xs text-[var(--color-ink-900)] focus:border-[var(--color-harbor-500)] focus:outline-none"
                  />
                </div>

                <div className="mt-3">
                  <label className="block text-xs font-semibold text-[var(--color-ink-700)]">
                    Areas for Improvement & Recommended Next Steps
                  </label>
                  <textarea
                    rows={2}
                    value={areasInput}
                    onChange={(e) => setAreasInput(e.target.value)}
                    placeholder="Specific actionable points the learner can improve upon..."
                    className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-2.5 text-xs text-[var(--color-ink-900)] focus:border-[var(--color-harbor-500)] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-6 flex flex-col-reverse justify-end gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setEvaluatingItem(null)}
                className="rounded-[var(--radius-md)] px-4 py-2 text-xs font-medium text-[var(--color-ink-600)] hover:bg-[var(--color-ink-100)]"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleSaveGrade('Revision Required')}
                className="rounded-[var(--radius-md)] border border-[var(--color-warning-500)] bg-[var(--color-warning-50)] px-4 py-2 text-xs font-semibold text-[var(--color-warning-800)] hover:bg-[var(--color-warning-100)]"
              >
                Return for Revision
              </button>

              <button
                type="button"
                onClick={() => handleSaveGrade('Graded')}
                className="flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-harbor-600)]"
              >
                <Send size={13} />
                Release Grade & Feedback
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <Modal title="Clear Grading Queue" onClose={() => setShowClearConfirm(false)}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-[var(--radius-md)] bg-[var(--color-danger-50)] p-3 text-xs text-[var(--color-danger-800)] border border-[var(--color-danger-200)]">
              <AlertTriangle className="h-5 w-5 shrink-0 text-[var(--color-danger-600)]" />
              <div>
                <p className="font-semibold">Reset all submissions in the grading queue?</p>
                <p className="mt-1">
                  This will purge all queued submissions, evaluated draft scores, and revision requests. The queue will be reset to an empty state.
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
                onClick={handleClearQueue}
                className="rounded-[var(--radius-md)] bg-[var(--color-danger-600)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--color-danger-700)]"
              >
                Clear Queue Now
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
