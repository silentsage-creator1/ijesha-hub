import { useState } from 'react'
import {
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download,
  Edit3,
  RotateCcw,
  File,
  ShieldCheck,
  Send,
} from 'lucide-react'
import type { StudentReport } from '@/lib/studentReports'
import { generateStudentReportPdf } from '@/lib/studentReports'
import { useAuth } from '@/app/auth'
import { Badge } from '@/components/ui/primitives'

interface StudentReportDetailModalProps {
  report: StudentReport | null
  isOpen: boolean
  onClose: () => void
  onEdit: (report: StudentReport) => void
  onReportUpdated: (updated: StudentReport) => void
}

export function StudentReportDetailModal({
  report,
  isOpen,
  onClose,
  onEdit,
  onReportUpdated,
}: StudentReportDetailModalProps) {
  const { role, profile, user } = useAuth()
  const isStaff = ['admin', 'manager', 'trainer'].includes(role ?? '')

  // Review drawer state for staff
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [reviewAction, setReviewAction] = useState<'approve' | 'return'>('approve')
  const [trainerFeedback, setTrainerFeedback] = useState('')
  const [requiredChanges, setRequiredChanges] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // Resubmit state for student
  const [isResubmitting, setIsResubmitting] = useState(false)

  if (!isOpen || !report) return null

  const handleDownload = () => {
    try {
      const generated = generateStudentReportPdf(report)
      generated.save()
    } catch (err) {
      console.error('PDF generation error:', err)
    }
  }

  // Quick Resubmit handler for student on a Returned report
  const handleQuickResubmit = () => {
    setIsResubmitting(true)
    setTimeout(() => {
      const updated: StudentReport = {
        ...report,
        status: 'Under Review',
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      onReportUpdated(updated)
      setIsResubmitting(false)
    }, 500)
  }

  // Staff submission of Review (Approve or Return for changes)
  const handleStaffReview = (e: React.FormEvent) => {
    e.preventDefault()
    setIsProcessing(true)

    setTimeout(() => {
      const reviewerName = profile?.full_name || user?.name || 'Technical Instructor'
      const reviewerRole = profile?.role === 'manager' ? 'Training Manager' : 'Senior Instructor'

      let updated: StudentReport
      if (reviewAction === 'approve') {
        updated = {
          ...report,
          status: 'Approved',
          approved_at: new Date().toISOString(),
          reviewed_at: new Date().toISOString(),
          reviewer_name: reviewerName,
          reviewer_role: reviewerRole,
          trainer_feedback: trainerFeedback.trim() || 'Report approved. Demonstrated proficiency in core curriculum benchmarks.',
          required_changes: undefined,
          updated_at: new Date().toISOString(),
        }
      } else {
        updated = {
          ...report,
          status: 'Returned',
          reviewed_at: new Date().toISOString(),
          reviewer_name: reviewerName,
          reviewer_role: reviewerRole,
          trainer_feedback: trainerFeedback.trim() || 'Please review the requested changes below before resubmitting.',
          required_changes: requiredChanges.trim() || 'Please clarify technical implementation details in Section 4 and attach supporting test files.',
          updated_at: new Date().toISOString(),
        }
      }

      onReportUpdated(updated)
      setIsProcessing(false)
      setShowReviewForm(false)
    }, 500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-line)] px-6 py-4 bg-[var(--color-ink-50)]">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-500)]">
                  Student Report
                </span>
                <span className="text-[11px] font-mono text-[var(--color-ink-400)]">
                  #{report.id}
                </span>
              </div>
              <h2 className="font-display text-lg font-bold text-[var(--color-ink-900)]">
                {report.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]"
              title="Download official PDF report"
            >
              <Download className="h-3.5 w-3.5 text-[var(--color-harbor-600)]" />
              Download PDF
            </button>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-[var(--color-ink-400)] hover:bg-[var(--color-ink-200)] hover:text-[var(--color-ink-700)]"
              title="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Status Callout Banner */}
        {report.status === 'Returned' && (
          <div className="border-b border-rose-200 bg-rose-50/90 px-6 py-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-800 font-display font-semibold text-sm">
                <AlertCircle className="h-4 w-4 text-rose-600" />
                Report Returned
              </div>
              <Badge tone="danger">Changes Required</Badge>
            </div>

            {report.trainer_feedback && (
              <div className="text-xs text-rose-900 bg-white/70 p-2.5 rounded border border-rose-200">
                <span className="font-bold block text-[11px] uppercase tracking-wider text-rose-700 mb-0.5">
                  Trainer Feedback
                </span>
                <p className="leading-relaxed">{report.trainer_feedback}</p>
              </div>
            )}

            {report.required_changes && (
              <div className="text-xs text-rose-900 bg-white/70 p-2.5 rounded border border-rose-200">
                <span className="font-bold block text-[11px] uppercase tracking-wider text-rose-700 mb-0.5">
                  Required Changes
                </span>
                <p className="leading-relaxed">{report.required_changes}</p>
              </div>
            )}

            {!isStaff && (
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onEdit(report)
                  }}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-50"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Edit Report
                </button>
                <button
                  type="button"
                  disabled={isResubmitting}
                  onClick={handleQuickResubmit}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-rose-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-800 shadow-xs"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {isResubmitting ? 'Submitting...' : 'Resubmit'}
                </button>
              </div>
            )}
          </div>
        )}

        {report.status === 'Approved' && (
          <div className="border-b border-emerald-200 bg-emerald-50/90 px-6 py-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-800 font-display font-semibold text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Approved
              </div>
              <Badge tone="success">Verified Deliverable</Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-emerald-900 pt-1">
              <div>
                <span className="text-[10px] text-emerald-700 uppercase block font-semibold">
                  Submitted Date
                </span>
                <span>
                  {report.submitted_at
                    ? new Date(report.submitted_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : report.report_date}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-emerald-700 uppercase block font-semibold">
                  Approved Date
                </span>
                <span>
                  {report.approved_at
                    ? new Date(report.approved_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'Verified'}
                </span>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-[10px] text-emerald-700 uppercase block font-semibold">
                  Reviewer
                </span>
                <span className="font-medium">{report.reviewer_name || 'Instructor'}</span>
              </div>
            </div>

            {report.trainer_feedback && (
              <div className="text-xs text-emerald-950 bg-white/70 p-2.5 rounded border border-emerald-200 mt-2">
                <span className="font-bold block text-[11px] uppercase tracking-wider text-emerald-800 mb-0.5">
                  Reviewer Feedback
                </span>
                <p className="leading-relaxed">{report.trainer_feedback}</p>
              </div>
            )}
          </div>
        )}

        {report.status === 'Under Review' && (
          <div className="border-b border-amber-200 bg-amber-50/90 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium text-amber-800">
              <Clock className="h-4 w-4 text-amber-600" />
              <span>
                <strong>Under Review</strong>: Report submitted on{' '}
                {report.submitted_at
                  ? new Date(report.submitted_at).toLocaleDateString()
                  : report.report_date}
                . Trainer evaluation pending.
              </span>
            </div>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
              🟡 Under Review
            </span>
          </div>
        )}

        {report.status === 'Draft' && (
          <div className="border-b border-[var(--color-line)] bg-[var(--color-ink-50)] px-6 py-3 flex items-center justify-between text-xs text-[var(--color-ink-600)]">
            <span className="italic">
              <strong>Draft</strong>: Student is still working on it. Not yet visible to trainers for grading.
            </span>
            <Badge tone="harbor">Draft</Badge>
          </div>
        )}

        {/* Document Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Student Meta Details Header */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-ink-50)] p-4 text-xs">
            <div>
              <span className="text-[10px] uppercase font-semibold text-[var(--color-ink-400)] block">
                Student
              </span>
              <span className="font-semibold text-[var(--color-ink-900)] block">
                {report.student_name}
              </span>
              <span className="text-[11px] text-[var(--color-ink-500)] truncate block">
                {report.student_email}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-semibold text-[var(--color-ink-400)] block">
                Course & Cohort
              </span>
              <span className="font-medium text-[var(--color-ink-900)]">
                {report.course}
              </span>
              <span className="text-[11px] text-[var(--color-ink-500)] block">
                {report.cohort}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-semibold text-[var(--color-ink-400)] block">
                Report Type
              </span>
              <Badge tone="harbor">{report.type}</Badge>
            </div>

            <div>
              <span className="text-[10px] uppercase font-semibold text-[var(--color-ink-400)] block">
                Training Period
              </span>
              <span className="text-[11px] text-[var(--color-ink-700)]">
                {report.training_period}
              </span>
            </div>
          </div>

          {/* Sections List */}
          <div className="space-y-5">
            {report.sections.map((sec, idx) => (
              <div
                key={sec.id}
                className="space-y-1.5 border-b border-[var(--color-line)] pb-4 last:border-b-0"
              >
                <h3 className="font-display text-sm font-semibold text-[var(--color-ink-900)] flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-[var(--color-ink-100)] text-[11px] font-bold text-[var(--color-ink-700)]">
                    {idx + 1}
                  </span>
                  {sec.title}
                </h3>
                <p className="text-xs text-[var(--color-ink-500)] italic pl-7">
                  "{sec.prompt}"
                </p>
                <div className="pl-7 pt-1 text-sm text-[var(--color-ink-800)] whitespace-pre-wrap leading-relaxed">
                  {sec.content ? (
                    sec.content
                  ) : (
                    <span className="italic text-[var(--color-ink-400)] text-xs">
                      No response provided.
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Attachments Section */}
          {report.attachments && report.attachments.length > 0 && (
            <div className="space-y-3 pt-2">
              <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-700)]">
                Evidence & Attached Files ({report.attachments.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {report.attachments.map((file) => (
                  <div
                    key={file.id}
                    className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-2.5 flex items-center justify-between text-xs bg-[var(--color-ink-50)]"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <File className="h-4 w-4 text-[var(--color-harbor-600)] shrink-0" />
                      <span className="font-medium text-[var(--color-ink-900)] truncate">
                        {file.name}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-[var(--color-ink-500)] shrink-0 ml-2">
                      {file.size}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STAFF REVIEW FORM DRAWER (Requirement 12) */}
          {isStaff && showReviewForm && (
            <form
              onSubmit={handleStaffReview}
              className="rounded-[var(--radius-lg)] border-2 border-[var(--color-harbor-400)] bg-[var(--color-harbor-50)]/40 p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-display text-sm font-bold text-[var(--color-ink-900)] flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[var(--color-harbor-600)]" />
                  Trainer & Manager Evaluation
                </h4>
                <button
                  type="button"
                  onClick={() => setShowReviewForm(false)}
                  className="text-xs text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)]"
                >
                  Cancel
                </button>
              </div>

              {/* Review Action Tabs */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setReviewAction('approve')}
                  className={`flex-1 rounded-[var(--radius-md)] py-2 text-xs font-semibold border transition-all ${
                    reviewAction === 'approve'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white text-[var(--color-ink-700)] border-[var(--color-line)] hover:bg-[var(--color-ink-50)]'
                  }`}
                >
                  ✓ Approve Report
                </button>
                <button
                  type="button"
                  onClick={() => setReviewAction('return')}
                  className={`flex-1 rounded-[var(--radius-md)] py-2 text-xs font-semibold border transition-all ${
                    reviewAction === 'return'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                      : 'bg-white text-[var(--color-ink-700)] border-[var(--color-line)] hover:bg-[var(--color-ink-50)]'
                  }`}
                >
                  ✕ Return for Changes
                </button>
              </div>

              {/* Feedback Input */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[var(--color-ink-800)]">
                  {reviewAction === 'approve' ? 'Instructor Feedback (Optional)' : 'Trainer Feedback *'}
                </label>
                <textarea
                  rows={3}
                  required={reviewAction === 'return'}
                  value={trainerFeedback}
                  onChange={(e) => setTrainerFeedback(e.target.value)}
                  placeholder={
                    reviewAction === 'approve'
                      ? 'Commend key strengths and curriculum milestones achieved...'
                      : 'Explain why the report is being returned and what was deficient...'
                  }
                  className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] p-2.5 text-xs text-[var(--color-ink-900)] focus:border-[var(--color-harbor-500)] focus:outline-none"
                />
              </div>

              {/* Required Changes (only if returning) */}
              {reviewAction === 'return' && (
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-rose-900">
                    Required Changes *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={requiredChanges}
                    onChange={(e) => setRequiredChanges(e.target.value)}
                    placeholder="List specific edits (e.g. 1. Add iptables logs in Section 4. 2. Attach Wireshark capture file)."
                    className="w-full rounded-[var(--radius-md)] border border-rose-300 p-2.5 text-xs text-[var(--color-ink-900)] focus:border-rose-500 focus:outline-none"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReviewForm(false)}
                  className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--color-ink-700)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className={`inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-4 py-1.5 text-xs font-semibold text-white shadow-xs ${
                    reviewAction === 'approve'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  <Send className="h-3.5 w-3.5" />
                  {isProcessing
                    ? 'Processing...'
                    : reviewAction === 'approve'
                    ? 'Confirm Approval'
                    : 'Return to Student'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between border-t border-[var(--color-line)] px-6 py-3.5 bg-[var(--color-ink-50)] gap-2">
          <div className="text-xs text-[var(--color-ink-500)]">
            Report Date: {report.report_date}
          </div>

          <div className="flex items-center gap-2">
            {/* Student can edit draft or returned reports */}
            {!isStaff && (report.status === 'Draft' || report.status === 'Returned') && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onEdit(report)
                }}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3.5 py-1.5 text-xs font-semibold text-[var(--color-ink-800)] hover:bg-[var(--color-ink-100)]"
              >
                <Edit3 className="h-3.5 w-3.5 text-[var(--color-ink-600)]" />
                Edit Report
              </button>
            )}

            {/* Staff Review Buttons */}
            {isStaff && !showReviewForm && (
              <button
                type="button"
                onClick={() => setShowReviewForm(true)}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[var(--color-harbor-600)]"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {report.status === 'Approved' ? 'Update Evaluation' : 'Review & Evaluate'}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3.5 py-1.5 text-xs font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-ink-100)]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
