import { useState } from 'react'
import {
  X,
  ArrowLeft,
  ArrowRight,
  Check,
  UploadCloud,
  Trash2,
  Save,
  Send,
  BookOpen,
  FolderKanban,
  Compass,
  Sparkles,
  Award,
  AlertCircle,
  File,
  CheckCircle2,
} from 'lucide-react'
import type {
  StudentReport,
  StudentReportType,
  ReportSection,
  ReportAttachment,
} from '@/lib/studentReports'
import {
  REPORT_TYPE_CONFIGS,
  saveStoredStudentReports,
  getStoredStudentReports,
} from '@/lib/studentReports'
import { sendReportPublishedNotification } from '@/lib/notifications'
import { useAuth } from '@/app/auth'
import { Badge, Avatar } from '@/components/ui/primitives'

interface CreateReportWizardProps {
  isOpen: boolean
  onClose: () => void
  onSaved: (report: StudentReport) => void
  initialReport?: StudentReport | null
}

const TYPE_ICONS: Record<StudentReportType, typeof BookOpen> = {
  'Learning Report': BookOpen,
  'Project Report': FolderKanban,
  'Training Report': Compass,
  'Reflection Report': Sparkles,
  'Achievement Report': Award,
}

export function CreateReportWizard({
  isOpen,
  onClose,
  onSaved,
  initialReport,
}: CreateReportWizardProps) {
  const { profile, session, user } = useAuth()

  // Current student fallback info
  const studentName = profile?.full_name || user?.name || 'Student'
  const studentEmail = session?.user?.email || profile?.organization || ''
  const studentAvatar = profile?.photo_path || ''
  const defaultCourse = 'Software Development'
  const defaultCohort = ''

  // Wizard Step: 1 = Type, 2 = Info, 3 = Content, 4 = Evidence, 5 = Preview, 6 = Success
  const [currentStep, setCurrentStep] = useState<number>(initialReport ? 3 : 1)

  // Form states
  const [selectedType, setSelectedType] = useState<StudentReportType>(
    initialReport?.type || 'Learning Report'
  )
  const [reportTitle, setReportTitle] = useState<string>(
    initialReport?.title || ''
  )
  const [course, setCourse] = useState<string>(initialReport?.course || defaultCourse)
  const [cohort, setCohort] = useState<string>(initialReport?.cohort || defaultCohort)
  const [trainingPeriod, setTrainingPeriod] = useState<string>(
    initialReport?.training_period || 'Aug 01, 2026 – Sep 07, 2026'
  )
  const [reportDate, setReportDate] = useState<string>(
    initialReport?.report_date ||
      new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  )

  // Sections
  const [sections, setSections] = useState<ReportSection[]>(() => {
    if (initialReport && initialReport.sections.length > 0) {
      return initialReport.sections
    }
    const config = REPORT_TYPE_CONFIGS['Learning Report']
    return config.defaultSections.map((s) => ({
      id: s.id,
      title: s.title,
      prompt: s.prompt,
      content: '',
    }))
  })

  // Attachments
  const [attachments, setAttachments] = useState<ReportAttachment[]>(
    initialReport?.attachments || []
  )

  // Confirmation modal state
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [draftSavedToast, setDraftSavedToast] = useState<string | null>(null)

  if (!isOpen) return null

  // Handle Type Change
  const handleSelectType = (type: StudentReportType) => {
    setSelectedType(type)
    const config = REPORT_TYPE_CONFIGS[type]
    setSections(
      config.defaultSections.map((s) => ({
        id: s.id,
        title: s.title,
        prompt: s.prompt,
        content: '',
      }))
    )
    if (!reportTitle || reportTitle === 'Untitled Report') {
      setReportTitle(`${type} — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`)
    }
    setCurrentStep(2)
  }

  // Handle Section Content Change
  const handleSectionChange = (id: string, value: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, content: value } : s))
    )
  }

  // Handle Save Draft
  const handleSaveDraft = () => {
    const existingReports = getStoredStudentReports()
    const reportId = initialReport?.id || `srep-${Date.now().toString().slice(-6)}`
    const draftTitle = reportTitle.trim() || `${selectedType} Draft`

    const draftReport: StudentReport = {
      id: reportId,
      student_id: profile?.id || session?.user?.id || 'std-collins',
      student_name: studentName,
      student_email: studentEmail,
      student_avatar: studentAvatar,
      title: draftTitle,
      type: selectedType,
      course,
      cohort,
      training_period: trainingPeriod,
      report_date: reportDate,
      status: 'Draft',
      sections,
      attachments,
      created_at: initialReport?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const index = existingReports.findIndex((r) => r.id === reportId)
    let updatedList: StudentReport[]
    if (index >= 0) {
      updatedList = existingReports.map((r) => (r.id === reportId ? draftReport : r))
    } else {
      updatedList = [draftReport, ...existingReports]
    }

    saveStoredStudentReports(updatedList)
    onSaved(draftReport)

    setDraftSavedToast('Draft saved successfully!')
    setTimeout(() => setDraftSavedToast(null), 3000)
  }

  // Handle Final Submit Confirmation
  const handleConfirmSubmit = () => {
    setIsSubmitting(true)
    setTimeout(() => {
      const existingReports = getStoredStudentReports()
      const reportId = initialReport?.id || `srep-${Date.now().toString().slice(-6)}`
      const finalTitle = reportTitle.trim() || `${selectedType}`

      const submittedReport: StudentReport = {
        id: reportId,
        student_id: profile?.id || session?.user?.id || 'std-collins',
        student_name: studentName,
        student_email: studentEmail,
        student_avatar: studentAvatar,
        title: finalTitle,
        type: selectedType,
        course,
        cohort,
        training_period: trainingPeriod,
        report_date: reportDate,
        status: 'Under Review',
        sections,
        attachments,
        created_at: initialReport?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        submitted_at: new Date().toISOString(),
      }

      const index = existingReports.findIndex((r) => r.id === reportId)
      let updatedList: StudentReport[]
      if (index >= 0) {
        updatedList = existingReports.map((r) => (r.id === reportId ? submittedReport : r))
      } else {
        updatedList = [submittedReport, ...existingReports]
      }

      saveStoredStudentReports(updatedList)
      sendReportPublishedNotification({
        studentId: submittedReport.student_id,
        studentName: submittedReport.student_name,
        courseName: submittedReport.course,
        reportId: submittedReport.id,
      })
      onSaved(submittedReport)
      setIsSubmitting(false)
      setShowConfirmSubmit(false)
      setCurrentStep(6) // Success state
    }, 600)
  }

  // File Upload Handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const newAttachments: ReportAttachment[] = Array.from(files).map((file) => {
      const sizeStr =
        file.size > 1024 * 1024
          ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
          : `${Math.round(file.size / 1024)} KB`

      return {
        id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: sizeStr,
        uploaded_at: new Date().toISOString(),
      }
    })

    setAttachments((prev) => [...prev, ...newAttachments])
    e.target.value = ''
  }

  const handleAddSampleEvidence = (sampleName: string, type: string, size: string) => {
    const newAtt: ReportAttachment = {
      id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: sampleName,
      type,
      size,
      uploaded_at: new Date().toISOString(),
    }
    setAttachments((prev) => [...prev, newAtt])
  }

  const handleRemoveAttachment = (attId: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== attId))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-line)] px-6 py-4 bg-[var(--color-ink-50)]">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded bg-[var(--color-harbor-100)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-harbor-700)]">
                Student Report Flow
              </span>
              <span className="text-xs text-[var(--color-ink-500)]">
                {currentStep < 6 ? `Step ${currentStep} of 5` : 'Submission Complete'}
              </span>
            </div>
            <h2 className="font-display text-lg font-bold text-[var(--color-ink-900)] mt-0.5">
              {currentStep === 1 && 'Step 1 — Select Report Type'}
              {currentStep === 2 && 'Step 2 — Report Information'}
              {currentStep === 3 && 'Step 3 — Report Content'}
              {currentStep === 4 && 'Step 4 — Evidence & Attachments'}
              {currentStep === 5 && 'Step 5 — Preview Report'}
              {currentStep === 6 && 'Report Submitted Successfully'}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {draftSavedToast && (
              <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 animate-fade-in flex items-center gap-1">
                <Check className="h-3 w-3" />
                {draftSavedToast}
              </span>
            )}
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-[var(--color-ink-400)] hover:bg-[var(--color-ink-200)] hover:text-[var(--color-ink-700)] transition-colors"
              title="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Stepper Progress Bar (Steps 1 to 5) */}
        {currentStep <= 5 && (
          <div className="bg-white border-b border-[var(--color-line)] px-6 py-2.5">
            <div className="flex items-center justify-between text-xs font-medium text-[var(--color-ink-500)]">
              {[
                { step: 1, label: 'Type' },
                { step: 2, label: 'Info' },
                { step: 3, label: 'Content' },
                { step: 4, label: 'Evidence' },
                { step: 5, label: 'Preview' },
              ].map((item) => (
                <div
                  key={item.step}
                  className={`flex items-center gap-1.5 ${
                    currentStep === item.step
                      ? 'text-[var(--color-harbor-600)] font-semibold'
                      : currentStep > item.step
                      ? 'text-emerald-600'
                      : 'text-[var(--color-ink-400)]'
                  }`}
                >
                  <span
                    className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${
                      currentStep === item.step
                        ? 'bg-[var(--color-harbor-500)] text-white'
                        : currentStep > item.step
                        ? 'bg-emerald-100 text-emerald-700 font-bold'
                        : 'bg-[var(--color-ink-100)] text-[var(--color-ink-500)]'
                    }`}
                  >
                    {currentStep > item.step ? '✓' : item.step}
                  </span>
                  <span className="hidden sm:inline">{item.label}</span>
                  {item.step < 5 && <span className="text-[var(--color-line)] sm:mx-2">›</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* STEP 1: Select Report Type */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-display text-base font-semibold text-[var(--color-ink-900)]">
                  Choose the type of report you want to submit
                </h3>
                <p className="text-sm text-[var(--color-ink-600)] mt-0.5">
                  Selecting a report type pre-configures specialized guiding sections and rubric criteria.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {(Object.keys(REPORT_TYPE_CONFIGS) as StudentReportType[]).map((typeKey) => {
                  const conf = REPORT_TYPE_CONFIGS[typeKey]
                  const Icon = TYPE_ICONS[typeKey]
                  const isSelected = selectedType === typeKey

                  return (
                    <button
                      key={typeKey}
                      type="button"
                      onClick={() => handleSelectType(typeKey)}
                      className={`text-left p-5 rounded-[var(--radius-lg)] border-2 transition-all flex items-start gap-4 ${
                        isSelected
                          ? 'border-[var(--color-harbor-500)] bg-[var(--color-harbor-50)]/50 shadow-xs'
                          : 'border-[var(--color-line)] bg-white hover:border-[var(--color-harbor-300)] hover:bg-[var(--color-ink-50)]'
                      }`}
                    >
                      <div
                        className={`h-11 w-11 rounded-[var(--radius-md)] flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-[var(--color-harbor-500)] text-white'
                            : 'bg-[var(--color-ink-100)] text-[var(--color-ink-700)]'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-display text-base font-semibold text-[var(--color-ink-900)]">
                            {conf.type}
                          </h4>
                          {isSelected && (
                            <span className="h-5 w-5 rounded-full bg-[var(--color-harbor-500)] text-white flex items-center justify-center text-xs">
                              ✓
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-[var(--color-ink-700)] mt-1 font-medium">
                          {conf.description}
                        </p>
                        <p className="text-xs text-[var(--color-ink-500)] mt-1 line-clamp-2">
                          {conf.tagline}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* STEP 2: Report Information */}
          {currentStep === 2 && (
            <div className="space-y-6">
              {/* Read-only Student Profile Box */}
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-ink-50)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Avatar
                    initials={studentName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'ST'}
                    src={studentAvatar}
                    size={48}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-sm font-semibold text-[var(--color-ink-900)]">
                        {studentName}
                      </span>
                      <span className="rounded bg-[var(--color-ink-200)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-700)]">
                        Enrolled Student (Read-Only)
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-ink-500)]">{studentEmail}</p>
                    <p className="text-xs font-medium text-[var(--color-harbor-700)] mt-0.5">
                      Assigned Course: {course} · Cohort: {cohort}
                    </p>
                  </div>
                </div>

                <div className="text-left sm:text-right text-xs text-[var(--color-ink-600)]">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-ink-400)] block">
                    Report Type
                  </span>
                  <Badge tone="harbor">{selectedType}</Badge>
                </div>
              </div>

              {/* Basic Information Inputs */}
              <div className="space-y-4">
                <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-[var(--color-ink-700)]">
                  Basic Information
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-[var(--color-ink-700)] mb-1">
                      Report Title <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={reportTitle}
                      onChange={(e) => setReportTitle(e.target.value)}
                      placeholder="e.g. My Training Report, Final Project Documentation, Milestone Reflection"
                      className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-ink-900)] focus:border-[var(--color-harbor-500)] focus:outline-none focus:ring-1 focus:ring-[var(--color-harbor-500)]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-ink-700)] mb-1">
                      Course <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={course}
                      onChange={(e) => setCourse(e.target.value)}
                      className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-ink-900)] focus:border-[var(--color-harbor-500)] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-ink-700)] mb-1">
                      Cohort <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={cohort}
                      onChange={(e) => setCohort(e.target.value)}
                      className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-ink-900)] focus:border-[var(--color-harbor-500)] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-ink-700)] mb-1">
                      Training Period <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={trainingPeriod}
                      onChange={(e) => setTrainingPeriod(e.target.value)}
                      placeholder="e.g. Aug 01, 2026 – Sep 07, 2026"
                      className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-ink-900)] focus:border-[var(--color-harbor-500)] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-ink-700)] mb-1">
                      Report Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={reportDate}
                      onChange={(e) => setReportDate(e.target.value)}
                      className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-ink-900)] focus:border-[var(--color-harbor-500)] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Report Content */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-[var(--color-line)] gap-2">
                <div>
                  <h3 className="font-display text-base font-semibold text-[var(--color-ink-900)]">
                    Document Content Editor
                  </h3>
                  <p className="text-xs text-[var(--color-ink-500)]">
                    Complete each document section thoroughly. Your trainer uses these responses during review.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]"
                >
                  <Save className="h-3.5 w-3.5 text-[var(--color-ink-500)]" />
                  Save Draft
                </button>
              </div>

              {/* Sections Editor */}
              <div className="space-y-5">
                {sections.map((section, idx) => (
                  <div
                    key={section.id}
                    className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-4.5 space-y-2 shadow-2xs"
                  >
                    <div className="flex items-baseline justify-between">
                      <h4 className="font-display text-sm font-semibold text-[var(--color-ink-900)] flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded bg-[var(--color-harbor-100)] text-[11px] font-bold text-[var(--color-harbor-700)]">
                          {idx + 1}
                        </span>
                        {section.title}
                      </h4>
                      <span className="text-[11px] text-[var(--color-ink-400)] font-mono">
                        {section.content.length} chars
                      </span>
                    </div>

                    <p className="text-xs text-[var(--color-ink-500)] italic pl-7">
                      "{section.prompt}"
                    </p>

                    <div className="pl-7 pt-1">
                      <textarea
                        rows={4}
                        value={section.content}
                        onChange={(e) => handleSectionChange(section.id, e.target.value)}
                        placeholder={`Write your ${section.title.toLowerCase()} here...`}
                        className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] p-3 text-sm text-[var(--color-ink-900)] focus:border-[var(--color-harbor-500)] focus:outline-none focus:ring-1 focus:ring-[var(--color-harbor-500)] leading-relaxed"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4: Evidence & Attachments */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-[var(--color-line)] gap-2">
                <div>
                  <h3 className="font-display text-base font-semibold text-[var(--color-ink-900)]">
                    Add Evidence & Supporting Materials
                  </h3>
                  <p className="text-xs text-[var(--color-ink-500)]">
                    Attach project files, screenshots, benchmark documentation, or presentations.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]"
                >
                  <Save className="h-3.5 w-3.5 text-[var(--color-ink-500)]" />
                  Save Draft
                </button>
              </div>

              {/* Upload Dropzone */}
              <div className="relative rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-line)] bg-[var(--color-ink-50)]/50 p-8 text-center hover:bg-[var(--color-ink-50)] transition-colors">
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  title="Drop or select files"
                />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="rounded-full bg-[var(--color-harbor-100)] p-3 text-[var(--color-harbor-600)]">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <div className="text-sm font-semibold text-[var(--color-ink-800)]">
                    Click to browse or drag and drop files here
                  </div>
                  <p className="text-xs text-[var(--color-ink-500)]">
                    Supports PDF, PNG, JPG, ZIP, DOCX, MD (up to 25MB per file)
                  </p>
                </div>
              </div>

              {/* Quick sample add buttons for convenience */}
              <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-3 space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-500)] block">
                  Quick Attach Evidence Templates
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleAddSampleEvidence('architecture-diagram.png', 'image/png', '480 KB')
                    }
                    className="rounded border border-[var(--color-line)] bg-[var(--color-ink-50)] px-2.5 py-1 text-xs font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-harbor-50)] hover:border-[var(--color-harbor-300)] transition-colors"
                  >
                    + Architecture Diagram (PNG)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleAddSampleEvidence('lab-wireshark-pcap.pdf', 'application/pdf', '1.4 MB')
                    }
                    className="rounded border border-[var(--color-line)] bg-[var(--color-ink-50)] px-2.5 py-1 text-xs font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-harbor-50)] hover:border-[var(--color-harbor-300)] transition-colors"
                  >
                    + Lab Packet Inspection (PDF)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleAddSampleEvidence('project-demo-slides.pdf', 'application/pdf', '3.1 MB')
                    }
                    className="rounded border border-[var(--color-line)] bg-[var(--color-ink-50)] px-2.5 py-1 text-xs font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-harbor-50)] hover:border-[var(--color-harbor-300)] transition-colors"
                  >
                    + Presentation Slides (PDF)
                  </button>
                </div>
              </div>

              {/* Uploaded Files Table */}
              <div className="space-y-2">
                <h4 className="font-display text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-700)]">
                  Attached Files ({attachments.length})
                </h4>

                {attachments.length === 0 ? (
                  <p className="text-xs text-[var(--color-ink-400)] italic py-3">
                    No files attached yet. You may proceed without attachments or add evidence above.
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-[var(--color-line)] bg-[var(--color-ink-50)] text-[11px] font-semibold text-[var(--color-ink-600)]">
                        <tr>
                          <th className="px-3.5 py-2.5">File name</th>
                          <th className="px-3.5 py-2.5">Type</th>
                          <th className="px-3.5 py-2.5">Size</th>
                          <th className="px-3.5 py-2.5 text-right">Remove</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-line)]">
                        {attachments.map((file) => (
                          <tr key={file.id} className="hover:bg-[var(--color-ink-50)]">
                            <td className="px-3.5 py-2.5 font-medium text-[var(--color-ink-900)] flex items-center gap-2">
                              <File className="h-4 w-4 text-[var(--color-harbor-500)] shrink-0" />
                              <span className="truncate max-w-xs">{file.name}</span>
                            </td>
                            <td className="px-3.5 py-2.5 text-[var(--color-ink-600)]">
                              {file.type}
                            </td>
                            <td className="px-3.5 py-2.5 font-mono text-[var(--color-ink-600)]">
                              {file.size}
                            </td>
                            <td className="px-3.5 py-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveAttachment(file.id)}
                                className="text-rose-600 hover:text-rose-800 p-1 rounded hover:bg-rose-50 transition-colors"
                                title="Remove file"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 5: Preview Report */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div className="rounded-[var(--radius-lg)] border-2 border-[var(--color-line)] bg-white p-6 shadow-xs space-y-6">
                {/* Formal Document Header */}
                <div className="border-b-2 border-[var(--color-ink-900)] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold tracking-widest uppercase text-[var(--color-harbor-700)] block">
                      Official Training Submission
                    </span>
                    <h1 className="font-display text-xl sm:text-2xl font-bold text-[var(--color-ink-900)]">
                      Student Report
                    </h1>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                      🟡 Ready for Submission
                    </span>
                  </div>
                </div>

                {/* Student Information Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[var(--color-ink-50)] p-4 rounded-[var(--radius-md)] text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-[var(--color-ink-400)] block">
                      Student Name
                    </span>
                    <span className="font-semibold text-[var(--color-ink-900)]">{studentName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-[var(--color-ink-400)] block">
                      Course & Cohort
                    </span>
                    <span className="font-medium text-[var(--color-ink-800)]">
                      {course} · {cohort}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-[var(--color-ink-400)] block">
                      Report Type
                    </span>
                    <span className="font-medium text-[var(--color-harbor-700)]">
                      {selectedType}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-[var(--color-ink-400)] block">
                      Report Date
                    </span>
                    <span className="font-mono text-[var(--color-ink-700)]">{reportDate}</span>
                  </div>
                </div>

                {/* Report Title */}
                <div>
                  <h2 className="font-display text-lg font-bold text-[var(--color-ink-900)]">
                    {reportTitle || 'Untitled Report'}
                  </h2>
                  <p className="text-xs text-[var(--color-ink-500)] mt-0.5">
                    Training period: {trainingPeriod}
                  </p>
                </div>

                {/* Completed Sections */}
                <div className="space-y-6 pt-2">
                  {sections.map((sec, idx) => (
                    <div key={sec.id} className="space-y-1.5 border-b border-[var(--color-line)] pb-4">
                      <h3 className="font-display text-sm font-semibold text-[var(--color-ink-900)]">
                        {idx + 1}. {sec.title}
                      </h3>
                      <p className="text-xs text-[var(--color-ink-500)] italic">
                        "{sec.prompt}"
                      </p>
                      <p className="text-sm text-[var(--color-ink-800)] whitespace-pre-wrap leading-relaxed pt-1">
                        {sec.content.trim() || (
                          <span className="text-[var(--color-ink-400)] italic">
                            No response provided for this section.
                          </span>
                        )}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Attached Evidence in Preview */}
                {attachments.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-700)]">
                      Attached Evidence & Deliverables ({attachments.length})
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {attachments.map((file) => (
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
              </div>
            </div>
          )}

          {/* STEP 6: Success State */}
          {currentStep === 6 && (
            <div className="py-8 text-center space-y-4 max-w-md mx-auto">
              <div className="h-16 w-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-9 w-9" />
              </div>

              <div className="space-y-1">
                <h3 className="font-display text-xl font-bold text-[var(--color-ink-900)]">
                  Report submitted successfully
                </h3>
                <p className="text-sm text-[var(--color-ink-600)]">
                  Your report has been securely registered and dispatched to your course trainer for evaluation.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3.5 py-1.5 border border-amber-200 text-xs font-semibold text-amber-800">
                <span>🟡</span>
                <span>Status: Under Review</span>
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-[var(--color-harbor-600)] transition-colors"
                >
                  Return to Reports Dashboard
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Actions Bar (Steps 1 to 5) */}
        {currentStep <= 5 && (
          <div className="flex flex-wrap items-center justify-between border-t border-[var(--color-line)] px-6 py-4 bg-[var(--color-ink-50)] gap-3">
            <div>
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep((prev) => prev - 1)}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3.5 py-2 text-xs font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-ink-100)]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3.5 py-2 text-xs font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-ink-100)]"
                >
                  Cancel
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              {currentStep >= 2 && currentStep <= 5 && (
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3.5 py-2 text-xs font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-ink-100)]"
                >
                  <Save className="h-3.5 w-3.5" />
                  Save as Draft
                </button>
              )}

              {currentStep < 5 && (
                <button
                  type="button"
                  onClick={() => {
                    if (currentStep === 1) {
                      setCurrentStep(2)
                    } else if (currentStep === 2) {
                      if (!reportTitle.trim()) {
                        setReportTitle(`${selectedType} — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`)
                      }
                      setCurrentStep(3)
                    } else if (currentStep === 3) {
                      setCurrentStep(4)
                    } else if (currentStep === 4) {
                      setCurrentStep(5)
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[var(--color-harbor-600)] transition-colors"
                >
                  Continue
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}

              {currentStep === 5 && (
                <button
                  type="button"
                  onClick={() => setShowConfirmSubmit(true)}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-4.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[var(--color-harbor-600)] transition-colors"
                >
                  <Send className="h-3.5 w-3.5" />
                  Submit Report
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* SUBMISSION CONFIRMATION MODAL (Requirement 7) */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-amber-100 p-2 text-amber-700 shrink-0">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-display text-base font-bold text-[var(--color-ink-900)]">
                  Submit Report?
                </h3>
                <p className="text-xs text-[var(--color-ink-600)] leading-relaxed">
                  Once submitted, the report will be sent to your trainer for review. You will not be able to edit sections until a trainer evaluates or returns the report.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--color-line)]">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowConfirmSubmit(false)}
                className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3.5 py-2 text-xs font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmSubmit}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-harbor-600)] shadow-xs transition-colors"
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
