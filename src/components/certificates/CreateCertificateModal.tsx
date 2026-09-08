import { useState, useEffect, useMemo, type ChangeEvent } from 'react'
import {
  Search,
  CheckCircle2,
  AlertCircle,
  Eye,
  ArrowLeft,
  Award,
  Upload,
  UserCheck,
  RotateCcw,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { CertificateCanvas } from './CertificateCanvas'
import {
  loadAvailableStudents,
  saveCertificate,
  getCalibrationSettings,
  saveCalibrationSettings,
  getCustomTemplateUrl,
  saveCustomTemplateUrl,
  resetCustomTemplateUrl,
  type CertificateTemplateSettings,
} from '@/lib/certificates'
import type { Certificate } from '@/types'

interface CreateCertificateModalProps {
  onClose: () => void
  onCertificateIssued: (cert: Certificate) => void
}

interface StudentRecord {
  id: string
  full_name: string
  email: string
  course: string
  cohort: string
}

export function CreateCertificateModal({
  onClose,
  onCertificateIssued,
}: CreateCertificateModalProps) {
  const [students, setStudents] = useState<StudentRecord[]>([])
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null)

  // Certificate template settings and custom template upload
  const [templateUrl, setTemplateUrl] = useState<string | null>(getCustomTemplateUrl())
  const [calibration, setCalibration] = useState<CertificateTemplateSettings>(
    getCalibrationSettings()
  )
  const [showCalibrationControls, setShowCalibrationControls] = useState(false)
  const [previewCleanMode, setPreviewCleanMode] = useState(false)

  // Issuance confirmation dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [issuing, setIssuing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load students on mount
  useEffect(() => {
    async function fetchStudents() {
      try {
        setLoadingStudents(true)
        const list = await loadAvailableStudents()
        setStudents(list)
        // By default pre-select Prince Abimbola Olashore if available for immediate visual feedback
        const defaultStudent =
          list.find((s) => s.full_name.toLowerCase().includes('olashore')) || list[0]
        if (defaultStudent) {
          setSelectedStudent(defaultStudent)
        }
      } catch (err) {
        console.warn('Failed to load students', err)
      } finally {
        setLoadingStudents(false)
      }
    }
    fetchStudents()
  }, [])

  // Filter students based on search
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students
    const q = searchQuery.toLowerCase()
    return students.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        s.course.toLowerCase().includes(q) ||
        s.cohort.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
    )
  }, [students, searchQuery])

  // Handle custom PDF or image upload
  const handleTemplateUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const result = event.target?.result as string
      if (result) {
        setTemplateUrl(result)
        saveCustomTemplateUrl(result)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleResetTemplate = () => {
    resetCustomTemplateUrl()
    setTemplateUrl(null)
  }

  // Handle Issue Certificate click
  const handleIssueClick = () => {
    if (!selectedStudent) {
      setError('Please select a student from the records first.')
      return
    }
    setError(null)
    setShowConfirmDialog(true)
  }

  // Confirm issuance
  const handleConfirmIssue = async () => {
    if (!selectedStudent) return
    try {
      setIssuing(true)
      const newCert = saveCertificate({
        student_id: selectedStudent.id,
        student_name: selectedStudent.full_name,
        course: selectedStudent.course || 'Artificial Intelligence Tools Mastery',
        cohort: selectedStudent.cohort || 'Cohort 2024-A',
        certificate_type: 'Certificate of Achievement',
        issue_date: new Date().toISOString().slice(0, 10),
        status: 'Issued',
        template_url: templateUrl || undefined,
      })

      // Save calibration settings
      saveCalibrationSettings(calibration)

      setShowConfirmDialog(false)
      onCertificateIssued(newCert)
    } catch (err) {
      setError('Failed to issue certificate. Please try again.')
      console.error(err)
    } finally {
      setIssuing(false)
    }
  }

  return (
    <>
      <Modal
        title="Create & Issue Certificate"
        onClose={onClose}
        className="max-w-6xl! w-[95vw]! p-0! overflow-hidden"
      >
        <div className="flex flex-col lg:flex-row h-[82vh] overflow-hidden bg-[var(--color-paper)]">
          {/* Left Column: Student Search & Selection + Auto-filled Data */}
          <div className="w-full lg:w-96 border-b lg:border-b-0 lg:border-r border-[var(--color-line)] bg-white flex flex-col h-full overflow-hidden">
            {/* Header & Search */}
            <div className="p-4 border-b border-[var(--color-line)] space-y-3">
              <div>
                <label className="text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wider block">
                  Select Student
                </label>
                <p className="text-xs text-[var(--color-ink-400)] mt-0.5">
                  Search existing student records to auto-populate the certificate.
                </p>
              </div>

              <div className="relative">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, course, or cohort..."
                  className="input pl-9 text-xs py-2 w-full"
                />
              </div>
            </div>

            {/* Students List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[var(--color-line)] scrollbar-thin">
              {loadingStudents ? (
                <div className="p-8 text-center text-xs text-[var(--color-ink-400)]">
                  Loading student roster...
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="p-8 text-center text-xs text-[var(--color-ink-400)]">
                  No matching student records found.
                </div>
              ) : (
                filteredStudents.map((student) => {
                  const isSelected = selectedStudent?.id === student.id
                  return (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => {
                        setSelectedStudent(student)
                        setError(null)
                      }}
                      className={`w-full text-left p-3 transition-colors flex items-start gap-3 hover:bg-[var(--color-ink-50)] ${
                        isSelected
                          ? 'bg-[var(--color-harbor-100)]/40 border-l-4 border-[var(--color-harbor-600)]'
                          : ''
                      }`}
                    >
                      <div
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          isSelected
                            ? 'bg-[var(--color-harbor-600)] text-white'
                            : 'bg-[var(--color-ink-100)] text-[var(--color-ink-700)]'
                        }`}
                      >
                        {student.full_name
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs font-semibold text-[var(--color-ink-900)] truncate">
                            {student.full_name}
                          </p>
                          {isSelected && (
                            <CheckCircle2
                              size={14}
                              className="text-[var(--color-harbor-600)] shrink-0"
                            />
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--color-ink-500)] truncate">
                          {student.course}
                        </p>
                        <p className="text-[10px] text-[var(--color-ink-400)] truncate mt-0.5">
                          {student.cohort}
                        </p>
                      </div>
                    </button>
                  )
                })
              )}
            </div>

            {/* Auto-populated details card (Rule: Do not ask admin to manually type student name) */}
            {selectedStudent && (
              <div className="p-4 bg-[var(--color-paper)] border-t border-[var(--color-line)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-500)] flex items-center gap-1.5">
                    <UserCheck size={13} className="text-[var(--color-success-600)]" />
                    Selected Record
                  </span>
                  <span className="text-[10px] bg-[var(--color-success-100)] text-[var(--color-success-600)] px-2 py-0.5 rounded-full font-medium">
                    Verified
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div>
                    <span className="text-[10px] text-[var(--color-ink-400)] block">Student Name</span>
                    <p className="font-semibold text-[var(--color-ink-900)]">
                      {selectedStudent.full_name}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[var(--color-line)]">
                    <div>
                      <span className="text-[10px] text-[var(--color-ink-400)] block">Course</span>
                      <p className="font-medium text-[var(--color-ink-700)] truncate text-[11px]">
                        {selectedStudent.course}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--color-ink-400)] block">Cohort</span>
                      <p className="font-medium text-[var(--color-ink-700)] truncate text-[11px]">
                        {selectedStudent.cohort}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Live Certificate Preview + White Space Editing Boundary */}
          <div className="flex-1 flex flex-col h-full overflow-y-auto">
            {/* Action Bar / Controls Header */}
            <div className="p-4 bg-white border-b border-[var(--color-line)] flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <Award size={18} className="text-[var(--color-harbor-600)]" />
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-ink-900)]">
                    Certificate Template Live Preview
                  </h3>
                  <p className="text-xs text-[var(--color-ink-500)]">
                    Original template with automatically positioned student name in Cinzel typography.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Toggle Preview Clean Mode */}
                <button
                  type="button"
                  onClick={() => setPreviewCleanMode((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[var(--radius-md)] border transition-colors ${
                    previewCleanMode
                      ? 'bg-[var(--color-ink-900)] text-white border-[var(--color-ink-900)]'
                      : 'bg-white text-[var(--color-ink-700)] border-[var(--color-line)] hover:bg-[var(--color-ink-50)]'
                  }`}
                  title="Toggle between editing boundaries and clean final view"
                >
                  <Eye size={13} />
                  {previewCleanMode ? 'Show Editing Guides' : 'Clean Preview'}
                </button>

                {/* Upload or change template if desired */}
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)] cursor-pointer">
                  <Upload size={13} />
                  <span>Upload Template</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleTemplateUpload}
                    className="hidden"
                  />
                </label>

                {templateUrl && (
                  <button
                    type="button"
                    onClick={handleResetTemplate}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-[var(--color-ink-500)] hover:text-[var(--color-danger-600)]"
                    title="Reset to default Ijesha Digital Hub template"
                  >
                    <RotateCcw size={12} />
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Error banner if any */}
            {error && (
              <div className="mx-6 mt-4 p-3 rounded-md bg-[var(--color-danger-100)] text-[var(--color-danger-600)] text-xs flex items-center gap-2">
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}

            {/* Preview Stage */}
            <div className="flex-1 p-6 flex items-center justify-center bg-[var(--color-ink-50)]/50">
              <div className="w-full max-w-4xl">
                <CertificateCanvas
                  studentName={selectedStudent?.full_name || 'SELECT A STUDENT'}
                  showEditBoundary={!previewCleanMode}
                  calibration={calibration}
                  templateUrl={templateUrl}
                  className="shadow-xl ring-1 ring-[var(--color-ink-900)]/10"
                />

                <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--color-ink-400)] px-1">
                  <span>
                    {!previewCleanMode ? (
                      <span className="inline-flex items-center gap-1.5 text-[var(--color-harbor-600)] font-medium">
                        <span className="h-2 w-2 rounded-full bg-[var(--color-harbor-600)] animate-pulse" />
                        Designated white space highlighted with dashed boundary
                      </span>
                    ) : (
                      <span className="text-[var(--color-success-600)] font-medium">
                        ✓ Clean Preview — Field outlines and guides removed for final issuance
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCalibrationControls((prev) => !prev)}
                    className="text-[var(--color-ink-500)] hover:text-[var(--color-harbor-600)] underline"
                  >
                    {showCalibrationControls ? 'Hide Fine Calibration' : 'Fine Calibrate Position'}
                  </button>
                </div>

                {/* Optional Calibration Drawer for micro-adjustments */}
                {showCalibrationControls && (
                  <div className="mt-4 p-4 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white text-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-2">
                      <span className="font-semibold text-[var(--color-ink-800)]">
                        Name Placement Fine Tuning
                      </span>
                      <button
                        type="button"
                        onClick={() => setCalibration(getCalibrationSettings())}
                        className="text-[11px] text-[var(--color-harbor-600)] hover:underline"
                      >
                        Reset Defaults
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[10px] text-[var(--color-ink-500)]">
                          Horizontal Center (%): {calibration.xPercent}
                        </label>
                        <input
                          type="range"
                          min="40"
                          max="80"
                          step="0.5"
                          value={calibration.xPercent}
                          onChange={(e) =>
                            setCalibration({ ...calibration, xPercent: parseFloat(e.target.value) })
                          }
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-[var(--color-ink-500)]">
                          Vertical Center (%): {calibration.yPercent}
                        </label>
                        <input
                          type="range"
                          min="35"
                          max="65"
                          step="0.5"
                          value={calibration.yPercent}
                          onChange={(e) =>
                            setCalibration({ ...calibration, yPercent: parseFloat(e.target.value) })
                          }
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-[var(--color-ink-500)]">
                          Base Font Size (pt): {calibration.fontSizePt}
                        </label>
                        <input
                          type="range"
                          min="18"
                          max="42"
                          step="1"
                          value={calibration.fontSizePt}
                          onChange={(e) =>
                            setCalibration({ ...calibration, fontSizePt: parseInt(e.target.value) })
                          }
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-[var(--color-ink-500)]">
                          Letter Spacing (px): {calibration.letterSpacingPx}
                        </label>
                        <input
                          type="range"
                          min="1"
                          max="8"
                          step="0.5"
                          value={calibration.letterSpacingPx}
                          onChange={(e) =>
                            setCalibration({
                              ...calibration,
                              letterSpacingPx: parseFloat(e.target.value),
                            })
                          }
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Footer Buttons */}
            <div className="p-4 bg-white border-t border-[var(--color-line)] flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-2 text-xs font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]"
              >
                <ArrowLeft size={14} />
                Go Back
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPreviewCleanMode(true)}
                  className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-2 text-xs font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]"
                >
                  Preview Clean
                </button>
                <button
                  type="button"
                  disabled={!selectedStudent}
                  onClick={handleIssueClick}
                  className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-harbor-600)] px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[var(--color-harbor-700)] disabled:opacity-50 disabled:pointer-events-none"
                >
                  <Award size={15} />
                  Issue Certificate
                </button>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Confirmation Modal (Rule: "Are you sure you want to issue this certificate to [Student Name]?") */}
      {showConfirmDialog && selectedStudent && (
        <Modal
          title="Confirm Certificate Issuance"
          onClose={() => setShowConfirmDialog(false)}
          className="max-w-md"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-harbor-100)]/40 border border-[var(--color-harbor-100)] text-[var(--color-harbor-700)]">
              <Award size={24} className="shrink-0" />
              <div>
                <p className="text-xs font-medium text-[var(--color-ink-600)]">
                  Certificate of Achievement
                </p>
                <p className="text-sm font-bold text-[var(--color-ink-900)]">
                  {selectedStudent.course}
                </p>
              </div>
            </div>

            <p className="text-sm text-[var(--color-ink-700)] leading-relaxed">
              Are you sure you want to issue this certificate to{' '}
              <strong className="text-[var(--color-ink-900)] font-bold">
                {selectedStudent.full_name}
              </strong>
              ?
            </p>

            <div className="rounded-md bg-[var(--color-paper)] p-3 text-xs space-y-1 text-[var(--color-ink-600)] border border-[var(--color-line)]">
              <div className="flex justify-between">
                <span>Student Name:</span>
                <span className="font-semibold text-[var(--color-ink-900)]">
                  {selectedStudent.full_name.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Cohort:</span>
                <span className="font-semibold text-[var(--color-ink-900)]">
                  {selectedStudent.cohort}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Issue Date:</span>
                <span className="font-semibold text-[var(--color-ink-900)]">
                  {new Date().toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-line)]">
              <button
                type="button"
                onClick={() => setShowConfirmDialog(false)}
                disabled={issuing}
                className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-2 text-xs font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={issuing}
                onClick={handleConfirmIssue}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-600)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-harbor-700)]"
              >
                {issuing ? 'Generating Real PDF…' : 'Issue Certificate'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
