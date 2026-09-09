import { useState } from 'react'
import {
  Download,
  Printer,
  Share2,
  ArrowLeft,
  Check,
  Award,
  Calendar,
  Layers,
  BookOpen,
  User,
  CheckCircle2,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/primitives'
import { CertificateCanvas } from './CertificateCanvas'
import {
  downloadCertificatePdf,
  printCertificate,
  DEFAULT_CALIBRATION,
  getCertificateFileName,
} from '@/lib/certificates'
import type { Certificate } from '@/types'

interface CertificateDetailModalProps {
  certificate: Certificate
  onClose: () => void
}

export function CertificateDetailModal({
  certificate,
  onClose,
}: CertificateDetailModalProps) {
  const [downloading, setDownloading] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [copied, setCopied] = useState(false)
  const calibration = certificate.calibration ?? DEFAULT_CALIBRATION
  const templateUrl = certificate.template_url || '/certificate-template.jpg'

  const handleDownload = async () => {
    try {
      setDownloading(true)
      await downloadCertificatePdf(
        certificate.student_name,
        calibration,
        templateUrl
      )
    } catch (err) {
      console.error('Download failed', err)
    } finally {
      setDownloading(false)
    }
  }

  const handlePrint = async () => {
    try {
      setPrinting(true)
      await printCertificate(
        certificate.student_name,
        calibration,
        templateUrl
      )
    } catch (err) {
      console.error('Print failed', err)
    } finally {
      setPrinting(false)
    }
  }

  const handleShare = async () => {
    const shareData = {
      title: `${certificate.student_name} - ${certificate.certificate_type}`,
      text: `Official Certificate of Achievement awarded to ${certificate.student_name} for completing ${certificate.course} at Ijesha Digital Hub.`,
      url: window.location.href,
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData)
        return
      } catch {}
    }

    // Fallback: Copy link
    try {
      await navigator.clipboard.writeText(
        `${shareData.title}\n${shareData.text}\nIssued: ${certificate.issue_date}`
      )
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch {}
  }

  const formattedDate = new Date(certificate.issue_date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <Modal
      title="Certificate Details"
      onClose={onClose}
      className="max-w-5xl! w-[95vw]! p-0! overflow-hidden"
    >
      <div className="flex flex-col h-[82vh] overflow-y-auto bg-[var(--color-paper)]">
        {/* Top Summary & Actions Bar */}
        <div className="p-4 bg-white border-b border-[var(--color-line)] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-harbor-100)] text-[var(--color-harbor-600)]">
              <Award size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[var(--color-ink-900)]">
                  {certificate.student_name}
                </h2>
                <Badge tone="success" className="gap-1">
                  <CheckCircle2 size={11} />
                  {certificate.status}
                </Badge>
              </div>
              <p className="text-xs text-[var(--color-ink-500)]">
                {certificate.certificate_type} · {certificate.course}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-600)] px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[var(--color-harbor-700)] disabled:opacity-50"
              title={`Download ${getCertificateFileName(certificate.student_name)}`}
            >
              <Download size={14} />
              {downloading ? 'Preparing PDF…' : 'Download PDF'}
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={printing}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3.5 py-2 text-xs font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]"
            >
              <Printer size={14} />
              {printing ? 'Preparing…' : 'Print'}
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3.5 py-2 text-xs font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]"
            >
              {copied ? <Check size={14} className="text-[var(--color-success-600)]" /> : <Share2 size={14} />}
              {copied ? 'Copied Details' : 'Share'}
            </button>
          </div>
        </div>

        {/* Metadata Details Grid (No internal database IDs anywhere) */}
        <div className="p-4 bg-white border-b border-[var(--color-line)]">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="flex items-start gap-2.5">
              <User size={15} className="text-[var(--color-ink-400)] shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] text-[var(--color-ink-400)] uppercase tracking-wider block">
                  Student Name
                </span>
                <span className="font-semibold text-[var(--color-ink-900)]">
                  {certificate.student_name}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <BookOpen size={15} className="text-[var(--color-ink-400)] shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] text-[var(--color-ink-400)] uppercase tracking-wider block">
                  Course
                </span>
                <span className="font-semibold text-[var(--color-ink-900)]">
                  {certificate.course}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Layers size={15} className="text-[var(--color-ink-400)] shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] text-[var(--color-ink-400)] uppercase tracking-wider block">
                  Cohort
                </span>
                <span className="font-semibold text-[var(--color-ink-900)]">
                  {certificate.cohort}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Calendar size={15} className="text-[var(--color-ink-400)] shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] text-[var(--color-ink-400)] uppercase tracking-wider block">
                  Issue Date
                </span>
                <span className="font-semibold text-[var(--color-ink-900)]">
                  {formattedDate}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Certificate Preview (Clean, Final View with NO edit boundaries or outlines) */}
        <div className="flex-1 p-6 flex flex-col items-center justify-center bg-[var(--color-ink-50)]/40">
          <div className="w-full max-w-4xl space-y-2">
            <div className="flex items-center justify-between text-xs text-[var(--color-ink-500)] px-1">
              <span className="font-medium text-[var(--color-ink-700)]">
                Certificate Preview
              </span>
              <span className="text-[11px] text-[var(--color-ink-400)]">
                High-Resolution Landscape View · Real PDF Ready
              </span>
            </div>

            <CertificateCanvas
              studentName={certificate.student_name}
              showEditBoundary={false}
              calibration={calibration}
              templateUrl={templateUrl}
              className="shadow-2xl ring-1 ring-[var(--color-ink-900)]/10"
            />
          </div>
        </div>

        {/* Bottom Back Action */}
        <div className="p-4 bg-white border-t border-[var(--color-line)] flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-2 text-xs font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]"
          >
            <ArrowLeft size={14} />
            Back to Certificates
          </button>

          <div className="text-xs text-[var(--color-ink-400)]">
            Official Document · Ijesha Digital Hub & IGAD
          </div>
        </div>
      </div>
    </Modal>
  )
}
