import { useEffect, useState, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle,
  FileText,
  Calendar,
  Download,
  Upload,
  Search,
  Check,
  Send,
  User,
  ExternalLink,
} from 'lucide-react'
import { Badge, Card, SectionHeading } from '@/components/ui/primitives'
import { useAuth } from '@/app/auth'
import {
  getStoredAssignments,
  saveStoredAssignments,
  getStoredSubmissions,
  saveStoredSubmissions,
  formatAssignmentDate,
  calculateSubmissionStats,
} from '@/lib/assignments'
import type {
  Assignment,
  AssignmentSubmission,
  AssignmentResource,
  AssignmentStatus,
  StudentAssignmentStatus,
} from '@/types'

export function AssignmentDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { role, profile } = useAuth()
  const isStaff = ['admin', 'manager', 'trainer'].includes(role ?? '')
  const isStudent = role === 'student'

  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([])
  const [activeTab, setActiveTab] = useState<'overview' | 'instructions' | 'resources' | 'submissions' | 'grading' | 'students'>('overview')

  // Grading Tab State
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [gradingScore, setGradingScore] = useState<string>('')
  const [gradingFeedback, setGradingFeedback] = useState<string>('')
  const [gradeSavedToast, setGradeSavedToast] = useState(false)

  // Student workflow state: "Start Assignment -> Submission -> Submit"
  const [workflowStep, setWorkflowStep] = useState<'details' | 'submitting' | 'submitted'>('details')
  const [studentText, setStudentText] = useState('')
  const [studentLink, setStudentLink] = useState('')
  const [studentFiles, setStudentFiles] = useState<AssignmentResource[]>([])
  const [submissionSuccessToast, setSubmissionSuccessToast] = useState(false)

  // Submissions Tab Filter
  const [submissionFilter, setSubmissionFilter] = useState<'all' | 'submitted' | 'not_submitted' | 'graded'>('all')
  const [studentSearch, setStudentSearch] = useState('')

  // Load assignment and submissions
  useEffect(() => {
    const allAssignments = getStoredAssignments()
    const found = allAssignments.find(a => a.id === id) || allAssignments[0]
    if (found) {
      setAssignment(found)
      const subs = getStoredSubmissions(found.id)
      setSubmissions(subs)
      // Pick first submitted student for grading default
      const firstSubmitted = subs.find(s => s.status === 'Submitted' || s.status === 'Graded')
      if (firstSubmitted) {
        setSelectedStudentId(firstSubmitted.student_id)
        setGradingScore(firstSubmitted.marks !== null && firstSubmitted.marks !== undefined ? String(firstSubmitted.marks) : '')
        setGradingFeedback(firstSubmitted.feedback ?? '')
      }
    }
  }, [id])

  // Current student's submission (for student view)
  const studentSubmission = useMemo(() => {
    if (!assignment) return null
    return submissions.find(s => s.student_id === profile?.id) || null
  }, [submissions, assignment, profile])

  // Sync student workflow state
  useEffect(() => {
    if (studentSubmission) {
      if (studentSubmission.status === 'Submitted' || studentSubmission.status === 'Graded') {
        setWorkflowStep('submitted')
      } else {
        setWorkflowStep('details')
      }
      if (studentSubmission.response_text) setStudentText(studentSubmission.response_text)
      if (studentSubmission.response_link) setStudentLink(studentSubmission.response_link)
      if (studentSubmission.response_files) setStudentFiles(studentSubmission.response_files)
    } else {
      setWorkflowStep('details')
      setStudentText('')
      setStudentLink('')
      setStudentFiles([])
    }
  }, [studentSubmission])

  if (!assignment) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-[var(--color-ink-500)]">Assignment not found or not available.</p>
        <Link to="/assignments" className="mt-2 inline-block text-xs font-semibold text-[var(--color-harbor-600)] hover:underline">
          Return to assignments
        </Link>
      </div>
    )
  }

  const stats = calculateSubmissionStats(submissions)

  // Toggle publish status for staff
  const handleTogglePublish = () => {
    const newStatus: AssignmentStatus = assignment.status === 'Published' ? 'Draft' : 'Published'
    const updated: Assignment = { ...assignment, status: newStatus }
    setAssignment(updated)
    const all = getStoredAssignments().map(a => (a.id === assignment.id ? updated : a))
    saveStoredAssignments(all)
  }

  // Handle Save Grade
  const handleSaveGrade = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStudentId) return

    const numScore = parseFloat(gradingScore)
    if (isNaN(numScore) || numScore < 0 || numScore > assignment.maximum_marks) {
      alert(`Score must be between 0 and ${assignment.maximum_marks}`)
      return
    }

    const updated = submissions.map(sub => {
      if (sub.student_id === selectedStudentId) {
        return {
          ...sub,
          marks: numScore,
          feedback: gradingFeedback.trim() || null,
          status: 'Graded' as StudentAssignmentStatus,
          graded_at: new Date().toISOString(),
          graded_by: profile?.full_name ?? 'Trainer',
        }
      }
      return sub
    })

    setSubmissions(updated)
    saveStoredSubmissions(assignment.id, updated)
    setGradeSavedToast(true)
    setTimeout(() => setGradeSavedToast(false), 2500)
  }

  // Handle Student Submit Assignment
  const handleStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!studentSubmission) return

    const updated = submissions.map(s => {
      if (s.student_id === studentSubmission.student_id) {
        return {
          ...s,
          status: 'Submitted' as StudentAssignmentStatus,
          response_text: studentText.trim() || null,
          response_link: studentLink.trim() || null,
          response_files: studentFiles.length > 0 ? studentFiles : [
            {
              id: `file-uploaded-${Date.now()}`,
              name: `${s.student_name.replace(/\s+/g, '_')}_Assignment.pdf`,
              type: 'PDF Document',
              size: '1.4 MB',
              url: '#',
            },
          ],
          submitted_at: new Date().toISOString(),
        }
      }
      return s
    })

    setSubmissions(updated)
    saveStoredSubmissions(assignment.id, updated)
    setWorkflowStep('submitted')
    setSubmissionSuccessToast(true)
    setTimeout(() => setSubmissionSuccessToast(false), 3000)
  }

  // Handle Student File Selection
  const handleStudentFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const newFile: AssignmentResource = {
      id: `file-${Date.now()}`,
      name: files[0].name,
      type: files[0].type.includes('pdf') ? 'PDF Document' : 'Document',
      size: `${(files[0].size / (1024 * 1024)).toFixed(1)} MB`,
      url: URL.createObjectURL(files[0]),
    }
    setStudentFiles(prev => [...prev, newFile])
  }

  // Filtered submissions
  const filteredSubmissions = submissions.filter(s => {
    const matchesSearch = s.student_name.toLowerCase().includes(studentSearch.toLowerCase())
    if (!matchesSearch) return false

    if (submissionFilter === 'submitted') return s.status === 'Submitted'
    if (submissionFilter === 'not_submitted') return s.status === 'Not Started' || s.status === 'In Progress'
    if (submissionFilter === 'graded') return s.status === 'Graded'
    return true
  })

  const selectedStudentForGrading = submissions.find(s => s.student_id === selectedStudentId)

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          to="/assignments"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)] transition-colors"
        >
          <ArrowLeft size={14} /> Back to Assignments
        </Link>
      </div>

      {/* Top Header Card */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-[var(--color-ink-900)]">
              {assignment.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--color-ink-600)]">
              <span className="font-medium text-[var(--color-ink-800)]">Week {assignment.training_week}</span>
              <span>·</span>
              <span>{assignment.course_name}</span>
              <span>·</span>
              <span>{assignment.cohort_name}</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Calendar size={14} className="text-[var(--color-ink-400)]" />
                Due: {formatAssignmentDate(assignment.due_date)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge tone={assignment.status === 'Published' ? 'success' : 'warning'}>
              {assignment.status}
            </Badge>

            {isStaff && (
              <button
                type="button"
                onClick={handleTogglePublish}
                className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3.5 py-1.5 text-xs font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)] transition-colors shadow-xs"
              >
                {assignment.status === 'Published' ? 'Unpublish to Draft' : 'Publish Assignment'}
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Tabs Navigation */}
      <div className="border-b border-[var(--color-line)]">
        <nav className="flex space-x-6 overflow-x-auto" aria-label="Assignment Details Tabs">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`border-b-2 py-3 px-1 text-sm font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-[var(--color-harbor-500)] text-[var(--color-harbor-600)]'
                : 'border-transparent text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)]'
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('instructions')}
            className={`border-b-2 py-3 px-1 text-sm font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'instructions'
                ? 'border-[var(--color-harbor-500)] text-[var(--color-harbor-600)]'
                : 'border-transparent text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)]'
            }`}
          >
            Instructions
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('resources')}
            className={`border-b-2 py-3 px-1 text-sm font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'resources'
                ? 'border-[var(--color-harbor-500)] text-[var(--color-harbor-600)]'
                : 'border-transparent text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)]'
            }`}
          >
            Resources ({assignment.resources?.length ?? 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('submissions')}
            className={`border-b-2 py-3 px-1 text-sm font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'submissions'
                ? 'border-[var(--color-harbor-500)] text-[var(--color-harbor-600)]'
                : 'border-transparent text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)]'
            }`}
          >
            Submissions
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('grading')}
            className={`border-b-2 py-3 px-1 text-sm font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'grading'
                ? 'border-[var(--color-harbor-500)] text-[var(--color-harbor-600)]'
                : 'border-transparent text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)]'
            }`}
          >
            Grading
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('students')}
            className={`border-b-2 py-3 px-1 text-sm font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'students'
                ? 'border-[var(--color-harbor-500)] text-[var(--color-harbor-600)]'
                : 'border-transparent text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)]'
            }`}
          >
            Students
          </button>
        </nav>
      </div>

      {/* TAB CONTENT: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Student Banner if viewing as a Student */}
          {isStudent && (
            <Card className="p-5 border-l-4 border-l-[var(--color-harbor-500)] bg-[var(--color-harbor-50)]/30">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-harbor-700)]">
                      Your Status
                    </span>
                    <Badge
                      tone={
                        studentSubmission?.status === 'Graded'
                          ? 'success'
                          : studentSubmission?.status === 'Submitted'
                          ? 'harbor'
                          : 'warning'
                      }
                    >
                      {studentSubmission?.status ?? 'Not Started'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-[var(--color-ink-700)]">
                    {studentSubmission?.status === 'Graded'
                      ? `Marks: ${studentSubmission.marks} / ${assignment.maximum_marks} · Graded by ${studentSubmission.graded_by ?? 'Trainer'}`
                      : studentSubmission?.status === 'Submitted'
                      ? `Submitted on ${studentSubmission.submitted_at ? new Date(studentSubmission.submitted_at).toLocaleDateString() : 'recent date'}. Awaiting grading.`
                      : 'You have not submitted this assignment yet. Follow instructions and submit before the deadline.'}
                  </p>
                </div>

                {workflowStep !== 'submitted' ? (
                  <button
                    type="button"
                    onClick={() => setWorkflowStep('submitting')}
                    className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-harbor-600)] transition-colors shadow-xs whitespace-nowrap"
                  >
                    Start Assignment →
                  </button>
                ) : (
                  <div className="text-xs text-[var(--color-success-600)] font-semibold flex items-center gap-1">
                    <CheckCircle size={15} /> Submission Received
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Student In-Progress Submission Workflow: Start Assignment -> Submission -> Submit */}
          {isStudent && workflowStep === 'submitting' && (
            <Card className="p-6 border-[var(--color-harbor-300)] shadow-md">
              <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-4 mb-5">
                <div>
                  <h3 className="font-display text-base font-semibold text-[var(--color-ink-900)] flex items-center gap-2">
                    <Send size={18} className="text-[var(--color-harbor-600)]" />
                    Submit Assignment
                  </h3>
                  <p className="text-xs text-[var(--color-ink-500)] mt-0.5">
                    Mode: {assignment.submission_type} · Maximum Marks: {assignment.maximum_marks}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setWorkflowStep('details')}
                  className="text-xs font-semibold text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)]"
                >
                  Cancel
                </button>
              </div>

              <form onSubmit={handleStudentSubmit} className="space-y-4">
                {(assignment.submission_type === 'Text Submission' || assignment.submission_type === 'File + Text') && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-700)] mb-1.5">
                      Your Response / Written Solution
                    </label>
                    <textarea
                      required={assignment.submission_type === 'Text Submission'}
                      rows={5}
                      className="input w-full"
                      placeholder="Write your response, explanations, or answers here…"
                      value={studentText}
                      onChange={e => setStudentText(e.target.value)}
                    />
                  </div>
                )}

                {(assignment.submission_type === 'Link Submission' || assignment.submission_type === 'File + Text') && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-700)] mb-1.5">
                      Project / Repository / Drive Link
                    </label>
                    <input
                      type="url"
                      required={assignment.submission_type === 'Link Submission'}
                      className="input w-full"
                      placeholder="https://github.com/... or Google Drive / Figma link"
                      value={studentLink}
                      onChange={e => setStudentLink(e.target.value)}
                    />
                  </div>
                )}

                {(assignment.submission_type === 'File Upload' || assignment.submission_type === 'File + Text') && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-700)] mb-1.5">
                      Attach File (PDF, Document, Zip)
                    </label>
                    <div className="flex items-center gap-3">
                      <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-ink-50)] px-3.5 py-2 text-xs font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-ink-100)] transition-colors">
                        <Upload size={14} /> Browse File
                        <input
                          type="file"
                          className="hidden"
                          onChange={handleStudentFileUpload}
                          accept=".pdf,.docx,.doc,.zip,.png,.jpg"
                        />
                      </label>
                      <span className="text-xs text-[var(--color-ink-500)]">
                        {studentFiles.length > 0 ? studentFiles.map(f => f.name).join(', ') : 'No file chosen'}
                      </span>
                    </div>
                  </div>
                )}

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setWorkflowStep('details')}
                    className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-2 text-sm font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-harbor-600)] transition-colors shadow-xs"
                  >
                    Submit Assignment
                  </button>
                </div>
              </form>
            </Card>
          )}

          {/* Toast Notification */}
          {submissionSuccessToast && (
            <div className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-success-100)] p-3.5 text-sm text-[var(--color-success-700)] font-medium">
              <CheckCircle size={18} />
              Assignment submitted successfully!
            </div>
          )}

          {/* Structured Assignment Overview Specs */}
          <Card className="p-6">
            <SectionHeading title="Assignment Specifications" />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-500)]">
                  Assignment Title
                </dt>
                <dd className="mt-1 font-display text-sm font-semibold text-[var(--color-ink-900)]">
                  {assignment.title}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-500)]">
                  Assignment Type
                </dt>
                <dd className="mt-1 text-sm font-medium text-[var(--color-ink-800)]">
                  {assignment.assignment_type}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-500)]">
                  Status
                </dt>
                <dd className="mt-1">
                  <Badge tone={assignment.status === 'Published' ? 'success' : 'warning'}>
                    {assignment.status}
                  </Badge>
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-500)]">
                  Course
                </dt>
                <dd className="mt-1 text-sm font-medium text-[var(--color-ink-800)]">
                  {assignment.course_name}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-500)]">
                  Cohort
                </dt>
                <dd className="mt-1 text-sm font-medium text-[var(--color-ink-800)]">
                  {assignment.cohort_name}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-500)]">
                  Training Week
                </dt>
                <dd className="mt-1 text-sm font-medium text-[var(--color-ink-800)]">
                  Week {assignment.training_week}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-500)]">
                  Start Date
                </dt>
                <dd className="mt-1 text-sm font-medium text-[var(--color-ink-800)]">
                  {formatAssignmentDate(assignment.start_date)}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-500)]">
                  Due Date
                </dt>
                <dd className="mt-1 text-sm font-medium text-[var(--color-ink-800)]">
                  {formatAssignmentDate(assignment.due_date)}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-500)]">
                  Maximum Marks
                </dt>
                <dd className="mt-1 text-sm font-semibold text-[var(--color-harbor-600)]">
                  {assignment.maximum_marks} points
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-500)]">
                  Submission Type
                </dt>
                <dd className="mt-1 text-sm font-medium text-[var(--color-ink-800)]">
                  {assignment.submission_type}
                </dd>
              </div>

              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-500)]">
                  Description
                </dt>
                <dd className="mt-1 text-sm text-[var(--color-ink-700)] leading-relaxed">
                  {assignment.description}
                </dd>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB CONTENT: INSTRUCTIONS */}
      {activeTab === 'instructions' && (
        <Card className="p-6">
          <SectionHeading title="Complete Assignment Instructions" />
          <div className="rounded-[var(--radius-md)] bg-[var(--color-ink-50)]/60 border border-[var(--color-line)] p-5">
            <pre className="whitespace-pre-wrap font-sans text-sm text-[var(--color-ink-800)] leading-relaxed">
              {assignment.instructions}
            </pre>
          </div>
        </Card>
      )}

      {/* TAB CONTENT: RESOURCES */}
      {activeTab === 'resources' && (
        <Card className="p-6">
          <SectionHeading
            title="Attached Resources & Materials"
            action={
              isStaff ? (
                <span className="text-xs text-[var(--color-ink-500)]">
                  Resources are accessible by all enrolled students.
                </span>
              ) : undefined
            }
          />

          {assignment.resources && assignment.resources.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {assignment.resources.map(res => (
                <div
                  key={res.id}
                  className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-4 hover:border-[var(--color-harbor-300)] transition-colors"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-harbor-50)] text-[var(--color-harbor-600)]">
                      <FileText size={20} />
                    </div>
                    <div className="overflow-hidden">
                      <p className="truncate text-sm font-semibold text-[var(--color-ink-900)]">
                        {res.name}
                      </p>
                      <p className="text-xs text-[var(--color-ink-500)]">
                        {res.type} {res.size ? `· ${res.size}` : ''}
                      </p>
                    </div>
                  </div>

                  <a
                    href={res.url || '#'}
                    download={res.name}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-3 inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-ink-50)] px-3 py-1.5 text-xs font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-ink-100)] transition-colors"
                  >
                    <Download size={14} /> Download
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-line)] p-8 text-center text-sm text-[var(--color-ink-400)]">
              No resources attached to this assignment.
            </div>
          )}
        </Card>
      )}

      {/* TAB CONTENT: SUBMISSIONS */}
      {activeTab === 'submissions' && (
        <div className="space-y-5">
          {/* Submission Summary Banner */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4 text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-500)]">
                Submitted
              </span>
              <p className="mt-1 font-display text-2xl font-bold text-[var(--color-harbor-600)]">
                {stats.submitted}
              </p>
            </Card>

            <Card className="p-4 text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-500)]">
                Not Submitted
              </span>
              <p className="mt-1 font-display text-2xl font-bold text-[var(--color-ink-400)]">
                {stats.notSubmitted}
              </p>
            </Card>

            <Card className="p-4 text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-500)]">
                Graded
              </span>
              <p className="mt-1 font-display text-2xl font-bold text-[var(--color-success-600)]">
                {stats.graded}
              </p>
            </Card>
          </div>

          {/* Submissions List & Filter */}
          <Card className="overflow-hidden">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-[var(--color-line)] p-4 bg-[var(--color-ink-50)]/40">
              <div className="relative w-full sm:w-72">
                <Search size={15} className="absolute left-3 top-2.5 text-[var(--color-ink-400)]" />
                <input
                  type="text"
                  placeholder="Search student…"
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  className="input pl-9 w-full text-xs"
                />
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setSubmissionFilter('all')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-md)] transition-colors ${
                    submissionFilter === 'all'
                      ? 'bg-[var(--color-harbor-500)] text-white'
                      : 'bg-white border border-[var(--color-line)] text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]'
                  }`}
                >
                  All ({submissions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSubmissionFilter('submitted')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-md)] transition-colors ${
                    submissionFilter === 'submitted'
                      ? 'bg-[var(--color-harbor-500)] text-white'
                      : 'bg-white border border-[var(--color-line)] text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]'
                  }`}
                >
                  Submitted ({stats.submitted})
                </button>
                <button
                  type="button"
                  onClick={() => setSubmissionFilter('not_submitted')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-md)] transition-colors ${
                    submissionFilter === 'not_submitted'
                      ? 'bg-[var(--color-harbor-500)] text-white'
                      : 'bg-white border border-[var(--color-line)] text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]'
                  }`}
                >
                  Not Submitted ({stats.notSubmitted})
                </button>
                <button
                  type="button"
                  onClick={() => setSubmissionFilter('graded')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-md)] transition-colors ${
                    submissionFilter === 'graded'
                      ? 'bg-[var(--color-harbor-500)] text-white'
                      : 'bg-white border border-[var(--color-line)] text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]'
                  }`}
                >
                  Graded ({stats.graded})
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--color-line)] bg-[var(--color-ink-50)] text-xs font-semibold text-[var(--color-ink-600)]">
                  <tr>
                    <th className="px-5 py-3">Student</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Submission Date</th>
                    <th className="px-5 py-3">Marks</th>
                    {isStaff && <th className="px-5 py-3 text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-line)]">
                  {filteredSubmissions.map(sub => (
                    <tr key={sub.id} className="hover:bg-[var(--color-ink-50)]/40 transition-colors">
                      <td className="px-5 py-3.5">
                        <Link
                          to={`/students/${sub.student_id}`}
                          className="font-medium text-[var(--color-harbor-600)] hover:underline flex items-center gap-2"
                        >
                          <User size={15} className="text-[var(--color-ink-400)]" />
                          <span>{sub.student_name}</span>
                        </Link>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge
                          tone={
                            sub.status === 'Graded'
                              ? 'success'
                              : sub.status === 'Submitted'
                              ? 'harbor'
                              : 'neutral'
                          }
                        >
                          {sub.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-[var(--color-ink-500)]">
                        {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-xs font-medium text-[var(--color-ink-800)]">
                        {sub.marks !== null && sub.marks !== undefined ? (
                          <span>{sub.marks} / {assignment.maximum_marks}</span>
                        ) : (
                          <span className="text-[var(--color-ink-400)]">—</span>
                        )}
                      </td>
                      {isStaff && (
                        <td className="px-5 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStudentId(sub.student_id)
                              setGradingScore(sub.marks !== null && sub.marks !== undefined ? String(sub.marks) : '')
                              setGradingFeedback(sub.feedback ?? '')
                              setActiveTab('grading')
                            }}
                            className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3 py-1 text-xs font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)] transition-colors shadow-xs"
                          >
                            Review & Grade
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB CONTENT: GRADING */}
      {activeTab === 'grading' && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left: Student Selector */}
          <Card className="p-4 overflow-hidden lg:col-span-1">
            <h3 className="font-display text-sm font-semibold text-[var(--color-ink-900)] mb-3">
              Select Student to Grade
            </h3>
            <div className="max-h-[500px] overflow-y-auto divide-y divide-[var(--color-line)]">
              {submissions.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSelectedStudentId(s.student_id)
                    setGradingScore(s.marks !== null && s.marks !== undefined ? String(s.marks) : '')
                    setGradingFeedback(s.feedback ?? '')
                  }}
                  className={`w-full text-left p-3 transition-colors flex items-center justify-between ${
                    selectedStudentId === s.student_id
                      ? 'bg-[var(--color-harbor-50)] border-l-3 border-[var(--color-harbor-500)]'
                      : 'hover:bg-[var(--color-ink-50)]/60'
                  }`}
                >
                  <div>
                    <p className="font-medium text-sm text-[var(--color-ink-900)] truncate">
                      {s.student_name}
                    </p>
                    <p className="text-xs text-[var(--color-ink-500)]">
                      {s.submitted_at ? `Submitted: ${new Date(s.submitted_at).toLocaleDateString()}` : 'Not submitted'}
                    </p>
                  </div>
                  <Badge
                    tone={
                      s.status === 'Graded'
                        ? 'success'
                        : s.status === 'Submitted'
                        ? 'harbor'
                        : 'neutral'
                    }
                  >
                    {s.status}
                  </Badge>
                </button>
              ))}
            </div>
          </Card>

          {/* Right: Submission & Grading Form */}
          <Card className="p-6 lg:col-span-2 space-y-6">
            {selectedStudentForGrading ? (
              <>
                <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-4">
                  <div>
                    <h3 className="font-display text-lg font-semibold text-[var(--color-ink-900)]">
                      Submission Review:{' '}
                      <Link
                        to={`/students/${selectedStudentForGrading.student_id}`}
                        className="text-[var(--color-harbor-600)] hover:underline"
                      >
                        {selectedStudentForGrading.student_name}
                      </Link>
                    </h3>
                    <p className="text-xs text-[var(--color-ink-500)] mt-0.5">
                      Status: {selectedStudentForGrading.status} · Max Score: {assignment.maximum_marks} points
                    </p>
                  </div>
                  <Badge
                    tone={
                      selectedStudentForGrading.status === 'Graded'
                        ? 'success'
                        : selectedStudentForGrading.status === 'Submitted'
                        ? 'harbor'
                        : 'warning'
                    }
                  >
                    {selectedStudentForGrading.status}
                  </Badge>
                </div>

                {/* Submitted Content Preview */}
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-500)] mb-1">
                      Student Response
                    </h4>
                    <div className="rounded-[var(--radius-md)] bg-[var(--color-ink-50)]/50 border border-[var(--color-line)] p-4 text-sm text-[var(--color-ink-800)] leading-relaxed">
                      {selectedStudentForGrading.response_text || (
                        <span className="text-[var(--color-ink-400)] italic">
                          No written text submitted.
                        </span>
                      )}
                    </div>
                  </div>

                  {selectedStudentForGrading.response_link && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-500)] mb-1">
                        Submitted Link
                      </h4>
                      <a
                        href={selectedStudentForGrading.response_link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-harbor-600)] hover:underline"
                      >
                        <ExternalLink size={14} /> {selectedStudentForGrading.response_link}
                      </a>
                    </div>
                  )}

                  {selectedStudentForGrading.response_files && selectedStudentForGrading.response_files.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-500)] mb-1">
                        Attached Files
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedStudentForGrading.response_files.map(file => (
                          <span
                            key={file.id}
                            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3 py-1 text-xs font-medium text-[var(--color-ink-700)]"
                          >
                            <FileText size={14} className="text-[var(--color-harbor-600)]" />
                            {file.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Grading Form */}
                <form onSubmit={handleSaveGrade} className="space-y-4 border-t border-[var(--color-line)] pt-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-700)] mb-1.5">
                        Award Marks (Out of {assignment.maximum_marks})
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min={0}
                        max={assignment.maximum_marks}
                        required
                        placeholder={`0 - ${assignment.maximum_marks}`}
                        value={gradingScore}
                        onChange={e => setGradingScore(e.target.value)}
                        className="input w-full"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-700)] mb-1.5">
                      Trainer Feedback
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Provide constructive feedback, notes on strength, or suggestions for improvement…"
                      value={gradingFeedback}
                      onChange={e => setGradingFeedback(e.target.value)}
                      className="input w-full"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    {gradeSavedToast ? (
                      <span className="text-xs font-semibold text-[var(--color-success-600)] flex items-center gap-1">
                        <Check size={16} /> Grade and feedback saved!
                      </span>
                    ) : (
                      <span />
                    )}

                    <button
                      type="submit"
                      className="rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-harbor-600)] transition-colors shadow-xs"
                    >
                      Save Grade & Feedback
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="p-8 text-center text-sm text-[var(--color-ink-400)]">
                Select a student from the list to review their submission and enter grades.
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB CONTENT: STUDENTS */}
      {activeTab === 'students' && (
        <Card className="overflow-hidden">
          <div className="border-b border-[var(--color-line)] p-4 bg-[var(--color-ink-50)]/40 flex items-center justify-between">
            <div>
              <h3 className="font-display text-sm font-semibold text-[var(--color-ink-900)]">
                Cohort Roster · {assignment.cohort_name}
              </h3>
              <p className="text-xs text-[var(--color-ink-500)]">
                All students assigned to this cohort. Click any student to open their profile.
              </p>
            </div>
            <span className="text-xs font-semibold text-[var(--color-ink-600)]">
              Total Students: {submissions.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--color-line)] bg-[var(--color-ink-50)] text-xs font-semibold text-[var(--color-ink-600)]">
                <tr>
                  <th className="px-5 py-3">Student Name</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Assignment Status</th>
                  <th className="px-5 py-3">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {submissions.map(student => (
                  <tr key={student.id} className="hover:bg-[var(--color-ink-50)]/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <Link
                        to={`/students/${student.student_id}`}
                        className="font-medium text-[var(--color-harbor-600)] hover:underline flex items-center gap-2"
                      >
                        <User size={15} className="text-[var(--color-ink-400)]" />
                        <span>{student.student_name}</span>
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-[var(--color-ink-500)]">
                      {student.student_email}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge
                        tone={
                          student.status === 'Graded'
                            ? 'success'
                            : student.status === 'Submitted'
                            ? 'harbor'
                            : 'neutral'
                        }
                      >
                        {student.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-xs font-medium text-[var(--color-ink-800)]">
                      {student.marks !== null && student.marks !== undefined ? (
                        <span>{student.marks} / {assignment.maximum_marks}</span>
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
      )}
    </div>
  )
}
