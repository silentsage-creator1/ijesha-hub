import { useState } from 'react'
import { X, Save, FileEdit, CheckCircle2 } from 'lucide-react'
import type { ProgressReport } from '@/lib/reports'
import { updateReport } from '@/lib/reports'
import { useAuth } from '@/app/auth'

interface EditReportModalProps {
  report: ProgressReport
  isOpen: boolean
  onClose: () => void
  onSaved: (updated: ProgressReport) => void
}

export function EditReportModal({
  report,
  isOpen,
  onClose,
  onSaved,
}: EditReportModalProps) {
  const { user, profile } = useAuth()

  const [reportingPeriod, setReportingPeriod] = useState(report.reporting_period)
  const [studentStatus, setStudentStatus] = useState(report.student_status)
  const [reportStatus, setReportStatus] = useState(report.status)
  const [trainerName, setTrainerName] = useState(report.trainer_name || '')

  // Evaluation fields
  const [summary, setSummary] = useState(report.evaluation.summary)
  const [strengths, setStrengths] = useState(report.evaluation.strengths)
  const [areasForImprovement, setAreasForImprovement] = useState(report.evaluation.areas_for_improvement)
  const [recommendations, setRecommendations] = useState(report.evaluation.recommendations)
  const [nextSteps, setNextSteps] = useState(report.evaluation.next_steps)

  const [isSaving, setIsSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  if (!isOpen) return null

  const handleSave = () => {
    setIsSaving(true)
    const actor = {
      name: profile?.full_name || user?.name || 'Authorized Staff',
      role: profile?.role || 'staff',
    }

    const updated: ProgressReport = {
      ...report,
      reporting_period: reportingPeriod,
      student_status: studentStatus,
      status: reportStatus,
      trainer_name: trainerName,
      evaluation: {
        summary,
        strengths,
        areas_for_improvement: areasForImprovement,
        recommendations,
        next_steps: nextSteps,
      },
    }

    const saved = updateReport(updated, actor)
    setIsSaving(false)
    setSuccess(true)
    setTimeout(() => {
      onSaved(saved)
      onClose()
    }, 600)
  }

  return (
    <div
      id="edit-report-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        id="edit-report-modal-content"
        role="dialog"
        aria-labelledby="edit-report-title"
        aria-modal="true"
        className="relative w-full max-w-2xl bg-[var(--color-ink-900)] border border-[var(--color-ink-700)] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-ink-700)] bg-[var(--color-ink-850)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center">
              <FileEdit className="w-4 h-4" />
            </div>
            <div>
              <h2 id="edit-report-title" className="text-base font-semibold text-white">
                Edit Progress Report & Trainer Evaluation
              </h2>
              <p className="text-xs text-[var(--color-ink-300)]">
                {report.student_name} • {report.course_name}
              </p>
            </div>
          </div>
          <button
            id="edit-report-close-btn"
            onClick={onClose}
            className="text-[var(--color-ink-400)] hover:text-white p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {success && (
            <div className="p-3 bg-emerald-950/70 border border-emerald-800 text-emerald-300 rounded-lg flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Report saved successfully! Updating document...</span>
            </div>
          )}

          {/* Core settings */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[var(--color-ink-300)] mb-1">
                Reporting Period
              </label>
              <input
                id="edit-reporting-period-input"
                type="text"
                value={reportingPeriod}
                onChange={(e) => setReportingPeriod(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--color-ink-800)] border border-[var(--color-ink-700)] rounded text-white text-xs focus:outline-hidden focus:border-[var(--color-harbor-500)]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--color-ink-300)] mb-1">
                Student Status
              </label>
              <select
                id="edit-student-status-select"
                value={studentStatus}
                onChange={(e) => setStudentStatus(e.target.value as ProgressReport['student_status'])}
                className="w-full px-3 py-2 bg-[var(--color-ink-800)] border border-[var(--color-ink-700)] rounded text-white text-xs focus:outline-hidden focus:border-[var(--color-harbor-500)]"
              >
                <option value="On Track">On Track</option>
                <option value="At Risk">At Risk</option>
                <option value="Completed">Completed</option>
                <option value="Active">Active</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--color-ink-300)] mb-1">
                Publication State
              </label>
              <select
                id="edit-report-publication-select"
                value={reportStatus}
                onChange={(e) => setReportStatus(e.target.value as 'draft' | 'published')}
                className="w-full px-3 py-2 bg-[var(--color-ink-800)] border border-[var(--color-ink-700)] rounded text-white text-xs focus:outline-hidden focus:border-[var(--color-harbor-500)]"
              >
                <option value="published">Published (Ready for sharing)</option>
                <option value="draft">Draft (Staff internal)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[var(--color-ink-300)] mb-1">
              Lead Trainer / Evaluator Sign-off
            </label>
            <input
              id="edit-trainer-name-input"
              type="text"
              value={trainerName}
              onChange={(e) => setTrainerName(e.target.value)}
              placeholder="e.g. Engr. Folake Balogun"
              className="w-full px-3 py-2 bg-[var(--color-ink-800)] border border-[var(--color-ink-700)] rounded text-white text-xs focus:outline-hidden focus:border-[var(--color-harbor-500)]"
            />
          </div>

          <div className="pt-2 border-t border-[var(--color-ink-800)]">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">
              Trainer & Tutor Evaluation Notes
            </h3>
            <p className="text-[11px] text-[var(--color-ink-400)] mb-3">
              These qualitative comments are embedded directly into the official Student Progress Report PDF.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-[var(--color-ink-300)] mb-1">
                  1. Progress Summary
                </label>
                <textarea
                  id="edit-eval-summary-input"
                  rows={2}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-ink-800)] border border-[var(--color-ink-700)] rounded text-white text-xs focus:outline-hidden focus:border-[var(--color-harbor-500)] font-sans"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[var(--color-ink-300)] mb-1">
                  2. Areas of Strength
                </label>
                <textarea
                  id="edit-eval-strengths-input"
                  rows={2}
                  value={strengths}
                  onChange={(e) => setStrengths(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-ink-800)] border border-[var(--color-ink-700)] rounded text-white text-xs focus:outline-hidden focus:border-[var(--color-harbor-500)] font-sans"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[var(--color-ink-300)] mb-1">
                  3. Areas Requiring Improvement
                </label>
                <textarea
                  id="edit-eval-improvements-input"
                  rows={2}
                  value={areasForImprovement}
                  onChange={(e) => setAreasForImprovement(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-ink-800)] border border-[var(--color-ink-700)] rounded text-white text-xs focus:outline-hidden focus:border-[var(--color-harbor-500)] font-sans"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[var(--color-ink-300)] mb-1">
                  4. Recommendations
                </label>
                <textarea
                  id="edit-eval-recommendations-input"
                  rows={2}
                  value={recommendations}
                  onChange={(e) => setRecommendations(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-ink-800)] border border-[var(--color-ink-700)] rounded text-white text-xs focus:outline-hidden focus:border-[var(--color-harbor-500)] font-sans"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[var(--color-ink-300)] mb-1">
                  5. Next Steps
                </label>
                <textarea
                  id="edit-eval-nextsteps-input"
                  rows={2}
                  value={nextSteps}
                  onChange={(e) => setNextSteps(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-ink-800)] border border-[var(--color-ink-700)] rounded text-white text-xs focus:outline-hidden focus:border-[var(--color-harbor-500)] font-sans"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-ink-700)] bg-[var(--color-ink-850)]">
          <button
            id="edit-report-cancel-btn"
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-[var(--color-ink-300)] hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            id="edit-report-save-btn"
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="px-5 py-2 text-xs font-semibold bg-[var(--color-harbor-600)] hover:bg-[var(--color-harbor-500)] text-white rounded-lg shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? 'Saving Changes...' : 'Save & Update PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}
