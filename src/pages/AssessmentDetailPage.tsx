import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  Check,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react'
import { Card, Badge } from '@/components/ui/primitives'
import { useAuth } from '@/app/auth'
import {
  getStoredAssessments,
  saveStoredAssessments,
  getStoredAttempts,
  saveStoredAttempts,
  calculateAssessmentStats,
  formatAssessmentDate,
} from '@/lib/assessments'
import type {
  Assessment,
  AssessmentAttempt,
  AssessmentStatus,
} from '@/types'

type ActiveTab = 'overview' | 'questions' | 'students' | 'attempts' | 'results'

export function AssessmentDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { role, profile, session } = useAuth()
  const isStaff = ['admin', 'manager', 'trainer'].includes(role ?? '')
  const isStudent = role === 'student'

  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [attempts, setAttempts] = useState<AssessmentAttempt[]>([])
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview')

  // Search & Filter
  const [studentSearch, setStudentSearch] = useState<string>('')
  const [attemptFilter, setAttemptFilter] = useState<string>('all')

  // ==========================================
  // Assessment Runner State (Taking the exam)
  // ==========================================
  const [isTakingAssessment, setIsTakingAssessment] = useState<boolean>(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({})
  const [remainingSeconds, setRemainingSeconds] = useState<number>(60 * 60)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState<boolean>(false)
  const [showResultScreen, setShowResultScreen] = useState<boolean>(false)
  const [completedResult, setCompletedResult] = useState<{
    score: number
    percentage: number
    result: 'Passed' | 'Failed'
    feedback?: string
  } | null>(null)

  const timerRef = useRef<any>(null)
  const submitRef = useRef<() => void>(() => {})

  // Load Assessment & Attempts
  useEffect(() => {
    const list = getStoredAssessments()
    const found = list.find((a) => a.id === id) || list[0]
    setAssessment(found)

    if (found) {
      const atts = getStoredAttempts(found.id)
      setAttempts(atts)
    }
  }, [id])

  // Timer effect for runner
  useEffect(() => {
    if (isTakingAssessment && !showResultScreen) {
      timerRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current)
            submitRef.current?.()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isTakingAssessment, showResultScreen])

  // Calculated Stats for Attempts & Results
  const stats = useMemo(() => {
    if (!assessment) return null
    return calculateAssessmentStats(attempts, assessment.total_marks)
  }, [attempts, assessment])

  // Current user's attempt if student
  const currentUserAttempt = useMemo(() => {
    if (!assessment) return null
    return attempts.find(
      (a) =>
        a.student_id === profile?.id ||
        a.student_email?.toLowerCase() === session?.user?.email?.toLowerCase() ||
        a.student_name.toLowerCase() === (profile?.full_name || '').toLowerCase()
    )
  }, [attempts, assessment, profile, session])

  if (!assessment) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-[var(--color-ink-500)]">
          Loading assessment details...
        </p>
      </div>
    )
  }

  // Format countdown clock: MM:SS
  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // Toggle Publish Status
  const handleToggleStatus = (newStatus: AssessmentStatus) => {
    const updated: Assessment = { ...assessment, status: newStatus }
    setAssessment(updated)
    const all = getStoredAssessments().map((a) => (a.id === updated.id ? updated : a))
    saveStoredAssessments(all)
  }

  // Start Assessment
  const handleStartAssessment = () => {
    const totalSecs = (assessment.time_limit_minutes || 60) * 60
    setRemainingSeconds(totalSecs)
    setCurrentQuestionIndex(0)
    setSelectedAnswers({})
    setShowSubmitConfirm(false)
    setShowResultScreen(false)
    setCompletedResult(null)
    setIsTakingAssessment(true)
  }

  // Record Answer
  const handleSelectOption = (questionId: string, answerKey: string) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: answerKey,
    }))
  }

  // Submit Assessment & Calculate Real Score
  const handleSubmitAssessment = () => {
    setShowSubmitConfirm(false)
    if (timerRef.current) clearInterval(timerRef.current)

    // Calculate score
    let totalScore = 0
    assessment.questions.forEach((q) => {
      const studentAns = selectedAnswers[q.id]
      if (studentAns && q.correct_answer) {
        if (studentAns.trim().toUpperCase() === q.correct_answer.trim().toUpperCase()) {
          totalScore += q.marks || 0
        }
      }
    })

    const percentage =
      assessment.total_marks > 0
        ? Math.round((totalScore / assessment.total_marks) * 1000) / 10
        : 0
    const passingScore = assessment.settings.passing_score || 50
    const passed = percentage >= passingScore

    const resultObj = {
      score: totalScore,
      percentage,
      result: passed ? ('Passed' as const) : ('Failed' as const),
      feedback: passed
        ? 'Commendable performance! You demonstrated thorough understanding of core concepts.'
        : 'Did not meet passing criteria. Review key learning outcomes and schedule a support session.',
    }

    setCompletedResult(resultObj)
    setShowResultScreen(true)

    // Save attempt in state & storage
    const studentName = profile?.full_name || session?.user?.email?.split('@')[0] || 'David Ade'
    const studentEmail = session?.user?.email || 'david.ade@ijeshahub.org'
    const studentId = profile?.id || 'student-1'

    const newAttempt: AssessmentAttempt = {
      id: `att-${assessment.id}-${Date.now()}`,
      assessment_id: assessment.id,
      student_id: studentId,
      student_name: studentName,
      student_email: studentEmail,
      status: 'Completed',
      score: totalScore,
      percentage,
      result: resultObj.result,
      started_at: new Date(Date.now() - (assessment.time_limit_minutes * 60 - remainingSeconds) * 1000).toISOString(),
      completed_at: new Date().toISOString(),
      time_spent_seconds: assessment.time_limit_minutes * 60 - remainingSeconds,
      answers: selectedAnswers,
      feedback: resultObj.feedback,
    }

    const updatedAttempts = attempts.filter(
      (a) =>
        a.student_name.toLowerCase() !== studentName.toLowerCase() &&
        a.student_id !== studentId
    )
    const finalized = [newAttempt, ...updatedAttempts]
    setAttempts(finalized)
    saveStoredAttempts(assessment.id, finalized)
  }

  submitRef.current = handleSubmitAssessment

  // Filtered lists for tabs
  const filteredStudents = attempts.filter((a) => {
    return (
      a.student_name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      (a.student_email || '').toLowerCase().includes(studentSearch.toLowerCase())
    )
  })

  const filteredAttempts = attempts.filter((a) => {
    if (attemptFilter === 'completed') return a.status === 'Completed'
    if (attemptFilter === 'in_progress') return a.status === 'In Progress'
    if (attemptFilter === 'not_started') return a.status === 'Not Started'
    return true
  })

  // =========================================================================
  // VIEW: Active Test-Taking Runner (Student / Preview Mode)
  // =========================================================================
  if (isTakingAssessment) {
    const q = assessment.questions[currentQuestionIndex]
    const currentAnswer = selectedAnswers[q.id]
    const answeredCount = Object.keys(selectedAnswers).length
    const isLastQuestion =
      currentQuestionIndex === assessment.questions.length - 1

    // If result screen is active
    if (showResultScreen && completedResult) {
      return (
        <div className="max-w-3xl mx-auto space-y-6 py-4">
          <Card className="p-8 text-center border-t-4 border-t-[var(--color-harbor-500)] shadow-lg">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-success-50)] text-[var(--color-success-600)] mb-4">
              <CheckCircle2 size={40} />
            </div>

            <h2 className="text-2xl font-bold text-[var(--color-ink-900)]">
              Assessment Submitted
            </h2>
            <p className="mt-1 text-sm text-[var(--color-ink-500)]">
              Your responses have been recorded and evaluated.
            </p>

            {/* Score Showcase */}
            <div className="mt-6 inline-flex flex-col sm:flex-row items-center justify-center gap-6 rounded-[var(--radius-lg)] bg-[var(--color-paper)] p-6 border border-[var(--color-line)]">
              <div>
                <span className="text-xs uppercase font-bold text-[var(--color-ink-400)] tracking-wider">
                  Score
                </span>
                <p className="text-3xl font-extrabold text-[var(--color-ink-900)]">
                  {completedResult.score} / {assessment.total_marks}
                </p>
              </div>
              <div className="hidden sm:block h-10 w-px bg-[var(--color-line)]" />
              <div>
                <span className="text-xs uppercase font-bold text-[var(--color-ink-400)] tracking-wider">
                  Percentage
                </span>
                <p className="text-3xl font-extrabold text-[var(--color-harbor-700)]">
                  {completedResult.percentage}%
                </p>
              </div>
              <div className="hidden sm:block h-10 w-px bg-[var(--color-line)]" />
              <div>
                <span className="text-xs uppercase font-bold text-[var(--color-ink-400)] tracking-wider">
                  Result
                </span>
                <div className="mt-0.5">
                  <Badge
                    tone={
                      completedResult.result === 'Passed' ? 'success' : 'danger'
                    }
                  >
                    {completedResult.result}
                  </Badge>
                </div>
              </div>
            </div>

            {completedResult.feedback && (
              <div className="mt-6 max-w-lg mx-auto rounded-[var(--radius-md)] bg-[var(--color-ink-50)] p-4 text-xs text-[var(--color-ink-700)] text-left border border-[var(--color-line)]">
                <span className="font-bold block text-[var(--color-ink-900)] mb-1">
                  Instructor Feedback:
                </span>
                {completedResult.feedback}
              </div>
            )}

            <div className="mt-8 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsTakingAssessment(false);
                  setShowResultScreen(false);
                  setActiveTab('results');
                }}
                className="rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-harbor-600)]"
              >
                Back to Assessment Details
              </button>
            </div>
          </Card>
        </div>
      )
    }

    return (
      <div className="max-w-3xl mx-auto space-y-6 py-4">
        {/* Runner Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-4">
          <div>
            <span className="text-xs font-semibold text-[var(--color-harbor-600)]">
              {assessment.course_name} · {assessment.cohort_name}
            </span>
            <h1 className="text-xl font-bold text-[var(--color-ink-900)]">
              {assessment.title}
            </h1>
          </div>

          <div className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-ink-900)] px-3.5 py-1.5 text-white shadow-xs">
            <Clock size={16} className="text-[var(--color-warning-400)]" />
            <span className="text-xs font-mono font-bold tracking-wide">
              Time Remaining: {formatTimer(remainingSeconds)}
            </span>
          </div>
        </div>

        {/* Question Progress & Navigation Bar */}
        <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-3 shadow-2xs">
          <div className="flex items-center justify-between mb-2 text-xs font-medium text-[var(--color-ink-600)]">
            <span>
              Question{' '}
              <strong className="text-[var(--color-ink-900)]">
                {currentQuestionIndex + 1}
              </strong>{' '}
              of {assessment.questions.length}
            </span>
            <span>
              Answered: {answeredCount}/{assessment.questions.length}
            </span>
          </div>

          {/* Quick jump pills */}
          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-[var(--color-line)]">
            {assessment.questions.map((ques, idx) => {
              const isCurrent = idx === currentQuestionIndex
              const isAnswered = Boolean(selectedAnswers[ques.id])
              return (
                <button
                  key={ques.id}
                  type="button"
                  onClick={() => setCurrentQuestionIndex(idx)}
                  className={`h-7 w-7 rounded-[var(--radius-sm)] text-xs font-semibold transition-all ${
                    isCurrent
                      ? 'ring-2 ring-[var(--color-harbor-500)] bg-[var(--color-harbor-600)] text-white'
                      : isAnswered
                      ? 'bg-[var(--color-harbor-100)] text-[var(--color-harbor-800)]'
                      : 'bg-[var(--color-paper)] text-[var(--color-ink-600)] hover:bg-[var(--color-ink-100)]'
                  }`}
                >
                  {idx + 1}
                </button>
              )
            })}
          </div>
        </div>

        {/* Current Question Card */}
        <Card className="p-6 space-y-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-harbor-700)]">
              Question {currentQuestionIndex + 1}
            </span>
            <span className="rounded-[var(--radius-sm)] bg-[var(--color-success-50)] px-2 py-0.5 text-xs font-semibold text-[var(--color-success-700)]">
              Marks: {q.marks}
            </span>
          </div>

          <h2 className="text-base font-semibold text-[var(--color-ink-900)] leading-relaxed">
            {q.question_text}
          </h2>

          {/* Question Choices */}
          <div className="space-y-2.5 pt-2">
            {q.question_type === 'Multiple Choice' && q.options ? (
              q.options.map((opt) => {
                const isSelected = currentAnswer === opt.key
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => handleSelectOption(q.id, opt.key)}
                    className={`w-full text-left flex items-center gap-3.5 rounded-[var(--radius-md)] border p-3.5 text-sm transition-all ${
                      isSelected
                        ? 'border-[var(--color-harbor-500)] bg-[var(--color-harbor-50)]/50 font-semibold text-[var(--color-harbor-900)] ring-1 ring-[var(--color-harbor-400)]'
                        : 'border-[var(--color-line)] bg-white text-[var(--color-ink-800)] hover:bg-[var(--color-paper)]'
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        isSelected
                          ? 'bg-[var(--color-harbor-600)] text-white'
                          : 'bg-[var(--color-ink-100)] text-[var(--color-ink-600)]'
                      }`}
                    >
                      {opt.key}
                    </span>
                    <span>{opt.text}</span>
                  </button>
                )
              })
            ) : q.question_type === 'True/False' ? (
              <div className="grid grid-cols-2 gap-3">
                {['True', 'False'].map((val) => {
                  const isSelected =
                    currentAnswer?.toLowerCase() === val.toLowerCase()
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleSelectOption(q.id, val)}
                      className={`py-3.5 rounded-[var(--radius-md)] border text-sm font-semibold transition-all ${
                        isSelected
                          ? 'border-[var(--color-harbor-500)] bg-[var(--color-harbor-50)] text-[var(--color-harbor-800)] ring-1 ring-[var(--color-harbor-400)]'
                          : 'border-[var(--color-line)] bg-white text-[var(--color-ink-800)] hover:bg-[var(--color-paper)]'
                      }`}
                    >
                      {val}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div>
                <textarea
                  rows={4}
                  value={currentAnswer || ''}
                  onChange={(e) => handleSelectOption(q.id, e.target.value)}
                  placeholder="Type your response here..."
                  className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] p-3 text-sm text-[var(--color-ink-900)] focus:border-[var(--color-harbor-500)] focus:outline-hidden"
                />
              </div>
            )}
          </div>

          {/* Runner Navigation Footer */}
          <div className="flex items-center justify-between border-t border-[var(--color-line)] pt-4">
            <button
              type="button"
              disabled={currentQuestionIndex === 0}
              onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-4 py-2 text-xs font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-paper)] disabled:opacity-40"
            >
              <ChevronLeft size={16} /> Previous
            </button>

            <div className="flex items-center gap-2">
              {!isLastQuestion ? (
                <button
                  type="button"
                  onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-harbor-600)]"
                >
                  Next <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSubmitConfirm(true)}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-success-600)] px-5 py-2 text-xs font-bold text-white hover:bg-[var(--color-success-700)] shadow-xs"
                >
                  <Check size={16} /> Submit Assessment
                </button>
              )}
            </div>
          </div>
        </Card>

        {/* Confirmation Modal */}
        {showSubmitConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-6 shadow-xl">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-warning-100)] text-[var(--color-warning-700)] mb-3">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-center text-lg font-bold text-[var(--color-ink-900)]">
                Submit Assessment?
              </h3>
              <p className="mt-2 text-center text-sm text-[var(--color-ink-500)] leading-relaxed">
                “Once submitted, you may not be able to change your answers.”
              </p>
              <p className="mt-2 text-center text-xs text-[var(--color-ink-400)]">
                You have answered {answeredCount} of {assessment.questions.length}{' '}
                questions.
              </p>

              <div className="mt-6 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowSubmitConfirm(false)}
                  className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-4 py-2 text-xs font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-paper)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitAssessment}
                  className="rounded-[var(--radius-md)] bg-[var(--color-success-600)] px-5 py-2 text-xs font-bold text-white hover:bg-[var(--color-success-700)]"
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // =========================================================================
  // VIEW: Main Assessment Details Page (Overview, Questions, Students, Attempts, Results)
  // =========================================================================
  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link
        to="/assessments"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)]"
      >
        <ArrowLeft size={15} /> Back to Assessments
      </Link>

      {/* Top Header Card */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="rounded-[var(--radius-sm)] bg-[var(--color-ink-100)] px-2 py-0.5 text-xs font-bold text-[var(--color-ink-700)]">
                Week {assessment.training_week}
              </span>
              <span className="text-xs text-[var(--color-ink-500)]">
                {assessment.course_name} · {assessment.cohort_name}
              </span>
              <span className="text-xs text-[var(--color-ink-400)]">·</span>
              <span className="text-xs text-[var(--color-ink-500)]">
                {assessment.questions.length} Questions
              </span>
              <span className="text-xs text-[var(--color-ink-400)]">·</span>
              <span className="text-xs text-[var(--color-ink-500)]">
                Total Marks: {assessment.total_marks}
              </span>
              <span className="text-xs text-[var(--color-ink-400)]">·</span>
              <span className="text-xs text-[var(--color-ink-500)]">
                Passing Score: {assessment.settings.passing_score}%
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-[var(--color-ink-900)]">
              {assessment.title}
            </h1>

            <p className="mt-1.5 text-sm text-[var(--color-ink-600)] max-w-2xl">
              {assessment.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Badge
              tone={
                assessment.status === 'Published'
                  ? 'success'
                  : assessment.status === 'Draft'
                  ? 'warning'
                  : 'neutral'
              }
            >
              {assessment.status}
            </Badge>

            {/* If Student: Start Assessment or View Results */}
            {isStudent && (
              <button
                type="button"
                onClick={handleStartAssessment}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--color-harbor-600)] shadow-xs"
              >
                <Play size={14} />{' '}
                {currentUserAttempt?.status === 'Completed'
                  ? 'Retake Assessment'
                  : 'Start Assessment'}
              </button>
            )}

            {/* If Staff: Test runner / Preview mode or Toggle status */}
            {isStaff && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleStartAssessment}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-harbor-300)] bg-[var(--color-harbor-50)] px-3 py-1.5 text-xs font-semibold text-[var(--color-harbor-700)] hover:bg-[var(--color-harbor-100)]"
                  title="Test-run the assessment as a student would experience it"
                >
                  <Play size={13} /> Preview as Student
                </button>

                <select
                  value={assessment.status}
                  onChange={(e) =>
                    handleToggleStatus(e.target.value as AssessmentStatus)
                  }
                  className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-xs font-semibold text-[var(--color-ink-800)]"
                >
                  <option value="Draft">Draft</option>
                  <option value="Published">Published</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-6 flex flex-wrap gap-2 border-t border-[var(--color-line)] pt-3">
          {[
            { key: 'overview', label: 'Overview' },
            {
              key: 'questions',
              label: `Questions (${assessment.questions.length})`,
            },
            { key: 'students', label: `Students (${attempts.length})` },
            {
              key: 'attempts',
              label: `Attempts (${stats?.completed || 0}/${stats?.totalStudents || 0})`,
            },
            { key: 'results', label: 'Results' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as ActiveTab)}
              className={`rounded-[var(--radius-md)] px-3.5 py-2 text-xs font-semibold transition-all ${
                activeTab === tab.key
                  ? 'bg-[var(--color-harbor-500)] text-white'
                  : 'bg-[var(--color-paper)] text-[var(--color-ink-600)] hover:bg-[var(--color-ink-100)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </Card>

      {/* ========================================================= */}
      {/* TAB 1: OVERVIEW                                           */}
      {/* ========================================================= */}
      {activeTab === 'overview' && (
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="p-6 md:col-span-2 space-y-6">
            <div>
              <h3 className="text-sm font-bold text-[var(--color-ink-900)] mb-2">
                Instructions
              </h3>
              <div className="rounded-[var(--radius-md)] bg-[var(--color-paper)] p-4 text-sm text-[var(--color-ink-700)] leading-relaxed whitespace-pre-wrap">
                {assessment.instructions ||
                  'No special instructions provided. Please answer all questions within the allocated duration.'}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-[var(--color-ink-900)] mb-3">
                Parameters & Specifications
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 text-xs">
                <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-3 space-y-1">
                  <span className="text-[var(--color-ink-400)]">Course & Cohort</span>
                  <p className="font-semibold text-[var(--color-ink-900)]">
                    {assessment.course_name} ({assessment.cohort_name})
                  </p>
                </div>
                <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-3 space-y-1">
                  <span className="text-[var(--color-ink-400)]">Assessment Type</span>
                  <p className="font-semibold text-[var(--color-ink-900)]">
                    {assessment.assessment_type}
                  </p>
                </div>
                <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-3 space-y-1">
                  <span className="text-[var(--color-ink-400)]">Training Schedule</span>
                  <p className="font-semibold text-[var(--color-ink-900)]">
                    Week {assessment.training_week}
                  </p>
                </div>
                <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-3 space-y-1">
                  <span className="text-[var(--color-ink-400)]">Time Limit</span>
                  <p className="font-semibold text-[var(--color-ink-900)]">
                    {assessment.time_limit_minutes} Minutes
                  </p>
                </div>
                <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-3 space-y-1">
                  <span className="text-[var(--color-ink-400)]">Total Marks & Questions</span>
                  <p className="font-semibold text-[var(--color-ink-900)]">
                    {assessment.total_marks} Marks ({assessment.questions.length} Questions)
                  </p>
                </div>
                <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-3 space-y-1">
                  <span className="text-[var(--color-ink-400)]">Passing Score</span>
                  <p className="font-semibold text-[var(--color-success-700)]">
                    {assessment.settings.passing_score}%
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Schedule & Settings sidebar */}
          <div className="space-y-4">
            <Card className="p-5 space-y-4">
              <h3 className="text-sm font-bold text-[var(--color-ink-900)]">
                Schedule
              </h3>
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-ink-500)]">Start Date:</span>
                  <span className="font-semibold text-[var(--color-ink-900)]">
                    {formatAssessmentDate(assessment.start_date)} at{' '}
                    {assessment.start_time}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-ink-500)]">End Date:</span>
                  <span className="font-semibold text-[var(--color-ink-900)]">
                    {assessment.end_date
                      ? formatAssessmentDate(assessment.end_date)
                      : 'Open until closed'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-ink-500)]">Current Status:</span>
                  <Badge
                    tone={
                      assessment.status === 'Published'
                        ? 'success'
                        : assessment.status === 'Draft'
                        ? 'warning'
                        : 'neutral'
                    }
                  >
                    {assessment.status}
                  </Badge>
                </div>
              </div>
            </Card>

            <Card className="p-5 space-y-3">
              <h3 className="text-sm font-bold text-[var(--color-ink-900)]">
                Evaluation Settings
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-ink-500)]">Shuffle Questions:</span>
                  <span className="font-semibold text-[var(--color-ink-800)]">
                    {assessment.settings.shuffle_questions ? 'On' : 'Off'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-ink-500)]">
                    Show Results After Submission:
                  </span>
                  <span className="font-semibold text-[var(--color-ink-800)]">
                    {assessment.settings.show_results_after_submission
                      ? 'On'
                      : 'Off'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-ink-500)]">Allow Retake:</span>
                  <span className="font-semibold text-[var(--color-ink-800)]">
                    {assessment.settings.allow_retake ? 'On' : 'Off'}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: QUESTIONS                                          */}
      {/* ========================================================= */}
      {activeTab === 'questions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--color-ink-500)]">
              Authorized trainers and administrators can inspect question keys and marks.
            </p>
            <span className="text-xs font-bold text-[var(--color-harbor-700)]">
              Total Questions: {assessment.questions.length} (Sum of marks: {assessment.total_marks})
            </span>
          </div>

          <div className="space-y-3">
            {assessment.questions.map((q, idx) => (
              <Card key={q.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-harbor-100)] text-xs font-bold text-[var(--color-harbor-700)]">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-semibold text-[var(--color-ink-500)]">
                      Type: {q.question_type}
                    </span>
                  </div>
                  <span className="rounded-[var(--radius-sm)] bg-[var(--color-success-50)] px-2 py-0.5 text-xs font-bold text-[var(--color-success-700)]">
                    {q.marks} Marks
                  </span>
                </div>

                <p className="text-sm font-medium text-[var(--color-ink-900)]">
                  {q.question_text}
                </p>

                {/* Choices */}
                {q.options && q.options.length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2 pt-1">
                    {q.options.map((opt) => {
                      const isCorrect =
                        opt.key.toUpperCase() === q.correct_answer?.toUpperCase()
                      return (
                        <div
                          key={opt.key}
                          className={`flex items-center gap-2 rounded-[var(--radius-md)] border p-2 text-xs ${
                            isCorrect
                              ? 'border-[var(--color-success-300)] bg-[var(--color-success-50)] text-[var(--color-success-800)] font-semibold'
                              : 'border-[var(--color-line)] bg-white text-[var(--color-ink-700)]'
                          }`}
                        >
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                              isCorrect
                                ? 'bg-[var(--color-success-600)] text-white'
                                : 'bg-[var(--color-ink-100)] text-[var(--color-ink-600)]'
                            }`}
                          >
                            {opt.key}
                          </span>
                          <span>{opt.text}</span>
                          {isCorrect && (
                            <span className="ml-auto text-[10px] font-bold text-[var(--color-success-700)] uppercase tracking-wide">
                              Correct Answer
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: STUDENTS                                           */}
      {/* ========================================================= */}
      {activeTab === 'students' && (
        <Card className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-[var(--color-ink-900)]">
                Cohort Students ({attempts.length})
              </h3>
              <p className="text-xs text-[var(--color-ink-500)]">
                Click any student to open their Student Profile.
              </p>
            </div>
            <input
              type="text"
              placeholder="Search student..."
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-1.5 text-xs text-[var(--color-ink-900)] focus:border-[var(--color-harbor-500)] focus:outline-hidden"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--color-line)] bg-[var(--color-paper)] text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">
                <tr>
                  <th className="px-4 py-2.5">Student</th>
                  <th className="px-4 py-2.5">Email</th>
                  <th className="px-4 py-2.5">Cohort</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)] bg-white">
                {filteredStudents.map((s) => (
                  <tr
                    key={s.id}
                    className="hover:bg-[var(--color-paper)]/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-semibold text-[var(--color-ink-900)]">
                      <Link
                        to={`/students/${s.student_id}`}
                        className="hover:text-[var(--color-harbor-600)] hover:underline flex items-center gap-2"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-harbor-100)] text-xs font-bold text-[var(--color-harbor-700)]">
                          {s.student_name.charAt(0)}
                        </span>
                        {s.student_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-ink-500)]">
                      {s.student_email}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-ink-600)]">
                      {assessment.cohort_name}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <Badge
                        tone={
                          s.status === 'Completed'
                            ? 'success'
                            : s.status === 'In Progress'
                            ? 'warning'
                            : 'neutral'
                        }
                      >
                        {s.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/students/${s.student_id}`}
                        className="text-xs font-semibold text-[var(--color-harbor-600)] hover:underline"
                      >
                        Open Profile →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ========================================================= */}
      {/* TAB 4: ATTEMPTS                                           */}
      {/* ========================================================= */}
      {activeTab === 'attempts' && (
        <div className="space-y-6">
          {/* Summary Stat Pills matching prompt: Started: 22 · Completed: 20 · Not Started: 3 */}
          {stats && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="p-4 text-center border-l-4 border-l-[var(--color-harbor-500)]">
                <span className="text-xs uppercase font-bold text-[var(--color-ink-400)] tracking-wider">
                  Started
                </span>
                <p className="text-2xl font-extrabold text-[var(--color-harbor-700)] mt-0.5">
                  {stats.started}
                </p>
                <span className="text-[11px] text-[var(--color-ink-400)]">
                  Active or finished attempts
                </span>
              </Card>

              <Card className="p-4 text-center border-l-4 border-l-[var(--color-success-500)]">
                <span className="text-xs uppercase font-bold text-[var(--color-ink-400)] tracking-wider">
                  Completed
                </span>
                <p className="text-2xl font-extrabold text-[var(--color-success-700)] mt-0.5">
                  {stats.completed}
                </p>
                <span className="text-[11px] text-[var(--color-ink-400)]">
                  Evaluated and submitted
                </span>
              </Card>

              <Card className="p-4 text-center border-l-4 border-l-[var(--color-ink-300)]">
                <span className="text-xs uppercase font-bold text-[var(--color-ink-400)] tracking-wider">
                  Not Started
                </span>
                <p className="text-2xl font-extrabold text-[var(--color-ink-700)] mt-0.5">
                  {stats.notStarted}
                </p>
                <span className="text-[11px] text-[var(--color-ink-400)]">
                  Pending student launch
                </span>
              </Card>
            </div>
          )}

          {/* Filter Bar & Attempts Table */}
          <Card className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h3 className="text-sm font-bold text-[var(--color-ink-900)]">
                Student Attempts Log
              </h3>

              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-ink-500)]">Filter:</span>
                <select
                  value={attemptFilter}
                  onChange={(e) => setAttemptFilter(e.target.value)}
                  className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-2.5 py-1 text-xs text-[var(--color-ink-800)]"
                >
                  <option value="all">All Attempts</option>
                  <option value="completed">Completed ({stats?.completed})</option>
                  <option value="in_progress">In Progress</option>
                  <option value="not_started">Not Started ({stats?.notStarted})</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--color-line)] bg-[var(--color-paper)] text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">
                  <tr>
                    <th className="px-4 py-2.5">Student</th>
                    <th className="px-4 py-2.5">Attempt Status</th>
                    <th className="px-4 py-2.5">Start Time</th>
                    <th className="px-4 py-2.5">Completion Time</th>
                    <th className="px-4 py-2.5">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-line)] bg-white">
                  {filteredAttempts.map((att) => (
                    <tr
                      key={att.id}
                      className="hover:bg-[var(--color-paper)]/50 transition-colors"
                    >
                      <td className="px-4 py-3 font-semibold text-[var(--color-ink-900)]">
                        <Link
                          to={`/students/${att.student_id}`}
                          className="hover:text-[var(--color-harbor-600)] hover:underline"
                        >
                          {att.student_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          tone={
                            att.status === 'Completed'
                              ? 'success'
                              : att.status === 'In Progress'
                              ? 'warning'
                              : 'neutral'
                          }
                        >
                          {att.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--color-ink-500)]">
                        {att.started_at
                          ? new Date(att.started_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--color-ink-500)]">
                        {att.completed_at
                          ? new Date(att.completed_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-[var(--color-ink-800)]">
                        {att.score !== null && att.score !== undefined ? (
                          <span>
                            {att.score} / {assessment.total_marks} ({att.percentage}%)
                          </span>
                        ) : (
                          <span className="text-[var(--color-ink-400)]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 5: RESULTS                                            */}
      {/* ========================================================= */}
      {activeTab === 'results' && (
        <div className="space-y-6">
          {/* Performance Summary Banner */}
          {stats && (
            <div className="grid gap-3 sm:grid-cols-4">
              <Card className="p-4 text-center">
                <span className="text-xs uppercase font-bold text-[var(--color-ink-400)] tracking-wider">
                  Pass Rate
                </span>
                <p className="text-2xl font-extrabold text-[var(--color-success-700)] mt-0.5">
                  {stats.completed > 0
                    ? `${Math.round((stats.passed / stats.completed) * 100)}%`
                    : '—'}
                </p>
                <span className="text-[11px] text-[var(--color-ink-400)]">
                  {stats.passed} Passed / {stats.failed} Failed
                </span>
              </Card>

              <Card className="p-4 text-center">
                <span className="text-xs uppercase font-bold text-[var(--color-ink-400)] tracking-wider">
                  Average Score
                </span>
                <p className="text-2xl font-extrabold text-[var(--color-harbor-700)] mt-0.5">
                  {stats.averageScore} / {assessment.total_marks}
                </p>
                <span className="text-[11px] text-[var(--color-ink-400)]">
                  Mean: {stats.averagePercentage}%
                </span>
              </Card>

              <Card className="p-4 text-center">
                <span className="text-xs uppercase font-bold text-[var(--color-ink-400)] tracking-wider">
                  Highest Score
                </span>
                <p className="text-2xl font-extrabold text-[var(--color-ink-900)] mt-0.5">
                  {stats.highestScore} / {assessment.total_marks}
                </p>
                <span className="text-[11px] text-[var(--color-success-600)] font-semibold">
                  Top performer
                </span>
              </Card>

              <Card className="p-4 text-center">
                <span className="text-xs uppercase font-bold text-[var(--color-ink-400)] tracking-wider">
                  Lowest Score
                </span>
                <p className="text-2xl font-extrabold text-[var(--color-ink-700)] mt-0.5">
                  {stats.lowestScore} / {assessment.total_marks}
                </p>
                <span className="text-[11px] text-[var(--color-ink-400)]">
                  Pass mark: {assessment.settings.passing_score}%
                </span>
              </Card>
            </div>
          )}

          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[var(--color-ink-900)]">
                  Assessment Results
                </h3>
                <p className="text-xs text-[var(--color-ink-500)]">
                  Performance across completed student assessments. Students are clickable.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--color-line)] bg-[var(--color-paper)] text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">
                  <tr>
                    <th className="px-4 py-2.5">Student</th>
                    <th className="px-4 py-2.5 text-right">Score</th>
                    <th className="px-4 py-2.5 text-right">Percentage</th>
                    <th className="px-4 py-2.5">Result</th>
                    <th className="px-4 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-line)] bg-white">
                  {attempts.filter((a) => a.status === 'Completed').length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-sm text-[var(--color-ink-400)]">
                        No completed assessment attempts recorded yet.
                      </td>
                    </tr>
                  ) : (
                    attempts
                      .filter((a) => a.status === 'Completed')
                      .map((res) => (
                        <tr
                          key={res.id}
                          className="hover:bg-[var(--color-paper)]/50 transition-colors"
                        >
                          <td className="px-4 py-3 font-semibold text-[var(--color-ink-900)]">
                            <Link
                              to={`/students/${res.student_id}`}
                              className="hover:text-[var(--color-harbor-600)] hover:underline flex items-center gap-2"
                            >
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-harbor-100)] text-xs font-bold text-[var(--color-harbor-700)]">
                                {res.student_name.charAt(0)}
                              </span>
                              {res.student_name}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-[var(--color-ink-800)]">
                            {res.score} / {assessment.total_marks}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-[var(--color-harbor-700)]">
                            {res.percentage}%
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              tone={res.result === 'Passed' ? 'success' : 'danger'}
                            >
                              {res.result}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              to={`/students/${res.student_id}`}
                              className="text-xs font-semibold text-[var(--color-harbor-600)] hover:underline"
                            >
                              View Student →
                            </Link>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
