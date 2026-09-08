import { useEffect, useRef, useState } from 'react'
import {
  type CertificateTemplateSettings,
  DEFAULT_CALIBRATION,
  generateCertificatePdfBlob,
} from '@/lib/certificates'

interface CertificateCanvasProps {
  studentName: string
  showEditBoundary?: boolean
  calibration?: CertificateTemplateSettings
  templateUrl?: string | null
  className?: string
  onRenderReady?: (dataUrl: string) => void
}

export function CertificateCanvas({
  studentName,
  showEditBoundary = false,
  calibration = DEFAULT_CALIBRATION,
  templateUrl,
  className = '',
  onRenderReady,
}: CertificateCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [aspectRatio] = useState(1.4905) // Standard certificate template ratio (1264x848)
  const [containerWidth, setContainerWidth] = useState(800)

  // Dynamically calculate responsive font size based on container width and name length
  const displayName = (studentName || 'STUDENT NAME').trim().toUpperCase()
  const nameLength = displayName.length

  // Measure container width for fluid scaling
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setContainerWidth(entries[0].contentRect.width)
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Calculate scaled font size in px
  // At 1000px container width, default base size is ~26px
  let scaledFontSize = (containerWidth / 1000) * (calibration.fontSizePt || 28)
  if (nameLength > 24) {
    // Scale down for very long names so they never overflow
    scaledFontSize *= Math.max(0.65, 24 / nameLength)
  } else if (nameLength > 18) {
    scaledFontSize *= Math.max(0.82, 18 / nameLength)
  }

  const bgSource = templateUrl || '/certificate-template.jpg'

  // Pre-generate high res render if needed
  useEffect(() => {
    let active = true
    if (studentName && onRenderReady) {
      generateCertificatePdfBlob(studentName, calibration, templateUrl)
        .then(({ dataUrl }) => {
          if (active && onRenderReady) onRenderReady(dataUrl)
        })
        .catch(() => {})
    }
    return () => {
      active = false
    }
  }, [studentName, calibration, templateUrl, onRenderReady])

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden select-none shadow-lg rounded-sm bg-white ${className}`}
      style={{
        aspectRatio: `${aspectRatio}`,
      }}
    >
      {/* 1. Original Certificate Template Background */}
      <img
        src={bgSource}
        alt="Certificate Template"
        className="absolute inset-0 h-full w-full object-cover pointer-events-none"
        crossOrigin="anonymous"
      />

      {/* 2. Designated White Space — Student Name */}
      <div
        style={{
          position: 'absolute',
          left: `${calibration.xPercent}%`,
          top: `${calibration.yPercent}%`,
          width: `${calibration.widthPercent}%`,
          height: `${calibration.heightPercent}%`,
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        className={`transition-all ${
          showEditBoundary
            ? 'border-2 border-dashed border-[var(--color-harbor-500)] bg-[var(--color-harbor-100)]/25 rounded'
            : 'border-0 bg-transparent'
        }`}
      >
        {showEditBoundary && (
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded bg-[var(--color-harbor-600)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-xs">
            Student Name Field
          </span>
        )}

        <div
          className="w-full text-center truncate px-2"
          style={{
            fontFamily: "'Cinzel', serif",
            fontWeight: 700,
            color: calibration.color || '#10192B',
            fontSize: `${Math.max(11, Math.round(scaledFontSize))}px`,
            letterSpacing: `${Math.max(1, (scaledFontSize / 20) * calibration.letterSpacingPx)}px`,
            lineHeight: 1.2,
            textShadow: '0 0.5px 1px rgba(16, 25, 43, 0.1)',
          }}
        >
          {displayName}
        </div>
      </div>
    </div>
  )
}
