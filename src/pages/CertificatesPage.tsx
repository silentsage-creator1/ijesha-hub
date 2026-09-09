import { useState, useMemo, useEffect } from 'react'
import {
  Award,
  Plus,
  Search,
  Calendar,
  Filter,
  Eye,
  CheckCircle2,
  FileCheck,
  GraduationCap,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '@/app/auth'
import { PageHeader } from '@/components/shell/PageHeader'
import { Badge, Card } from '@/components/ui/primitives'
import { CreateCertificateModal } from '@/components/certificates/CreateCertificateModal'
import { CertificateDetailModal } from '@/components/certificates/CertificateDetailModal'
import { getStoredCertificates } from '@/lib/certificates'
import type { Certificate } from '@/types'

export function CertificatesPage() {
  const { role } = useAuth()
  const isAdminOrManager = role === 'admin' || role === 'manager'

  // Certificates list state
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [error,setError] = useState('')
  const [loading,setLoading] = useState(true)
  useEffect(()=>{
    let active=true
    setLoading(true);setCertificates([]);setError('')
    getStoredCertificates().then(rows=>{if(active)setCertificates(rows)}).catch(err=>{if(active)setError(err.message)}).finally(()=>{if(active)setLoading(false)})
    return ()=>{active=false}
  },[role])
  const [query, setQuery] = useState('')
  const [selectedStudentFilter, setSelectedStudentFilter] = useState('')
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('')
  const [selectedCohortFilter, setSelectedCohortFilter] = useState('')
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('')
  const [dateSort, setDateSort] = useState<'desc' | 'asc'>('desc')

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate | null>(null)

  // Dynamic filter options derived from current certificates list
  const uniqueStudents = useMemo(() => {
    const names = new Set(certificates.map((c) => c.student_name))
    return Array.from(names).sort()
  }, [certificates])

  const uniqueCourses = useMemo(() => {
    const courses = new Set(certificates.map((c) => c.course))
    return Array.from(courses).sort()
  }, [certificates])

  const uniqueCohorts = useMemo(() => {
    const cohorts = new Set(certificates.map((c) => c.cohort))
    return Array.from(cohorts).sort()
  }, [certificates])

  // Filtered and sorted certificates
  const filteredCertificates = useMemo(() => {
    return certificates
      .filter((cert) => {
        // Search query
        if (query.trim()) {
          const q = query.toLowerCase()
          const matches =
            cert.student_name.toLowerCase().includes(q) ||
            cert.course.toLowerCase().includes(q) ||
            cert.cohort.toLowerCase().includes(q) ||
            cert.certificate_type.toLowerCase().includes(q)
          if (!matches) return false
        }

        // Dropdown filters
        if (selectedStudentFilter && cert.student_name !== selectedStudentFilter) {
          return false
        }
        if (selectedCourseFilter && cert.course !== selectedCourseFilter) {
          return false
        }
        if (selectedCohortFilter && cert.cohort !== selectedCohortFilter) {
          return false
        }
        if (selectedStatusFilter && cert.status !== selectedStatusFilter) {
          return false
        }

        return true
      })
      .sort((a, b) => {
        const timeA = new Date(a.issue_date).getTime()
        const timeB = new Date(b.issue_date).getTime()
        return dateSort === 'desc' ? timeB - timeA : timeA - timeB
      })
  }, [
    certificates,
    query,
    selectedStudentFilter,
    selectedCourseFilter,
    selectedCohortFilter,
    selectedStatusFilter,
    dateSort,
    role,
  ])

  // Summary statistics
  const totalIssued = useMemo(
    () => certificates.filter((c) => c.status === 'Issued').length,
    [certificates]
  )
  const totalCourses = useMemo(
    () => new Set(certificates.map((c) => c.course)).size,
    [certificates]
  )

  const handleCertificateIssued = (newCert: Certificate) => {
    setCertificates((prev) => [newCert, ...prev])
    setShowCreateModal(false)
    // Open Certificate Details immediately as required
    setSelectedCertificate(newCert)
  }

  return (
    <div className="space-y-6">
      {/* 1. Certificates Page Header */}
      <PageHeader
        title="Certificates"
        subtitle="Create, issue, and manage student certificates."
        actions={
          isAdminOrManager ? (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-harbor-600)] px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-[var(--color-harbor-700)] transition-colors cursor-pointer"
            >
              <Plus size={16} />
              <span>Create Certificate</span>
            </button>
          ) : undefined
        }
      />

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-harbor-100)] text-[var(--color-harbor-600)]">
            <Award size={20} />
          </div>
          <div>
            <p className="text-xs text-[var(--color-ink-500)]">Total Certificates Issued</p>
            <p className="font-display text-xl font-bold text-[var(--color-ink-900)]">
              {totalIssued}
            </p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-ember-100)] text-[var(--color-ember-600)]">
            <GraduationCap size={20} />
          </div>
          <div>
            <p className="text-xs text-[var(--color-ink-500)]">Certified Learning Tracks</p>
            <p className="font-display text-xl font-bold text-[var(--color-ink-900)]">
              {totalCourses} Tracks
            </p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-success-100)] text-[var(--color-success-600)]">
            <FileCheck size={20} />
          </div>
          <div>
            <p className="text-xs text-[var(--color-ink-500)]">Template Status</p>
            <p className="font-display text-sm font-bold text-[var(--color-success-600)] flex items-center gap-1 mt-0.5">
              <CheckCircle2 size={14} /> Fixed IGAD Template Active
            </p>
          </div>
        </Card>
      </div>

      {/* Search & Filters Toolbar */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Search Certificates */}
          <div className="relative flex-1 min-w-[220px]">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search certificates by student, course, cohort..."
              className="input pl-9 text-sm w-full"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-ink-500)] flex items-center gap-1">
              <Filter size={13} />
              Filters:
            </span>

            {/* Date Sorting */}
            <select
              value={dateSort}
              onChange={(e) => setDateSort(e.target.value as 'desc' | 'asc')}
              className="input text-xs py-1.5 w-auto"
            >
              <option value="desc">Date: Newest First</option>
              <option value="asc">Date: Oldest First</option>
            </select>
          </div>
        </div>

        {/* Filter Dropdowns: Student, Course, Cohort, Status */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[var(--color-line)]">
          {/* Student Filter */}
          <select
            value={selectedStudentFilter}
            onChange={(e) => setSelectedStudentFilter(e.target.value)}
            className="input text-xs py-1.5"
          >
            <option value="">All Students</option>
            {uniqueStudents.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          {/* Course Filter */}
          <select
            value={selectedCourseFilter}
            onChange={(e) => setSelectedCourseFilter(e.target.value)}
            className="input text-xs py-1.5"
          >
            <option value="">All Courses</option>
            {uniqueCourses.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Cohort Filter */}
          <select
            value={selectedCohortFilter}
            onChange={(e) => setSelectedCohortFilter(e.target.value)}
            className="input text-xs py-1.5"
          >
            <option value="">All Cohorts</option>
            {uniqueCohorts.map((cohort) => (
              <option key={cohort} value={cohort}>
                {cohort}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="input text-xs py-1.5"
          >
            <option value="">All Statuses</option>
            <option value="Issued">Issued</option>
            <option value="Pending">Pending</option>
            <option value="Draft">Draft</option>
          </select>
        </div>
      </Card>

      {error && <p role="alert" className="text-[var(--color-danger-600)]">{error}</p>}
      {loading && <p>Loading certificates…</p>}
      {/* Certificate List (Rule: The student/certificate row must be clickable) */}
      <Card className="overflow-hidden border border-[var(--color-line)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--color-line)] bg-[var(--color-paper)] text-[11px] font-semibold text-[var(--color-ink-500)] uppercase tracking-wider">
                <th className="px-5 py-3.5">Student Name</th>
                <th className="px-4 py-3.5">Course</th>
                <th className="px-4 py-3.5">Certificate Type</th>
                <th className="px-4 py-3.5">Date</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">View Certificate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)] text-sm">
              {filteredCertificates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-xs text-[var(--color-ink-400)]">
                    <Award size={32} className="mx-auto mb-2 text-[var(--color-ink-300)] opacity-60" />
                    No certificates found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredCertificates.map((cert) => {
                  const formattedDate = new Date(cert.issue_date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                  const initials = cert.student_name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()

                  return (
                    <tr
                      key={cert.id}
                      onClick={() => setSelectedCertificate(cert)}
                      className="group hover:bg-[var(--color-harbor-100)]/20 transition-colors cursor-pointer"
                    >
                      {/* Student Name */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-ink-100)] text-xs font-bold text-[var(--color-ink-700)] group-hover:bg-[var(--color-harbor-600)] group-hover:text-white transition-colors">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-[var(--color-ink-900)] group-hover:text-[var(--color-harbor-600)] transition-colors">
                              {cert.student_name}
                            </p>
                            <p className="text-[11px] text-[var(--color-ink-400)]">
                              {cert.cohort}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Course */}
                      <td className="px-4 py-3.5 text-[var(--color-ink-700)] font-medium">
                        {cert.course}
                      </td>

                      {/* Certificate Type */}
                      <td className="px-4 py-3.5 text-[var(--color-ink-600)] text-xs">
                        <span className="inline-flex items-center gap-1">
                          <Sparkles size={12} className="text-[var(--color-ember-500)]" />
                          {cert.certificate_type}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3.5 text-xs text-[var(--color-ink-500)] whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar size={13} className="text-[var(--color-ink-400)]" />
                          {formattedDate}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <Badge
                          tone={
                            cert.status === 'Issued'
                              ? 'success'
                              : cert.status === 'Pending'
                              ? 'warning'
                              : 'neutral'
                          }
                          className="gap-1 text-[11px]"
                        >
                          <CheckCircle2 size={11} />
                          {cert.status}
                        </Badge>
                      </td>

                      {/* View Certificate Action */}
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedCertificate(cert)
                          }}
                          className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-ink-700)] shadow-xs hover:bg-[var(--color-ink-50)] hover:text-[var(--color-harbor-600)] transition-colors"
                        >
                          <Eye size={13} />
                          <span>View Certificate</span>
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 2. Create Certificate Modal Flow */}
      {showCreateModal && (
        <CreateCertificateModal
          onClose={() => setShowCreateModal(false)}
          onCertificateIssued={handleCertificateIssued}
        />
      )}

      {/* 8. Certificate Details Modal Flow */}
      {selectedCertificate && (
        <CertificateDetailModal
          certificate={selectedCertificate}
          onClose={() => setSelectedCertificate(null)}
        />
      )}
    </div>
  )
}
