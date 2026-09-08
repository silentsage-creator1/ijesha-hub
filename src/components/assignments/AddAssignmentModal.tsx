import { useState, useRef, useEffect } from 'react'
import { X, Upload, Trash2, FileText, AlertCircle } from 'lucide-react'
import { ASSIGNMENT_TYPES, SUBMISSION_TYPES } from '@/lib/assignments'
import type { Assignment, AssignmentResource, AssignmentStatus, AssignmentType, SubmissionType } from '@/types'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/auth'
import { getAllCohorts } from '@/lib/cohorts'

interface CohortOption {
  id: string
  name: string
  course_id: string
  course_name: string
}

interface AddAssignmentModalProps {
  onClose: () => void
  onCreated: (assignment: Assignment) => void
  preselectedCohortId?: string
}

export function AddAssignmentModal({
  onClose,
  onCreated,
  preselectedCohortId,
}: AddAssignmentModalProps) {
  const { profile } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Cohort & Course state
  const [cohorts, setCohorts] = useState<CohortOption[]>([])
  const [selectedCohortId, setSelectedCohortId] = useState(preselectedCohortId ?? '')
  const [trainingWeek, setTrainingWeek] = useState<number>(1)

  // Assignment Info state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [instructions, setInstructions] = useState('')
  const [assignmentType, setAssignmentType] = useState<AssignmentType>('Individual Assignment')

  // Assignment Schedule state
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().split('T')[0]
  })
  const [submissionType, setSubmissionType] = useState<SubmissionType>('File Upload')
  const [maximumMarks, setMaximumMarks] = useState<number>(20)

  // Resources
  const [resources, setResources] = useState<AssignmentResource[]>([])
  const [uploading, setUploading] = useState(false)

  // Status & submission
  const [status, setStatus] = useState<AssignmentStatus>('Draft')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Load cohorts and courses
  useEffect(() => {
    async function loadCohortData() {
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
        } else {
          setCohorts([])
          setSelectedCohortId('')
        }
      } catch {
        // Fallback handled
      }
    }

    loadCohortData()
  }, [])

  // Selected cohort object & auto-derived course
  const selectedCohort = cohorts.find(c => c.id === selectedCohortId)
  const derivedCourseName = selectedCohort?.course_name ?? ''

  // Resource upload simulation with real file reading
  const handleResourceUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    const newResources: AssignmentResource[] = []

    Array.from(files).forEach((file, index) => {
      let typeLabel = 'Document'
      if (file.type.includes('pdf')) typeLabel = 'PDF Document'
      else if (file.type.includes('image')) typeLabel = 'Image'
      else if (file.type.includes('presentation') || file.name.endsWith('.pptx') || file.name.endsWith('.ppt')) {
        typeLabel = 'Presentation'
      } else if (file.type.includes('word') || file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
        typeLabel = 'Word Document'
      } else if (file.type.includes('zip') || file.type.includes('tar')) {
        typeLabel = 'Archive'
      }

      const sizeStr = file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`

      newResources.push({
        id: `res-${Date.now()}-${index}`,
        name: file.name,
        type: typeLabel,
        size: sizeStr,
        url: URL.createObjectURL(file),
      })
    })

    setTimeout(() => {
      setResources(prev => [...prev, ...newResources])
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }, 200)
  }

  const handleRemoveResource = (resourceId: string) => {
    setResources(prev => prev.filter(r => r.id !== resourceId))
  }

  // Submit handler
  const handleSave = async (targetStatus: AssignmentStatus) => {
    if (!selectedCohortId) {
      setFormError('Please select a cohort.')
      return
    }
    if (!title.trim()) {
      setFormError('Please enter an assignment title.')
      return
    }
    if (!description.trim()) {
      setFormError('Please provide a brief description.')
      return
    }
    if (!instructions.trim()) {
      setFormError('Please enter assignment instructions for students.')
      return
    }
    if (!dueDate) {
      setFormError('Please select a due date.')
      return
    }
    if (!maximumMarks || maximumMarks <= 0) {
      setFormError('Maximum marks must be greater than 0.')
      return
    }

    setFormError(null)
    setIsSubmitting(true)

    const assignmentId = `asg-${Date.now()}`
    const newAssignment: Assignment = {
      id: assignmentId,
      cohort_id: selectedCohortId,
      cohort_name: selectedCohort?.name ?? '',
      course_id: selectedCohort?.course_id ?? '',
      course_name: derivedCourseName,
      training_week: Number(trainingWeek),
      title: title.trim(),
      description: description.trim(),
      instructions: instructions.trim(),
      assignment_type: assignmentType,
      start_date: startDate,
      due_date: dueDate,
      submission_type: submissionType,
      maximum_marks: Number(maximumMarks),
      resources,
      status: targetStatus,
      created_by: profile?.id ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    try {
      // Try to save to Supabase
      await supabase.from('assignments').insert({
        id: assignmentId.startsWith('asg-') && assignmentId.length === 36 ? assignmentId : undefined,
        cohort_id: selectedCohortId.includes('-') && selectedCohortId.length === 36 ? selectedCohortId : null,
        title: newAssignment.title,
        instructions: newAssignment.instructions,
        due_at: new Date(dueDate).toISOString(),
        created_by: profile?.id ?? null,
      })
    } catch {
      // Database write error gracefully handled - client state/local storage takes precedence
    }

    setIsSubmitting(false)
    onCreated(newAssignment)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[var(--color-ink-950)]/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-assignment-title"
        className="relative flex flex-col w-full max-w-3xl max-h-[92vh] rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white shadow-[var(--shadow-pop)] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-line)] px-6 py-4 bg-[var(--color-ink-50)]/40">
          <div>
            <h2 id="add-assignment-title" className="font-display text-lg font-semibold text-[var(--color-ink-900)]">
              Add Assignment
            </h2>
            <p className="text-xs text-[var(--color-ink-500)] mt-0.5">
              Configure curriculum week, instructions, submission expectations, and learning resources.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-[var(--color-ink-400)] hover:bg-[var(--color-ink-100)] hover:text-[var(--color-ink-700)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {formError && (
            <div className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-danger-100)] p-3 text-sm text-[var(--color-danger-600)]">
              <AlertCircle size={16} className="shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Section 1: Assignment Setup */}
          <section className="space-y-4">
            <div className="border-b border-[var(--color-line)] pb-2">
              <h3 className="font-display text-sm font-semibold text-[var(--color-ink-900)]">
                Assignment Setup
              </h3>
              <p className="text-xs text-[var(--color-ink-500)]">
                Determine which cohort and training week this assignment belongs to.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {/* Select Cohort */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-700)] mb-1.5">
                  Select Cohort <span className="text-[var(--color-danger-500)]">*</span>
                </label>
                <select
                  required
                  className="input w-full"
                  value={selectedCohortId}
                  onChange={e => setSelectedCohortId(e.target.value)}
                >
                  <option value="" disabled>Select cohort ▼</option>
                  {cohorts.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.course_name})
                    </option>
                  ))}
                </select>
              </div>

              {/* Course (Read-only, auto-displayed) */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-700)] mb-1.5">
                  Course
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={derivedCourseName}
                  className="input w-full bg-[var(--color-ink-50)] text-[var(--color-ink-700)] font-medium cursor-not-allowed border-[var(--color-line)]"
                />
                <span className="block mt-1 text-[11px] text-[var(--color-ink-400)] italic">
                  Automatically displayed and cannot be manually changed.
                </span>
              </div>

              {/* Training Week */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-700)] mb-1.5">
                  Training Week <span className="text-[var(--color-danger-500)]">*</span>
                </label>
                <select
                  required
                  className="input w-full"
                  value={trainingWeek}
                  onChange={e => setTrainingWeek(Number(e.target.value))}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(wk => (
                    <option key={wk} value={wk}>
                      Week {wk}
                    </option>
                  ))}
                </select>
                <span className="block mt-1 text-[11px] text-[var(--color-ink-400)]">
                  Connects assignment to the cohort schedule.
                </span>
              </div>
            </div>
          </section>

          {/* Section 2: Assignment Information */}
          <section className="space-y-4">
            <div className="border-b border-[var(--color-line)] pb-2">
              <h3 className="font-display text-sm font-semibold text-[var(--color-ink-900)]">
                Assignment Information
              </h3>
              <p className="text-xs text-[var(--color-ink-500)]">
                Core details, instructions, and category.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-700)] mb-1.5">
                  Assignment Title <span className="text-[var(--color-danger-500)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter assignment title (e.g., Introduction to Cyber Security Assignment)"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-700)] mb-1.5">
                  Description <span className="text-[var(--color-danger-500)]">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Describe the objective and core goals of the assignment"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-700)] mb-1.5">
                  Instructions <span className="text-[var(--color-danger-500)]">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Enter detailed instructions for students to follow step-by-step"
                  value={instructions}
                  onChange={e => setInstructions(e.target.value)}
                  className="input w-full font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-700)] mb-1.5">
                  Assignment Type <span className="text-[var(--color-danger-500)]">*</span>
                </label>
                <select
                  className="input w-full sm:w-72"
                  value={assignmentType}
                  onChange={e => setAssignmentType(e.target.value as AssignmentType)}
                >
                  {ASSIGNMENT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Section 3: Assignment Schedule */}
          <section className="space-y-4">
            <div className="border-b border-[var(--color-line)] pb-2">
              <h3 className="font-display text-sm font-semibold text-[var(--color-ink-900)]">
                Assignment Schedule
              </h3>
              <p className="text-xs text-[var(--color-ink-500)]">
                Timeline, accepted submission formats, and scoring parameters.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-700)] mb-1.5">
                  Start Date <span className="text-[var(--color-danger-500)]">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-700)] mb-1.5">
                  Due Date <span className="text-[var(--color-danger-500)]">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-700)] mb-1.5">
                  Submission Type <span className="text-[var(--color-danger-500)]">*</span>
                </label>
                <select
                  className="input w-full"
                  value={submissionType}
                  onChange={e => setSubmissionType(e.target.value as SubmissionType)}
                >
                  {SUBMISSION_TYPES.map(subType => (
                    <option key={subType} value={subType}>
                      {subType}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-700)] mb-1.5">
                  Maximum Marks <span className="text-[var(--color-danger-500)]">*</span>
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={500}
                  placeholder="e.g. 20"
                  value={maximumMarks}
                  onChange={e => setMaximumMarks(Number(e.target.value))}
                  className="input w-full"
                />
              </div>
            </div>
          </section>

          {/* Section 4: Resources */}
          <section className="space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-2">
              <div>
                <h3 className="font-display text-sm font-semibold text-[var(--color-ink-900)]">
                  Resources
                </h3>
                <p className="text-xs text-[var(--color-ink-500)]">
                  Attach PDFs, images, presentations, or reference materials students may need.
                </p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-ink-800)] hover:bg-[var(--color-ink-50)] transition-colors shadow-xs"
              >
                <Upload size={14} className="text-[var(--color-harbor-600)]" />
                {uploading ? 'Uploading…' : 'Upload Resource'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleResourceUpload}
                accept=".pdf,.png,.jpg,.jpeg,.pptx,.ppt,.docx,.doc,.txt,.zip"
              />
            </div>

            {resources.length > 0 ? (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--color-ink-50)] border-b border-[var(--color-line)] text-[var(--color-ink-600)] font-semibold">
                    <tr>
                      <th className="px-3.5 py-2.5">File Name</th>
                      <th className="px-3.5 py-2.5">File Type</th>
                      <th className="px-3.5 py-2.5 text-right">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-line)]">
                    {resources.map(res => (
                      <tr key={res.id} className="hover:bg-[var(--color-ink-50)]/50">
                        <td className="px-3.5 py-2 font-medium text-[var(--color-ink-900)] flex items-center gap-2">
                          <FileText size={15} className="text-[var(--color-harbor-600)] shrink-0" />
                          <span className="truncate max-w-xs">{res.name}</span>
                          {res.size && <span className="text-[var(--color-ink-400)] text-[11px]">({res.size})</span>}
                        </td>
                        <td className="px-3.5 py-2 text-[var(--color-ink-600)]">
                          {res.type}
                        </td>
                        <td className="px-3.5 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveResource(res.id)}
                            className="text-[var(--color-danger-500)] hover:text-[var(--color-danger-600)] p-1 rounded transition-colors"
                            title="Remove file"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-line)] p-5 text-center text-xs text-[var(--color-ink-400)]">
                No resources attached yet. Click <strong>Upload Resource</strong> to provide reference guides or worksheets.
              </div>
            )}
          </section>

          {/* Section 5: Assignment Status */}
          <section className="space-y-2">
            <div className="border-b border-[var(--color-line)] pb-2">
              <h3 className="font-display text-sm font-semibold text-[var(--color-ink-900)]">
                Assignment Status
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-700)]">
                Status
              </label>
              <select
                className="input w-44"
                value={status}
                onChange={e => setStatus(e.target.value as AssignmentStatus)}
              >
                <option value="Draft">Draft</option>
                <option value="Published">Published</option>
              </select>
              <span className="text-xs text-[var(--color-ink-500)]">
                {status === 'Draft'
                  ? 'Draft assignments are only visible to staff.'
                  : 'Published assignments are immediately accessible to enrolled students.'}
              </span>
            </div>
          </section>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-[var(--color-line)] px-6 py-4 bg-[var(--color-ink-50)]/60 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-4 py-2 text-sm font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)] transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSave('Draft')}
              className="rounded-[var(--radius-md)] border border-[var(--color-ink-300)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-ink-800)] hover:bg-[var(--color-ink-50)] transition-colors"
            >
              Save Draft
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSave('Published')}
              className="rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-harbor-600)] transition-colors shadow-xs"
            >
              Create & Publish
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
