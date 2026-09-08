import { jsPDF } from 'jspdf'
import type { Certificate } from '@/types'
import { supabase, supabaseConfigured } from '@/lib/supabase'

export const CERTIFICATE_STORAGE_KEY = 'ijesha_digital_hub_certificates'
export const TEMPLATE_STORAGE_KEY = 'ijesha_digital_hub_certificate_template'
export const CALIBRATION_STORAGE_KEY = 'ijesha_digital_hub_cert_calibration'

export interface CertificateTemplateSettings {
  xPercent: number // e.g. 61.5%
  yPercent: number // e.g. 50.0%
  widthPercent: number // e.g. 52%
  heightPercent: number // e.g. 8%
  fontSizePt: number // e.g. 32pt
  letterSpacingPx: number // e.g. 3
  color: string // e.g. '#10192B'
}

export const DEFAULT_CALIBRATION: CertificateTemplateSettings = {
  xPercent: 61.5,
  yPercent: 49.5,
  widthPercent: 52,
  heightPercent: 7.5,
  fontSizePt: 28,
  letterSpacingPx: 3.5,
  color: '#10192B',
}

export const INITIAL_CERTIFICATES: Certificate[] = []

export const FALLBACK_STUDENTS: Array<{
  id: string
  full_name: string
  email: string
  course: string
  cohort: string
}> = []

export function getStoredCertificates(): Certificate[] {
  try {
    const raw = localStorage.getItem(CERTIFICATE_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Certificate[]
      if (Array.isArray(parsed)) {
        return parsed
      }
    }
  } catch (err) {
    console.warn('Could not read certificates from localStorage', err)
  }
  return []
}

export function saveCertificate(certData: Omit<Certificate, 'id' | 'created_at'>): Certificate {
  const current = getStoredCertificates()
  const newCert: Certificate = {
    ...certData,
    id: `cert-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    created_at: new Date().toISOString(),
  }
  const updated = [newCert, ...current]
  try {
    localStorage.setItem(CERTIFICATE_STORAGE_KEY, JSON.stringify(updated))
  } catch (err) {
    console.warn('Could not save certificate to localStorage', err)
  }
  return newCert
}

export function getCertificateById(id: string): Certificate | null {
  const list = getStoredCertificates()
  return list.find((c) => c.id === id) || null
}

export function deleteCertificate(id: string): void {
  const current = getStoredCertificates()
  const updated = current.filter((c) => c.id !== id)
  try {
    localStorage.setItem(CERTIFICATE_STORAGE_KEY, JSON.stringify(updated))
  } catch (err) {
    console.warn('Could not update certificates in localStorage', err)
  }
}

export function getCalibrationSettings(): CertificateTemplateSettings {
  try {
    const raw = localStorage.getItem(CALIBRATION_STORAGE_KEY)
    if (raw) {
      return { ...DEFAULT_CALIBRATION, ...JSON.parse(raw) }
    }
  } catch {}
  return DEFAULT_CALIBRATION
}

export function saveCalibrationSettings(settings: Partial<CertificateTemplateSettings>): void {
  try {
    const current = getCalibrationSettings()
    const updated = { ...current, ...settings }
    localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(updated))
  } catch {}
}

export function getCustomTemplateUrl(): string | null {
  try {
    return localStorage.getItem(TEMPLATE_STORAGE_KEY) || null
  } catch {
    return null
  }
}

export function saveCustomTemplateUrl(urlOrBase64: string): void {
  try {
    localStorage.setItem(TEMPLATE_STORAGE_KEY, urlOrBase64)
  } catch {}
}

export function resetCustomTemplateUrl(): void {
  try {
    localStorage.removeItem(TEMPLATE_STORAGE_KEY)
  } catch {}
}

/**
 * Loads available students from Supabase (if configured)
 */
export async function loadAvailableStudents(): Promise<Array<{
  id: string
  full_name: string
  email: string
  course: string
  cohort: string
}>> {
  if (supabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('id, full_name, email, track, cohort')
        .order('full_name', { ascending: true })

      if (!error && data && data.length > 0) {
        return data.map((s) => ({
          id: s.id,
          full_name: s.full_name,
          email: s.email ?? '',
          course: s.track || 'Unassigned Track',
          cohort: s.cohort || 'Unassigned Cohort',
        }))
      }
    } catch (err) {
      console.warn('Could not query Supabase for students', err)
    }
  }
  return []
}

/**
 * Creates a clean, safe filename from student's name
 * e.g. "Prince Abimbola Olashore" -> "Prince_Abimbola_Olashore_Certificate.pdf"
 * Rule: Do not include internal database IDs anywhere in the certificate, filename, or UI.
 */
export function getCertificateFileName(studentName: string): string {
  const safeName = studentName
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '_')
  return `${safeName || 'Student'}_Certificate.pdf`
}

/**
 * Generates a real high-resolution PDF certificate using jsPDF and Canvas
 */
export async function generateCertificatePdfBlob(
  studentName: string,
  calibration = DEFAULT_CALIBRATION,
  customImageUrl?: string | null
): Promise<{ blob: Blob; dataUrl: string }> {
  // Ensure Cinzel font is loaded in browser
  try {
    if (document.fonts) {
      await document.fonts.load('bold 48px Cinzel')
    }
  } catch {}

  // Standard landscape high-res canvas (2400 x 1610, ~1.49 aspect ratio)
  const canvas = document.createElement('canvas')
  const width = 2400
  const height = 1610
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not obtain 2D canvas context')

  // Load template image
  const templateSrc = customImageUrl || getCustomTemplateUrl() || '/certificate-template.jpg'
  const img = new Image()
  img.crossOrigin = 'anonymous'

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => {
      // If custom fails, fallback to default template
      if (templateSrc !== '/certificate-template.jpg') {
        img.src = '/certificate-template.jpg'
      } else {
        reject(new Error('Failed to load certificate template'))
      }
    }
    img.src = templateSrc
  })

  // 1. Draw original template background
  ctx.drawImage(img, 0, 0, width, height)

  // 2. Prepare student name typography
  // Rule: Font family: Cinzel, Font weight: 600-700, Centered, Uppercase, Slightly increased letter spacing
  const upperName = studentName.trim().toUpperCase()
  const centerX = (calibration.xPercent / 100) * width
  const centerY = (calibration.yPercent / 100) * height
  const maxAllowedWidth = (calibration.widthPercent / 100) * width

  // Auto-scale font size dynamically so long names never overflow the designated white space
  let baseFontSize = (calibration.fontSizePt * (width / 1000)) * 1.5 // calibrated to canvas scale
  ctx.font = `700 ${baseFontSize}px 'Cinzel', serif`

  // Measure text width with letter spacing consideration
  let measured = ctx.measureText(upperName).width
  if (measured > maxAllowedWidth) {
    const scaleFactor = (maxAllowedWidth * 0.95) / measured
    baseFontSize = Math.max(24, Math.floor(baseFontSize * scaleFactor))
    ctx.font = `700 ${baseFontSize}px 'Cinzel', serif`
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = calibration.color || '#10192B'

  // Apply letter-spacing if supported on Canvas context, or manual spacing fallback
  const anyCtx = ctx as unknown as { letterSpacing?: string }
  if (anyCtx && 'letterSpacing' in anyCtx) {
    anyCtx.letterSpacing = `${calibration.letterSpacingPx * 2.2}px`
    ctx.fillText(upperName, centerX, centerY)
  } else {
    // Manual centered spaced text
    const spacing = calibration.letterSpacingPx * 2.2
    const totalLength = upperName.length
    let totalWidth = 0
    for (let i = 0; i < totalLength; i++) {
      totalWidth += ctx.measureText(upperName[i]).width + (i < totalLength - 1 ? spacing : 0)
    }
    let currentX = centerX - totalWidth / 2
    for (let i = 0; i < totalLength; i++) {
      const char = upperName[i]
      const charWidth = ctx.measureText(char).width
      ctx.fillText(char, currentX + charWidth / 2, centerY)
      currentX += charWidth + spacing
    }
  }

  // 3. Convert to high-resolution JPEG Data URL
  const dataUrl = canvas.toDataURL('image/jpeg', 0.98)

  // 4. Generate PDF using jsPDF (A4 Landscape: 297mm x 210mm)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  doc.addImage(dataUrl, 'JPEG', 0, 0, 297, 210)
  const blob = doc.output('blob')

  return { blob, dataUrl }
}

/**
 * Triggers native download of the certificate PDF
 */
export async function downloadCertificatePdf(
  studentName: string,
  calibration?: CertificateTemplateSettings,
  customImageUrl?: string | null
): Promise<void> {
  const { blob } = await generateCertificatePdfBlob(studentName, calibration, customImageUrl)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = getCertificateFileName(studentName)
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/**
 * Triggers high-res browser print
 */
export async function printCertificate(
  studentName: string,
  calibration?: CertificateTemplateSettings,
  customImageUrl?: string | null
): Promise<void> {
  const { dataUrl } = await generateCertificatePdfBlob(studentName, calibration, customImageUrl)
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    // Fallback if popup blocker is active
    window.print()
    return
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${studentName} - Certificate</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #fff;
            height: 100vh;
          }
          img {
            width: 100vw;
            height: 100vh;
            object-fit: contain;
          }
        </style>
      </head>
      <body>
        <img src="${dataUrl}" onload="window.print(); window.close();" />
      </body>
    </html>
  `)
  printWindow.document.close()
}
