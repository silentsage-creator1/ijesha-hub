import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  UploadCloud,
  File,
  Trash2,
  Download,
  Eye,
  GraduationCap,
  BookOpen,
  Layers,
  Award,
  Lock,
  RotateCcw,
  Sparkles,
  Check,
  AlertCircle,
} from 'lucide-react'
import { Card } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/app/auth'
import {
  getStoredClasswork,
  getStudentSubmission,
  saveOrUpdateStudentSubmission,
  computeStudentClassworkStatus,
  formatDueDate,
  type ClassworkItem,
  type StudentSubmission,
  type UploadedFileItem,
  type ClassworkResource,
  type StudentClassworkStatus,
} from '@/lib/classwork'

export function ClassworkDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { profile, session, role } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isStaff = ['admin', 'manager', 'trainer'].includes(role ?? '')
  const isParent = role === 'parent'
  const currentStudentId = profile?.id || session?.user?.id || ''
  const currentStudentName = profile?.full_name || session?.user?.email?.split('@')[0] || 'Student'
  const currentStudentEmail = session?.user?.email || profile?.organization || ''

  const [classwork, setClasswork] = useState<ClassworkItem | null>(null)
  const [submission, setSubmission] = useState<StudentSubmission | null>(null)

  // Working state for response
  const [responseText, setResponseText] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([])
  const [isEditing, setIsEditing] = useState(true)

  // Modals & Notifications
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [viewingResource, setViewingResource] = useState<ClassworkResource | null>(null)
  const [saveToast, setSaveToast] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Staff grading controls (for testing and staff review)
  const [showGradeModal, setShowGradeModal] = useState(false)
  const [gradeScore, setGradeScore] = useState<number>(90)
  const [gradeFeedback, setGradeFeedback] = useState('')
  const [gradeAreasForImprovement, setGradeAreasForImprovement] = useState('')
  const [gradeAllowResubmission, setGradeAllowResubmission] = useState(true)

  // Load Classwork & Student Submission
  useEffect(() => {
    if (!id) return
    const all = getStoredClasswork()
    const found = all.find((item) => item.id === id) || all[0]
    setClasswork(found)

    if (found && currentStudentId) {
      const sub = getStudentSubmission(found.id, currentStudentId)
      setSubmission(sub)
      if (sub) {
        setResponseText(sub.response_text || '')
        setUploadedFiles(sub.uploaded_files || [])
        // If parent, or submitted or completed, lock editing
        if (role === 'parent' || sub.status === 'Submitted' || sub.status === 'Graded') {
          setIsEditing(false)
        } else {
          setIsEditing(true)
        }
      } else {
        setResponseText('')
        setUploadedFiles([])
        setIsEditing(role !== 'parent')
      }
    }
  }, [id, currentStudentId, role])

  // Computed Status
  const currentStatus: StudentClassworkStatus = useMemo(() => {
    if (!classwork) return 'To Do'
    return computeStudentClassworkStatus(classwork, submission)
  }, [classwork, submission])

  // Handle Save Draft
  const handleSaveDraft = () => {
    if (!classwork || !currentStudentId) return

    const now = new Date().toISOString()
    const updatedSub: StudentSubmission = {
      id: submission?.id || `sub-${Date.now()}`,
      classwork_id: classwork.id,
      student_id: currentStudentId,
      student_name: currentStudentName,
      student_email: currentStudentEmail,
      status: 'Draft',
      response_text: responseText,
      uploaded_files: uploadedFiles,
      saved_at: now,
      submitted_at: submission?.submitted_at || null,
      graded_at: submission?.graded_at || null,
      graded_by: submission?.graded_by || null,
      score: submission?.score ?? null,
      feedback: submission?.feedback || null,
      areas_for_improvement: submission?.areas_for_improvement || null,
      resubmission_permitted: submission?.resubmission_permitted ?? classwork.allow_resubmission,
      resubmission_count: submission?.resubmission_count || 0,
    }

    saveOrUpdateStudentSubmission(updatedSub)
    setSubmission(updatedSub)
    showNotification('Draft saved successfully! You can return and continue anytime.')
  }

  // Handle Final Submit
  const handleConfirmSubmit = () => {
    if (!classwork || !currentStudentId) return

    setIsSubmitting(true)
    const now = new Date().toISOString()

    const updatedSub: StudentSubmission = {
      id: submission?.id || `sub-${Date.now()}`,
      classwork_id: classwork.id,
      student_id: currentStudentId,
      student_name: currentStudentName,
      student_email: currentStudentEmail,
      status: 'Submitted',
      response_text: responseText,
      uploaded_files: uploadedFiles,
      saved_at: now,
      submitted_at: now,
      graded_at: submission?.score ? submission.graded_at : null,
      graded_by: submission?.score ? submission.graded_by : null,
      score: submission?.score ? null : null, // Reset score if resubmitted
      feedback: submission?.score ? null : null,
      areas_for_improvement: null,
      resubmission_permitted: classwork.allow_resubmission,
      resubmission_count: (submission?.resubmission_count || 0) + 1,
    }

    saveOrUpdateStudentSubmission(updatedSub)
    setSubmission(updatedSub)
    setIsEditing(false)
    setShowSubmitModal(false)
    setIsSubmitting(false)
    showNotification('Classwork submitted successfully to your trainer!')
  }

  // Handle Resubmit trigger
  const handleStartResubmit = () => {
    setIsEditing(true)
    showNotification('Editing unlocked. Update your response or files and submit when ready.')
  }

  // Staff Grading
  const handleSaveGrade = () => {
    if (!classwork || !submission) return

    const now = new Date().toISOString()
    const updatedSub: StudentSubmission = {
      ...submission,
      status: 'Graded',
      score: gradeScore,
      feedback: gradeFeedback.trim() || 'Well executed submission that meets the technical requirements.',
      areas_for_improvement: gradeAreasForImprovement.trim() || 'Continue focusing on responsive edge cases and error boundary fallbacks.',
      graded_at: now,
      graded_by: profile?.full_name || 'Assigned Trainer',
      resubmission_permitted: gradeAllowResubmission,
    }

    saveOrUpdateStudentSubmission(updatedSub)
    setSubmission(updatedSub)
    setShowGradeModal(false)
    showNotification('Grade and feedback published to student record.')
  }

  // File Upload Helper
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const newFiles: UploadedFileItem[] = Array.from(files).map((f) => {
      const sizeStr =
        f.size > 1024 * 1024
          ? `${(f.size / (1024 * 1024)).toFixed(1)} MB`
          : `${Math.round(f.size / 1024)} KB`

      return {
        id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: f.name,
        size: sizeStr,
        type: f.type || 'Document File',
        uploaded_at: new Date().toISOString(),
      }
    })

    setUploadedFiles((prev) => [...prev, ...newFiles])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemoveFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId))
  }

  // Download simulation
  const handleDownloadResource = (res: ClassworkResource) => {
    const element = document.createElement('a')
    const fileContent = res.content || `Resource: ${res.name}\nSize: ${res.size}\nType: ${res.type}\nTraining Material provided by Ijesha Digital Hub.`
    const file = new Blob([fileContent], { type: 'text/plain;charset=utf-8' })
    element.href = URL.createObjectURL(file)
    element.download = res.name.endsWith('.pdf') || res.name.endsWith('.zip') || res.name.endsWith('.png') ? res.name : `${res.name}.txt`
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
    showNotification(`Downloaded ${res.name}`)
  }

  const showNotification = (msg: string) => {
    setSaveToast(msg)
    setTimeout(() => {
      setSaveToast(null)
    }, 4500)
  }

  if (!classwork) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-[var(--color-ink-500)]">Loading classwork details…</p>
        <Link
          to="/classwork"
          className="mt-2 inline-block text-xs font-semibold text-[var(--color-harbor-600)] hover:underline"
        >
          Return to Classwork list
        </Link>
      </div>
    )
  }

  const statusBadge = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
        currentStatus === 'Completed'
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          : currentStatus === 'Submitted'
          ? 'bg-amber-50 text-amber-700 border border-amber-200'
          : currentStatus === 'In Progress'
          ? 'bg-blue-50 text-blue-700 border border-blue-200'
          : currentStatus === 'Overdue'
          ? 'bg-red-50 text-red-700 border border-red-200'
          : 'bg-[var(--color-ink-100)] text-[var(--color-ink-700)]'
      }`}
    >
      {currentStatus === 'Completed' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
      {currentStatus === 'Submitted' && <Clock className="h-3.5 w-3.5 text-amber-600" />}
      {currentStatus === 'In Progress' && <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />}
      {currentStatus === 'Overdue' && <AlertTriangle className="h-3.5 w-3.5 text-red-600" />}
      {currentStatus === 'To Do' && <span className="h-2 w-2 rounded-full bg-[var(--color-ink-400)]" />}
      {currentStatus}
    </span>
  )

  const showTextSubmission = classwork.submission_method === 'Text' || classwork.submission_method === 'Both'
  const showFileSubmission = classwork.submission_method === 'File' || classwork.submission_method === 'Both'

  return (
    <div className="space-y-6 pb-12">
      {/* Toast banner notification */}
      {saveToast && (
        <div className="sticky top-4 z-40 flex items-center justify-between rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-900 shadow-md">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{saveToast}</span>
          </div>
          <button
            onClick={() => setSaveToast(null)}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-950"
          >
            ✕
          </button>
        </div>
      )}

      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/classwork"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-ink-600)] hover:text-[var(--color-ink-900)] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Classwork
        </Link>

        {/* Staff Grading action (if trainer / admin) */}
        {isStaff && (
          <button
            onClick={() => {
              if (submission?.score) setGradeScore(submission.score)
              if (submission?.feedback) setGradeFeedback(submission.feedback)
              if (submission?.areas_for_improvement) setGradeAreasForImprovement(submission.areas_for_improvement)
              setShowGradeModal(true)
            }}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-harbor-500)] bg-[var(--color-harbor-50)] px-3 py-1.5 text-xs font-semibold text-[var(--color-harbor-700)] hover:bg-[var(--color-harbor-100)]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {submission?.score !== null && submission?.score !== undefined ? 'Update Grade & Feedback' : 'Grade Student Submission'}
          </button>
        )}
      </div>

      {/* 1. Classwork Information Card */}
      <Card className="p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded bg-[var(--color-ink-100)] px-2.5 py-1 text-xs font-medium text-[var(--color-ink-800)]">
                <BookOpen className="h-3.5 w-3.5 text-[var(--color-ink-500)]" />
                {classwork.course_name}
              </span>
              <span className="inline-flex items-center gap-1 rounded bg-[var(--color-ink-50)] px-2.5 py-1 text-xs font-medium text-[var(--color-ink-700)] border border-[var(--color-line)]">
                <Layers className="h-3.5 w-3.5 text-[var(--color-ink-400)]" />
                {classwork.cohort_name}
              </span>
              {statusBadge}
            </div>

            <h1 className="font-display text-xl font-bold text-[var(--color-ink-900)] sm:text-2xl">
              {classwork.title}
            </h1>

            <div className="grid grid-cols-2 gap-3 pt-2 text-xs text-[var(--color-ink-600)] sm:grid-cols-4 border-t border-[var(--color-line)]">
              <div>
                <span className="block text-[11px] text-[var(--color-ink-400)]">Assigned Trainer</span>
                <strong className="font-semibold text-[var(--color-ink-800)] flex items-center gap-1 mt-0.5">
                  <GraduationCap className="h-3.5 w-3.5 text-[var(--color-ink-400)]" />
                  {classwork.trainer_name}
                </strong>
              </div>
              <div>
                <span className="block text-[11px] text-[var(--color-ink-400)]">Assigned Date</span>
                <strong className="font-semibold text-[var(--color-ink-800)] flex items-center gap-1 mt-0.5">
                  <Calendar className="h-3.5 w-3.5 text-[var(--color-ink-400)]" />
                  {formatDueDate(classwork.assigned_date)}
                </strong>
              </div>
              <div>
                <span className="block text-[11px] text-[var(--color-ink-400)]">Due Date</span>
                <strong className={`font-semibold flex items-center gap-1 mt-0.5 ${currentStatus === 'Overdue' ? 'text-red-600' : 'text-[var(--color-ink-800)]'}`}>
                  <Clock className="h-3.5 w-3.5 text-[var(--color-ink-400)]" />
                  {formatDueDate(classwork.due_date)}
                </strong>
              </div>
              <div>
                <span className="block text-[11px] text-[var(--color-ink-400)]">Maximum Marks</span>
                <strong className="font-semibold text-[var(--color-ink-800)] flex items-center gap-1 mt-0.5">
                  <Award className="h-3.5 w-3.5 text-[var(--color-ink-400)]" />
                  {classwork.maximum_marks} Marks
                </strong>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 2. Instructions Section */}
      <Card className="p-6">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-[var(--color-ink-500)] mb-3">
          Instructions & Deliverables
        </h2>
        <div className="prose prose-sm max-w-none text-xs leading-relaxed text-[var(--color-ink-800)] whitespace-pre-line">
          {classwork.instructions}
        </div>
      </Card>

      {/* 3. Resources Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-[var(--color-ink-500)]">
            Learning Resources & Attachments ({classwork.resources.length})
          </h2>
          <span className="text-[11px] text-[var(--color-ink-400)]">
            Provided by {classwork.trainer_name}
          </span>
        </div>

        {classwork.resources.length === 0 ? (
          <p className="text-xs text-[var(--color-ink-500)]">No resource attachments provided.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {classwork.resources.map((res) => (
              <div
                key={res.id}
                className="flex items-center justify-between rounded-lg border border-[var(--color-line)] bg-[var(--color-ink-50)]/50 p-3"
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-[var(--color-harbor-600)] border border-[var(--color-line)]">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[var(--color-ink-900)]">
                      {res.name}
                    </p>
                    <p className="text-[11px] text-[var(--color-ink-400)]">
                      {res.type} • {res.size}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setViewingResource(res)}
                    className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-[var(--color-ink-700)] hover:bg-white border border-transparent hover:border-[var(--color-line)] transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View
                  </button>
                  <button
                    onClick={() => handleDownloadResource(res)}
                    className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-[var(--color-harbor-700)] hover:bg-[var(--color-harbor-100)] transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 7 & 8. Grading and Feedback Section (Visible if Graded) */}
      {submission && submission.status === 'Graded' && submission.score !== null && (
        <Card className="border-emerald-200 bg-emerald-50/30 p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Graded & Reviewed
              </span>
              <h2 className="font-display text-lg font-bold text-[var(--color-ink-900)]">
                Performance Evaluation & Trainer Feedback
              </h2>
              <p className="text-xs text-[var(--color-ink-500)]">
                Graded on {formatDueDate(submission.graded_at || '')} by {submission.graded_by || classwork.trainer_name}
              </p>
            </div>

            <div className="text-right">
              <span className="text-[11px] uppercase tracking-wider text-[var(--color-ink-500)] font-medium">Final Score</span>
              <div className="font-display text-2xl font-black text-emerald-700">
                {submission.score} <span className="text-sm font-normal text-[var(--color-ink-500)]">/ {classwork.maximum_marks}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-3 pt-3 border-t border-emerald-200/60 text-xs">
            {/* Trainer Feedback */}
            <div>
              <h3 className="font-semibold text-[var(--color-ink-900)]">Trainer Feedback:</h3>
              <p className="mt-1 text-[var(--color-ink-700)] leading-relaxed bg-white/70 p-3 rounded-md border border-emerald-100">
                {submission.feedback || 'No written comments provided.'}
              </p>
            </div>

            {/* Areas for Improvement */}
            {submission.areas_for_improvement && (
              <div>
                <h3 className="font-semibold text-[var(--color-ink-900)]">Areas for Improvement:</h3>
                <p className="mt-1 text-[var(--color-ink-700)] leading-relaxed bg-white/70 p-3 rounded-md border border-emerald-100">
                  {submission.areas_for_improvement}
                </p>
              </div>
            )}

            {/* Resubmission info */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <div className="text-[11px] text-[var(--color-ink-500)]">
                {submission.resubmission_permitted ? (
                  <span className="text-emerald-700 font-medium">
                    ✓ Resubmission is permitted by your trainer if you wish to improve your work.
                  </span>
                ) : (
                  <span className="text-[var(--color-ink-500)]">
                    Resubmission is closed for this task.
                  </span>
                )}
              </div>

              {submission.resubmission_permitted && (
                <button
                  onClick={handleStartResubmit}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-harbor-700)] border border-[var(--color-harbor-300)] shadow-xs hover:bg-[var(--color-harbor-50)]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Resubmit Classwork
                </button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* 4, 5, 6. Student Submission Area */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-[var(--color-line)] gap-2">
          <div>
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-[var(--color-ink-700)] flex items-center gap-2">
              {isParent ? 'Guardian View · Student Submission' : 'Student Submission'}
              {!isEditing && (
                <span className="inline-flex items-center gap-1 rounded bg-[var(--color-ink-100)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-ink-600)]">
                  <Lock className="h-2.5 w-2.5" /> Locked
                </span>
              )}
            </h2>
            <p className="text-xs text-[var(--color-ink-500)] mt-0.5">
              {isEditing
                ? `Submission method: ${classwork.submission_method}`
                : submission?.submitted_at
                ? `Submitted on ${new Date(submission.submitted_at).toLocaleString()}`
                : 'Locked'}
            </p>
          </div>

          {/* Resubmit toggle if locked but allowed */}
          {!isEditing && submission && submission.resubmission_permitted && !isParent && !isStaff && (
            <button
              onClick={handleStartResubmit}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]"
            >
              <RotateCcw className="h-3 w-3" />
              Unlock to Edit / Resubmit
            </button>
          )}
        </div>

        <div className="space-y-5 pt-4">
          {/* Text Submission Editor */}
          {showTextSubmission && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[var(--color-ink-800)]">
                  Written Response / Explanation
                </label>
                {isEditing && (
                  <span className="text-[11px] text-[var(--color-ink-400)]">
                    {responseText.length} characters
                  </span>
                )}
              </div>
              {isEditing ? (
                <textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="Enter your comprehensive response, architectural summary, or solution notes here…"
                  rows={6}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] p-3 text-xs text-[var(--color-ink-900)] placeholder-[var(--color-ink-400)] focus:border-[var(--color-harbor-500)] focus:outline-none focus:ring-1 focus:ring-[var(--color-harbor-500)] leading-relaxed font-sans"
                />
              ) : (
                <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-ink-50)]/60 p-4 text-xs text-[var(--color-ink-800)] whitespace-pre-line leading-relaxed">
                  {responseText.trim() || 'No written response provided.'}
                </div>
              )}
            </div>
          )}

          {/* File Submission Area */}
          {showFileSubmission && (
            <div className="space-y-3">
              <label className="text-xs font-semibold text-[var(--color-ink-800)] block">
                Attached Files & Deliverables
              </label>

              {/* Upload Dropzone (if editing) */}
              {isEditing && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--color-line)] bg-[var(--color-ink-50)]/40 p-6 text-center transition-colors hover:border-[var(--color-harbor-400)] hover:bg-[var(--color-ink-50)] cursor-pointer"
                >
                  <UploadCloud className="h-8 w-8 text-[var(--color-harbor-500)]" />
                  <p className="mt-2 text-xs font-semibold text-[var(--color-ink-800)]">
                    Click or drag & drop files here to upload
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--color-ink-400)]">
                    Supported: PDF, ZIP, DOCX, PNG, CSV up to 25MB
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              )}

              {/* Uploaded Files List */}
              {uploadedFiles.length > 0 ? (
                <div className="space-y-2">
                  <span className="text-[11px] font-medium text-[var(--color-ink-500)]">
                    Files ({uploadedFiles.length})
                  </span>
                  <div className="space-y-1.5">
                    {uploadedFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between rounded-md border border-[var(--color-line)] bg-white px-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <File className="h-4 w-4 text-[var(--color-harbor-500)] shrink-0" />
                          <span className="truncate font-medium text-[var(--color-ink-800)]">
                            {file.name}
                          </span>
                          <span className="text-[11px] text-[var(--color-ink-400)] shrink-0">
                            ({file.size})
                          </span>
                        </div>
                        {isEditing ? (
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(file.id)}
                            className="text-[var(--color-danger-600)] hover:text-[var(--color-danger-700)] p-1 rounded hover:bg-red-50"
                            title="Remove file"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <span className="text-[11px] text-emerald-600 font-medium">Uploaded</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                !isEditing && (
                  <p className="text-xs text-[var(--color-ink-400)] italic">
                    No files were attached for this submission.
                  </p>
                )
              )}
            </div>
          )}

          {/* Submission Action Buttons */}
          {isEditing && !isParent && (
            <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-[var(--color-line)]">
              <button
                type="button"
                onClick={handleSaveDraft}
                className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-4 py-2 text-xs font-semibold text-[var(--color-ink-700)] shadow-xs hover:bg-[var(--color-ink-50)] transition-colors"
              >
                Save Draft
              </button>

              <button
                type="button"
                onClick={() => setShowSubmitModal(true)}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[var(--color-harbor-600)] transition-colors"
              >
                <Check className="h-3.5 w-3.5" />
                Submit Classwork
              </button>
            </div>
          )}

          {isParent && (
            <div className="pt-4 border-t border-[var(--color-line)] flex items-center justify-between text-xs text-[var(--color-ink-500)]">
              <span className="italic">Guardian portal view: Submissions and answers are uploaded by the enrolled student.</span>
              <span className="font-medium text-[var(--color-ink-700)] bg-[var(--color-ink-50)] px-2 py-0.5 rounded border border-[var(--color-line)]">Read-Only</span>
            </div>
          )}
        </div>
      </Card>

      {/* Confirmation Modal for Submitting Classwork */}
      {showSubmitModal && (
        <Modal
          title="Submit Classwork"
          onClose={() => setShowSubmitModal(false)}
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Confirm final submission</p>
                <p className="leading-relaxed">
                  Submitting your classwork will deliver your response and uploaded files to your trainer. Once submitted, editing will be locked until reviewed, unless resubmission is permitted.
                </p>
              </div>
            </div>

            <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-ink-50)] p-3 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[var(--color-ink-500)]">Task:</span>
                <span className="font-medium text-[var(--color-ink-800)]">{classwork.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-ink-500)]">Attached Files:</span>
                <span className="font-medium text-[var(--color-ink-800)]">{uploadedFiles.length} file(s)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-ink-500)]">Written Length:</span>
                <span className="font-medium text-[var(--color-ink-800)]">{responseText.length} characters</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3.5 py-2 text-xs font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmSubmit}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[var(--color-harbor-600)] disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Resource Viewer Modal */}
      {viewingResource && (
        <Modal
          title={viewingResource.name}
          onClose={() => setViewingResource(null)}
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[var(--color-harbor-500)]" />
                <span className="font-medium text-[var(--color-ink-600)]">
                  {viewingResource.type} • {viewingResource.size}
                </span>
              </div>
              <button
                onClick={() => handleDownloadResource(viewingResource)}
                className="inline-flex items-center gap-1 rounded bg-[var(--color-harbor-50)] px-2.5 py-1 font-semibold text-[var(--color-harbor-700)] hover:bg-[var(--color-harbor-100)]"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </button>
            </div>

            <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-ink-50)] p-4 leading-relaxed text-[var(--color-ink-800)] whitespace-pre-line">
              {viewingResource.content || 'No text preview available for this binary resource file. Please use the Download option to review on your device.'}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setViewingResource(null)}
                className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3.5 py-2 text-xs font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Staff Grading Modal (Trainer review) */}
      {showGradeModal && (
        <Modal
          title="Grade Student Classwork"
          onClose={() => setShowGradeModal(false)}
        >
          <div className="space-y-4 text-xs">
            <p className="text-[var(--color-ink-500)]">
              Evaluate {currentStudentName}'s submission for <strong>{classwork.title}</strong>.
            </p>

            <div>
              <label className="font-semibold text-[var(--color-ink-800)] block mb-1">
                Score (Max: {classwork.maximum_marks})
              </label>
              <input
                type="number"
                min={0}
                max={classwork.maximum_marks}
                value={gradeScore}
                onChange={(e) => setGradeScore(Number(e.target.value))}
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] p-2 text-xs text-[var(--color-ink-900)] focus:border-[var(--color-harbor-500)] focus:outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-[var(--color-ink-800)] block mb-1">
                Trainer Feedback
              </label>
              <textarea
                value={gradeFeedback}
                onChange={(e) => setGradeFeedback(e.target.value)}
                placeholder="Detailed assessment of learner performance…"
                rows={3}
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] p-2 text-xs text-[var(--color-ink-900)] focus:border-[var(--color-harbor-500)] focus:outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-[var(--color-ink-800)] block mb-1">
                Areas for Improvement
              </label>
              <textarea
                value={gradeAreasForImprovement}
                onChange={(e) => setGradeAreasForImprovement(e.target.value)}
                placeholder="Specific guidance for further refinement…"
                rows={2}
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] p-2 text-xs text-[var(--color-ink-900)] focus:border-[var(--color-harbor-500)] focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="allow-resubmit"
                checked={gradeAllowResubmission}
                onChange={(e) => setGradeAllowResubmission(e.target.checked)}
                className="rounded border-[var(--color-line)] text-[var(--color-harbor-600)]"
              />
              <label htmlFor="allow-resubmit" className="text-xs text-[var(--color-ink-700)] cursor-pointer">
                Allow student to resubmit this classwork
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-line)]">
              <button
                type="button"
                onClick={() => setShowGradeModal(false)}
                className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3.5 py-2 text-xs font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveGrade}
                className="rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[var(--color-harbor-600)]"
              >
                Publish Grade & Feedback
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
