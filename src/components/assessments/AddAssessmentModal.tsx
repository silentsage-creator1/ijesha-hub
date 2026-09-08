import { useState, useEffect } from 'react'
import { X, Plus, Trash2, Edit3, Check, AlertCircle } from 'lucide-react'
import {
  ASSESSMENT_TYPES,
  QUESTION_TYPES,
} from '@/lib/assessments'
import type {
  Assessment,
  AssessmentQuestion,
  AssessmentStatus,
  AssessmentType,
  QuestionType,
} from '@/types'
import { supabase } from '@/lib/supabase'
import { getAllCohorts, getCachedCohorts } from '@/lib/cohorts'

interface AddAssessmentModalProps {
  onClose: () => void
  onCreated: (assessment: Assessment) => void
  initialCohortId?: string
}

interface CohortOption {
  id: string
  name: string
  course_id: string
  course_name: string
}

export function AddAssessmentModal({
  onClose,
  onCreated,
  initialCohortId = '',
}: AddAssessmentModalProps) {
  // Available cohorts & courses
  const [cohorts, setCohorts] = useState<CohortOption[]>(() =>
    getCachedCohorts().map((c) => ({
      id: c.id,
      name: c.name,
      course_id: c.course_id,
      course_name: c.course_name,
    }))
  )

  // Form State
  const [selectedCohortId, setSelectedCohortId] = useState<string>(() => {
    if (initialCohortId) return initialCohortId
    const cached = getCachedCohorts()
    return cached[0]?.id || ''
  })
  const [trainingWeek, setTrainingWeek] = useState<number>(3)
  const [title, setTitle] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [assessmentType, setAssessmentType] = useState<AssessmentType>('Quiz')
  const [instructions, setInstructions] = useState<string>('')

  // Schedule
  const [startDate, setStartDate] = useState<string>(() =>
    new Date().toISOString().split('T')[0]
  )
  const [startTime, setStartTime] = useState<string>('10:00')
  const [endDate, setEndDate] = useState<string>(() =>
    new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0]
  )
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number>(60)

  // Questions Builder
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([])
  const [showQuestionForm, setShowQuestionForm] = useState<boolean>(false)
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null)

  // Sub-form for adding/editing question
  const [qText, setQText] = useState<string>('')
  const [qType, setQType] = useState<QuestionType>('Multiple Choice')
  const [qOptA, setQOptA] = useState<string>('')
  const [qOptB, setQOptB] = useState<string>('')
  const [qOptC, setQOptC] = useState<string>('')
  const [qOptD, setQOptD] = useState<string>('')
  const [qCorrectAnswer, setQCorrectAnswer] = useState<string>('A')
  const [qMarks, setQMarks] = useState<number>(2)

  // Assessment Settings
  const [passingScore, setPassingScore] = useState<number>(50)
  const [shuffleQuestions, setShuffleQuestions] = useState<boolean>(false)
  const [showResultsAfterSubmission, setShowResultsAfterSubmission] = useState<boolean>(true)
  const [allowRetake, setAllowRetake] = useState<boolean>(false)

  // Status
  const [status, setStatus] = useState<AssessmentStatus>('Draft')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState<boolean>(false)

  // Fetch real cohorts from database if connected
  useEffect(() => {
    async function loadDbCohorts() {
      try {
        const list = await getAllCohorts()
        if (list && list.length > 0) {
          const mapped: CohortOption[] = list.map((c) => ({
            id: c.id,
            name: c.name,
            course_id: c.course_id,
            course_name: c.course_name,
          }))
          setCohorts(mapped)
          if (!mapped.some((m) => m.id === selectedCohortId)) {
            setSelectedCohortId(initialCohortId && mapped.some((m) => m.id === initialCohortId) ? initialCohortId : '')
          }
        } else {
          setCohorts([])
          setSelectedCohortId('')
        }
      } catch {
        // Fallback already populated
      }
    }
    loadDbCohorts()
  }, [])

  // Currently selected cohort & auto-derived course
  const currentCohort = cohorts.find((c) => c.id === selectedCohortId)
  const courseName = currentCohort?.course_name || ''

  // Total Marks: Automatically calculated from the marks assigned to all questions!
  const calculatedTotalMarks = questions.reduce((acc, q) => acc + (q.marks || 0), 0)

  // Start adding a new question
  const handleOpenAddQuestion = () => {
    setEditingQuestionId(null)
    setQText('')
    setQType('Multiple Choice')
    setQOptA('')
    setQOptB('')
    setQOptC('')
    setQOptD('')
    setQCorrectAnswer('A')
    setQMarks(2)
    setShowQuestionForm(true)
  }

  // Edit existing question
  const handleEditQuestion = (question: AssessmentQuestion) => {
    setEditingQuestionId(question.id)
    setQText(question.question_text)
    setQType(question.question_type)
    if (question.question_type === 'Multiple Choice' && question.options) {
      setQOptA(question.options.find((o) => o.key === 'A')?.text || '')
      setQOptB(question.options.find((o) => o.key === 'B')?.text || '')
      setQOptC(question.options.find((o) => o.key === 'C')?.text || '')
      setQOptD(question.options.find((o) => o.key === 'D')?.text || '')
      setQCorrectAnswer(question.correct_answer || 'A')
    } else if (question.question_type === 'True/False') {
      setQCorrectAnswer(question.correct_answer || 'True')
    }
    setQMarks(question.marks)
    setShowQuestionForm(true)
  }

  // Delete question
  const handleDeleteQuestion = (questionId: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== questionId))
    if (editingQuestionId === questionId) {
      setShowQuestionForm(false)
      setEditingQuestionId(null)
    }
  }

  // Save question from sub-form
  const handleSaveQuestion = (e: React.FormEvent) => {
    e.preventDefault()
    if (!qText.trim()) {
      alert('Please enter the question text.')
      return
    }

    let options = undefined
    if (qType === 'Multiple Choice') {
      if (!qOptA.trim() || !qOptB.trim()) {
        alert('Please provide at least Option A and Option B.')
        return
      }
      options = [
        { key: 'A' as const, text: qOptA.trim() },
        { key: 'B' as const, text: qOptB.trim() },
        { key: 'C' as const, text: qOptC.trim() || 'None of the above' },
        { key: 'D' as const, text: qOptD.trim() || 'All of the above' },
      ]
    } else if (qType === 'True/False') {
      options = [
        { key: 'A' as const, text: 'True' },
        { key: 'B' as const, text: 'False' },
      ]
    }

    if (editingQuestionId) {
      // Update
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === editingQuestionId
            ? {
                ...q,
                question_text: qText.trim(),
                question_type: qType,
                options,
                correct_answer: qCorrectAnswer,
                marks: Number(qMarks) || 1,
              }
            : q
        )
      )
    } else {
      // Add new
      const newQuestion: AssessmentQuestion = {
        id: `q-custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        question_text: qText.trim(),
        question_type: qType,
        options,
        correct_answer: qCorrectAnswer,
        marks: Number(qMarks) || 1,
      }
      setQuestions((prev) => [...prev, newQuestion])
    }

    setShowQuestionForm(false)
    setEditingQuestionId(null)
  }

  // Save / Publish
  const handleSave = async (explicitStatus?: AssessmentStatus) => {
    if (!currentCohort) {
      setErrorMessage('Create and select a cohort before adding an assessment.')
      return
    }
    if (!title.trim()) {
      setErrorMessage('Assessment Title is required.')
      return
    }
    if (questions.length === 0) {
      setErrorMessage('Please add at least one question to the assessment.')
      return
    }

    const finalStatus: AssessmentStatus = explicitStatus || status
    setSaving(true)
    setErrorMessage(null)

    const finalAssessment: Assessment = {
      id: `asmt-${Date.now()}`,
      cohort_id: currentCohort.id,
      cohort_name: currentCohort.name,
      course_id: currentCohort.course_id,
      course_name: currentCohort.course_name,
      training_week: Number(trainingWeek),
      title: title.trim(),
      description: description.trim(),
      assessment_type: assessmentType,
      instructions: instructions.trim(),
      start_date: startDate,
      start_time: startTime,
      end_date: endDate,
      time_limit_minutes: Number(timeLimitMinutes) || 60,
      questions,
      total_marks: calculatedTotalMarks,
      settings: {
        passing_score: Number(passingScore) || 50,
        shuffle_questions: shuffleQuestions,
        show_results_after_submission: showResultsAfterSubmission,
        allow_retake: allowRetake,
      },
      status: finalStatus,
      created_at: new Date().toISOString(),
    }

    try {
      // Attempt supabase insert if schema exists
      await supabase.from('assessments').insert({
        cohort_id: finalAssessment.cohort_id,
        title: finalAssessment.title,
        description: finalAssessment.description,
        maximum_score: finalAssessment.total_marks,
      })
    } catch {
      // ignore
    }

    setSaving(false)
    onCreated(finalAssessment)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative my-8 w-full max-w-3xl rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-line)] px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-[var(--color-ink-900)]">
              Add Assessment
            </h2>
            <p className="text-xs text-[var(--color-ink-500)]">
              Configure assessment parameters, schedule, questions, and scoring.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--radius-md)] p-1 text-[var(--color-ink-400)] hover:bg-[var(--color-paper)] hover:text-[var(--color-ink-700)]"
          >
            <X size={20} />
          </button>
        </div>

        {errorMessage && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-danger-50)] border border-[var(--color-danger-200)] p-3 text-sm text-[var(--color-danger-700)]">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="max-h-[75vh] overflow-y-auto px-6 py-5 space-y-6">
          {/* SECTION 1: Assessment Setup */}
          <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-paper)] p-4">
            <h3 className="text-sm font-semibold text-[var(--color-ink-900)] mb-3 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-harbor-100)] text-xs text-[var(--color-harbor-700)] font-bold">
                1
              </span>
              Assessment Setup
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink-700)] mb-1">
                  Select Cohort*
                </label>
                <select
                  value={selectedCohortId}
                  onChange={(e) => setSelectedCohortId(e.target.value)}
                  disabled={cohorts.length === 0}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm font-medium text-[var(--color-ink-900)] focus:border-[var(--color-harbor-500)] focus:outline-hidden"
                >
                  <option value="">{cohorts.length === 0 ? 'No cohorts available' : 'Select a cohort'}</option>
                  {cohorts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink-700)] mb-1">
                  Course
                </label>
                <div className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-ink-50)] px-3 py-2 text-sm font-semibold text-[var(--color-harbor-700)]">
                  {courseName || '—'}
                </div>
                <p className="mt-1 text-[11px] text-[var(--color-ink-400)] italic">
                  Automatically displayed and cannot be manually changed.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink-700)] mb-1">
                  Training Week*
                </label>
                <select
                  value={trainingWeek}
                  onChange={(e) => setTrainingWeek(Number(e.target.value))}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm font-medium text-[var(--color-ink-900)] focus:border-[var(--color-harbor-500)] focus:outline-hidden"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((w) => (
                    <option key={w} value={w}>
                      Week {w}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 2: Assessment Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[var(--color-ink-900)] flex items-center gap-2 border-b border-[var(--color-line)] pb-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-harbor-100)] text-xs text-[var(--color-harbor-700)] font-bold">
                2
              </span>
              Assessment Information
            </h3>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink-700)] mb-1">
                Assessment Title*
              </label>
              <input
                type="text"
                required
                placeholder="Enter assessment title (e.g. Cybersecurity Fundamentals Assessment)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-ink-900)] focus:border-[var(--color-harbor-500)] focus:outline-hidden"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink-700)] mb-1">
                  Assessment Type*
                </label>
                <select
                  value={assessmentType}
                  onChange={(e) =>
                    setAssessmentType(e.target.value as AssessmentType)
                  }
                  className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-ink-900)] focus:border-[var(--color-harbor-500)] focus:outline-hidden"
                >
                  {ASSESSMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink-700)] mb-1">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="Describe what the assessment covers"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-ink-900)] focus:border-[var(--color-harbor-500)] focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink-700)] mb-1">
                Instructions
              </label>
              <textarea
                rows={2}
                placeholder="Enter instructions for students (e.g. Please answer all questions carefully within the time limit...)"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-ink-900)] focus:border-[var(--color-harbor-500)] focus:outline-hidden"
              />
            </div>
          </div>

          {/* SECTION 3: Assessment Schedule */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[var(--color-ink-900)] flex items-center gap-2 border-b border-[var(--color-line)] pb-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-harbor-100)] text-xs text-[var(--color-harbor-700)] font-bold">
                3
              </span>
              Assessment Schedule
            </h3>

            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink-700)] mb-1">
                  Start Date*
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-ink-900)] focus:border-[var(--color-harbor-500)] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink-700)] mb-1">
                  Start Time*
                </label>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-ink-900)] focus:border-[var(--color-harbor-500)] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink-700)] mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-ink-900)] focus:border-[var(--color-harbor-500)] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink-700)] mb-1">
                  Time Limit (Minutes)
                </label>
                <input
                  type="number"
                  min="5"
                  max="300"
                  value={timeLimitMinutes}
                  onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
                  placeholder="e.g. 60"
                  className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-ink-900)] focus:border-[var(--color-harbor-500)] focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: Questions Builder */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-2">
              <h3 className="text-sm font-semibold text-[var(--color-ink-900)] flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-harbor-100)] text-xs text-[var(--color-harbor-700)] font-bold">
                  4
                </span>
                Questions ({questions.length})
              </h3>
              <button
                type="button"
                onClick={handleOpenAddQuestion}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-50)] border border-[var(--color-harbor-200)] px-3 py-1.5 text-xs font-semibold text-[var(--color-harbor-700)] hover:bg-[var(--color-harbor-100)]"
              >
                <Plus size={14} /> Add Question
              </button>
            </div>

            {/* Interactive Question Creation Sub-form */}
            {showQuestionForm && (
              <div className="rounded-[var(--radius-lg)] border-2 border-[var(--color-harbor-300)] bg-[var(--color-paper)] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-harbor-700)]">
                    {editingQuestionId ? 'Edit Question' : 'New Question Form'}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowQuestionForm(false)}
                    className="text-xs text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)]"
                  >
                    Cancel
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--color-ink-700)] mb-1">
                    Question Text*
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Enter question text..."
                    value={qText}
                    onChange={(e) => setQText(e.target.value)}
                    className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm text-[var(--color-ink-900)] focus:border-[var(--color-harbor-500)] focus:outline-hidden"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-ink-700)] mb-1">
                      Question Type
                    </label>
                    <select
                      value={qType}
                      onChange={(e) =>
                        setQType(e.target.value as QuestionType)
                      }
                      className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm text-[var(--color-ink-900)] focus:border-[var(--color-harbor-500)] focus:outline-hidden"
                    >
                      {QUESTION_TYPES.map((qt) => (
                        <option key={qt} value={qt}>
                          {qt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-ink-700)] mb-1">
                      Marks
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={qMarks}
                      onChange={(e) => setQMarks(Number(e.target.value))}
                      className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm text-[var(--color-ink-900)] focus:border-[var(--color-harbor-500)] focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Multiple Choice Options */}
                {qType === 'Multiple Choice' && (
                  <div className="space-y-2 pt-2 border-t border-[var(--color-line)]">
                    <p className="text-xs font-medium text-[var(--color-ink-600)]">
                      Multiple Choice Options:
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <span className="text-[11px] font-bold text-[var(--color-ink-500)]">
                          Option A*
                        </span>
                        <input
                          type="text"
                          placeholder="Enter option A"
                          value={qOptA}
                          onChange={(e) => setQOptA(e.target.value)}
                          className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-xs text-[var(--color-ink-900)]"
                        />
                      </div>
                      <div>
                        <span className="text-[11px] font-bold text-[var(--color-ink-500)]">
                          Option B*
                        </span>
                        <input
                          type="text"
                          placeholder="Enter option B"
                          value={qOptB}
                          onChange={(e) => setQOptB(e.target.value)}
                          className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-xs text-[var(--color-ink-900)]"
                        />
                      </div>
                      <div>
                        <span className="text-[11px] font-bold text-[var(--color-ink-500)]">
                          Option C
                        </span>
                        <input
                          type="text"
                          placeholder="Enter option C"
                          value={qOptC}
                          onChange={(e) => setQOptC(e.target.value)}
                          className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-xs text-[var(--color-ink-900)]"
                        />
                      </div>
                      <div>
                        <span className="text-[11px] font-bold text-[var(--color-ink-500)]">
                          Option D
                        </span>
                        <input
                          type="text"
                          placeholder="Enter option D"
                          value={qOptD}
                          onChange={(e) => setQOptD(e.target.value)}
                          className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-xs text-[var(--color-ink-900)]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--color-ink-700)] mb-1">
                        Correct Answer
                      </label>
                      <select
                        value={qCorrectAnswer}
                        onChange={(e) => setQCorrectAnswer(e.target.value)}
                        className="w-full max-w-xs rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3 py-1.5 text-xs text-[var(--color-ink-900)]"
                      >
                        <option value="A">Option A</option>
                        <option value="B">Option B</option>
                        <option value="C">Option C</option>
                        <option value="D">Option D</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* True / False Options */}
                {qType === 'True/False' && (
                  <div className="pt-2 border-t border-[var(--color-line)]">
                    <label className="block text-xs font-semibold text-[var(--color-ink-700)] mb-1">
                      Correct Answer
                    </label>
                    <select
                      value={qCorrectAnswer}
                      onChange={(e) => setQCorrectAnswer(e.target.value)}
                      className="w-full max-w-xs rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3 py-1.5 text-xs text-[var(--color-ink-900)]"
                    >
                      <option value="A">True</option>
                      <option value="B">False</option>
                    </select>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowQuestionForm(false)}
                    className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--color-ink-700)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveQuestion}
                    className="rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-harbor-600)]"
                  >
                    {editingQuestionId ? 'Update Question' : 'Save Question'}
                  </button>
                </div>
              </div>
            )}

            {/* Questions List (Numbered Cards) */}
            <div className="space-y-2.5">
              {questions.map((q, idx) => (
                <div
                  key={q.id}
                  className="flex items-start justify-between rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-3.5 hover:border-[var(--color-harbor-200)] transition-colors"
                >
                  <div className="space-y-1 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[var(--color-harbor-700)]">
                        Question {idx + 1}
                      </span>
                      <span className="rounded-[var(--radius-sm)] bg-[var(--color-ink-100)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-ink-600)]">
                        {q.question_type}
                      </span>
                      <span className="rounded-[var(--radius-sm)] bg-[var(--color-success-50)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-success-700)]">
                        Marks: {q.marks}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-[var(--color-ink-900)]">
                      {q.question_text}
                    </p>
                    {q.options && q.options.length > 0 && (
                      <div className="flex flex-wrap gap-2 text-xs text-[var(--color-ink-500)] pt-1">
                        {q.options.map((opt) => (
                          <span
                            key={opt.key}
                            className={`rounded px-1.5 py-0.5 ${
                              opt.key === q.correct_answer
                                ? 'bg-[var(--color-success-50)] text-[var(--color-success-700)] font-semibold'
                                : 'bg-[var(--color-ink-50)] text-[var(--color-ink-600)]'
                            }`}
                          >
                            {opt.key}: {opt.text}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleEditQuestion(q)}
                      className="rounded p-1 text-[var(--color-ink-500)] hover:bg-[var(--color-paper)] hover:text-[var(--color-ink-800)]"
                      title="Edit question"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="rounded p-1 text-[var(--color-danger-500)] hover:bg-[var(--color-danger-50)]"
                      title="Delete question"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 5: Assessment Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[var(--color-ink-900)] flex items-center gap-2 border-b border-[var(--color-line)] pb-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-harbor-100)] text-xs text-[var(--color-harbor-700)] font-bold">
                5
              </span>
              Assessment Settings
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-paper)] p-3">
                <span className="block text-xs font-semibold text-[var(--color-ink-700)]">
                  Total Marks
                </span>
                <span className="text-xl font-bold text-[var(--color-harbor-700)]">
                  {calculatedTotalMarks} Marks
                </span>
                <p className="text-[11px] text-[var(--color-ink-400)]">
                  Automatically calculated from the marks assigned to all questions.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink-700)] mb-1">
                  Passing Score (%)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="10"
                    max="100"
                    value={passingScore}
                    onChange={(e) => setPassingScore(Number(e.target.value))}
                    className="w-28 rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-ink-900)] focus:border-[var(--color-harbor-500)] focus:outline-hidden"
                  />
                  <span className="text-xs font-semibold text-[var(--color-ink-600)]">
                    (Passing Score: {passingScore}%)
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 pt-2">
              <label className="flex items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--color-line)] p-3 cursor-pointer hover:bg-[var(--color-paper)]">
                <input
                  type="checkbox"
                  checked={shuffleQuestions}
                  onChange={(e) => setShuffleQuestions(e.target.checked)}
                  className="rounded text-[var(--color-harbor-600)] focus:ring-[var(--color-harbor-500)]"
                />
                <div>
                  <span className="block text-xs font-semibold text-[var(--color-ink-900)]">
                    Shuffle Questions
                  </span>
                  <span className="text-[11px] text-[var(--color-ink-400)]">
                    Randomize question order
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--color-line)] p-3 cursor-pointer hover:bg-[var(--color-paper)]">
                <input
                  type="checkbox"
                  checked={showResultsAfterSubmission}
                  onChange={(e) =>
                    setShowResultsAfterSubmission(e.target.checked)
                  }
                  className="rounded text-[var(--color-harbor-600)] focus:ring-[var(--color-harbor-500)]"
                />
                <div>
                  <span className="block text-xs font-semibold text-[var(--color-ink-900)]">
                    Show Results
                  </span>
                  <span className="text-[11px] text-[var(--color-ink-400)]">
                    Display score immediately
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--color-line)] p-3 cursor-pointer hover:bg-[var(--color-paper)]">
                <input
                  type="checkbox"
                  checked={allowRetake}
                  onChange={(e) => setAllowRetake(e.target.checked)}
                  className="rounded text-[var(--color-harbor-600)] focus:ring-[var(--color-harbor-500)]"
                />
                <div>
                  <span className="block text-xs font-semibold text-[var(--color-ink-900)]">
                    Allow Retake
                  </span>
                  <span className="text-[11px] text-[var(--color-ink-400)]">
                    Students can reattempt
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* SECTION 6: Assessment Status */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-[var(--color-ink-900)] flex items-center gap-2 border-b border-[var(--color-line)] pb-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-harbor-100)] text-xs text-[var(--color-harbor-700)] font-bold">
                6
              </span>
              Assessment Status
            </h3>

            <div className="w-full max-w-xs">
              <label className="block text-xs font-semibold text-[var(--color-ink-700)] mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AssessmentStatus)}
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm text-[var(--color-ink-900)] focus:border-[var(--color-harbor-500)] focus:outline-hidden"
              >
                <option value="Draft">Draft (Hidden from students)</option>
                <option value="Published">Published (Active for cohort)</option>
                <option value="Closed">Closed (No new attempts allowed)</option>
              </select>
              <p className="mt-1 text-[11px] text-[var(--color-ink-400)]">
                A new assessment is initially configured as Draft.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer / Actions */}
        <div className="flex items-center justify-between border-t border-[var(--color-line)] bg-[var(--color-paper)] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-4 py-2 text-sm font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-paper)]"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave('Draft')}
              className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-ink-800)] hover:bg-[var(--color-ink-50)] disabled:opacity-50"
            >
              Save Draft
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave('Published')}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-harbor-600)] shadow-xs disabled:opacity-50"
            >
              <Check size={16} />
              {saving ? 'Creating…' : 'Create & Publish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
