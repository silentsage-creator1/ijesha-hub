import { useState, useMemo } from 'react'
import {
  Building2,
  Search,
  Filter,
  Plus,
  Layers,
  Users,
  ArrowLeft,
  Mail,
  Phone,
  Pencil,
  Power,
  Calendar,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import { Card, Badge } from '@/components/ui/primitives'
import {
  getStoredSponsors,
  saveStoredSponsors,
  type SponsorRecord,
  logSystemActivity,
} from '@/lib/management'
import { useAuth } from '@/app/auth'

export function SponsorsManagementPage() {
  const { user, profile, role } = useAuth()
  const canManage = role === 'admin' || role === 'manager'

  const [sponsors, setSponsors] = useState<SponsorRecord[]>(getStoredSponsors())
  const [selectedSponsorId, setSelectedSponsorId] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isAssignCohortModalOpen, setIsAssignCohortModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [selectedStudentFilter, setSelectedStudentFilter] = useState<string>('all')

  // Form states
  const [editForm, setEditForm] = useState<{
    organizationName: string
    contactPerson: string
    email: string
    phone: string
    category: SponsorRecord['category']
    fundingCommitted: string
  }>({
    organizationName: '',
    contactPerson: '',
    email: '',
    phone: '',
    category: 'Corporate',
    fundingCommitted: '',
  })

  const [selectedCohortToAssign, setSelectedCohortToAssign] = useState('Cohort A')

  // Selected sponsor
  const selectedSponsor = useMemo(() => {
    return sponsors.find((s) => s.id === selectedSponsorId) || null
  }, [sponsors, selectedSponsorId])

  // Filtered
  const filteredSponsors = useMemo(() => {
    return sponsors.filter((s) => {
      if (
        searchQuery &&
        !s.organizationName.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !s.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !s.email.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false
      }
      if (statusFilter !== 'all' && s.status !== statusFilter) return false
      if (categoryFilter !== 'all' && s.category !== categoryFilter) return false
      return true
    })
  }, [sponsors, searchQuery, statusFilter, categoryFilter])

  // Action: Toggle Status
  const handleToggleStatus = (sponsor: SponsorRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const nextStatus: 'active' | 'inactive' = sponsor.status === 'active' ? 'inactive' : 'active'
    const updated = sponsors.map((s) =>
      s.id === sponsor.id ? { ...s, status: nextStatus } : s
    )
    setSponsors(updated)
    saveStoredSponsors(updated)

    logSystemActivity(
      profile?.full_name || user?.name || 'Administrator',
      role || 'admin',
      nextStatus === 'active' ? 'Activated Sponsor' : 'Deactivated Sponsor',
      sponsor.organizationName,
      'User',
      `Sponsor engagement status set to ${nextStatus}.`
    )
  }

  // Action: Save Edit
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSponsor) return
    const updated = sponsors.map((s) =>
      s.id === selectedSponsor.id ? { ...s, ...editForm } : s
    )
    setSponsors(updated)
    saveStoredSponsors(updated)
    setIsEditModalOpen(false)

    logSystemActivity(
      profile?.full_name || user?.name || 'Administrator',
      role || 'admin',
      'Updated Sponsor Profile',
      selectedSponsor.organizationName,
      'User',
      'Updated partnership contact and funding commitment.'
    )
  }

  // Action: Assign Cohort
  const handleAssignCohort = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSponsor) return
    if (!selectedSponsor.assignedCohorts.includes(selectedCohortToAssign)) {
      const newCohorts = [...selectedSponsor.assignedCohorts, selectedCohortToAssign]
      const updated = sponsors.map((s) =>
        s.id === selectedSponsor.id ? { ...s, assignedCohorts: newCohorts } : s
      )
      setSponsors(updated)
      saveStoredSponsors(updated)

      logSystemActivity(
        profile?.full_name || user?.name || 'Administrator',
        role || 'admin',
        'Assigned Cohort to Sponsor',
        `${selectedCohortToAssign} → ${selectedSponsor.organizationName}`,
        'Cohort',
        `Linked ${selectedCohortToAssign} sponsorship grant.`
      )
    }
    setIsAssignCohortModalOpen(false)
  }

  // Action: Create Sponsor
  const handleCreateSponsor = (e: React.FormEvent) => {
    e.preventDefault()
    const newSponsor: SponsorRecord = {
      id: `sp-${Date.now().toString().slice(-4)}`,
      organizationName: editForm.organizationName,
      contactPerson: editForm.contactPerson,
      email: editForm.email,
      phone: editForm.phone || '+234 800 000 0000',
      category: editForm.category,
      status: 'active',
      assignedCohorts: selectedCohortToAssign ? [selectedCohortToAssign] : [],
      sponsoredStudents: [],
      fundingCommitted: editForm.fundingCommitted || '₦0',
      progressAverage: 0,
      performanceAverage: 0,
      reportsAvailable: 0,
      partnershipDate: 'Just now',
    }
    const updated = [newSponsor, ...sponsors]
    setSponsors(updated)
    saveStoredSponsors(updated)
    setIsCreateModalOpen(false)
    setSelectedSponsorId(newSponsor.id)

    logSystemActivity(
      profile?.full_name || user?.name || 'Administrator',
      role || 'admin',
      'Created Sponsor Partner',
      newSponsor.organizationName,
      'User',
      `Registered ${newSponsor.organizationName} as ${newSponsor.category} donor.`
    )
  }

  // ==========================================
  // SPONSOR PROFILE VIEW
  // ==========================================
  if (selectedSponsor) {
    const studentsToDisplay = selectedSponsor.sponsoredStudents.filter((st) => {
      if (selectedStudentFilter === 'all') return true
      return st.status === selectedStudentFilter
    })

    return (
      <div id="sponsor-profile-view" className="space-y-6 pb-16">
        {/* Header Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)] pb-4">
          <div className="flex items-center gap-3">
            <button
              id="back-to-sponsors-btn"
              type="button"
              onClick={() => setSelectedSponsorId(null)}
              className="p-1.5 rounded-lg border border-[var(--color-line)] bg-white text-[var(--color-ink-700)] hover:bg-[var(--color-paper)] transition-colors"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold font-display text-[var(--color-ink-900)]">
                  {selectedSponsor.organizationName}
                </h1>
                <Badge tone={selectedSponsor.status === 'active' ? 'success' : 'neutral'}>
                  {selectedSponsor.status === 'active' ? 'Active Sponsor' : 'Inactive'}
                </Badge>
                <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-800 text-[10px] font-semibold rounded">
                  {selectedSponsor.category}
                </span>
              </div>
              <p className="text-xs text-[var(--color-ink-500)] mt-0.5">
                Contact: {selectedSponsor.contactPerson} • Partnered {selectedSponsor.partnershipDate}
              </p>
            </div>
          </div>

          {/* Admin Actions */}
          {canManage && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditForm({
                    organizationName: selectedSponsor.organizationName,
                    contactPerson: selectedSponsor.contactPerson,
                    email: selectedSponsor.email,
                    phone: selectedSponsor.phone,
                    category: selectedSponsor.category,
                    fundingCommitted: selectedSponsor.fundingCommitted,
                  })
                  setIsEditModalOpen(true)
                }}
                className="px-3 py-1.5 bg-white border border-[var(--color-line)] rounded-lg text-xs font-semibold text-[var(--color-ink-800)] hover:bg-[var(--color-paper)] flex items-center gap-1.5"
              >
                <Pencil size={13} />
                <span>Edit Sponsor</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAssignCohortModalOpen(true)}
                className="px-3 py-1.5 bg-white border border-[var(--color-line)] rounded-lg text-xs font-semibold text-[var(--color-ink-800)] hover:bg-[var(--color-paper)] flex items-center gap-1.5"
              >
                <Layers size={13} />
                <span>Assign Cohort</span>
              </button>

              <button
                type="button"
                onClick={() => handleToggleStatus(selectedSponsor)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  selectedSponsor.status === 'active'
                    ? 'bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100'
                    : 'bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                <Power size={13} />
                <span>{selectedSponsor.status === 'active' ? 'Deactivate' : 'Activate'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Overview Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <Card className="p-3.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-500)] block">
              Cohorts
            </span>
            <span className="text-2xl font-bold font-display text-[var(--color-ink-900)] mt-1 block">
              {selectedSponsor.assignedCohorts.length}
            </span>
            <span className="text-[10px] text-[var(--color-ink-400)]">Supported batches</span>
          </Card>

          <Card className="p-3.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-500)] block">
              Students
            </span>
            <span className="text-2xl font-bold font-display text-[var(--color-ink-900)] mt-1 block">
              {selectedSponsor.sponsoredStudents.length}
            </span>
            <span className="text-[10px] text-[var(--color-ink-400)]">Beneficiaries</span>
          </Card>

          <Card className="p-3.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">
              Progress Avg
            </span>
            <span className="text-2xl font-bold font-display text-emerald-600 mt-1 block">
              {selectedSponsor.progressAverage}%
            </span>
            <span className="text-[10px] text-[var(--color-ink-400)]">Curriculum pace</span>
          </Card>

          <Card className="p-3.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 block">
              Performance
            </span>
            <span className="text-2xl font-bold font-display text-amber-600 mt-1 block">
              {selectedSponsor.performanceAverage}%
            </span>
            <span className="text-[10px] text-[var(--color-ink-400)]">Assessment score</span>
          </Card>

          <Card className="p-3.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 block">
              Reports
            </span>
            <span className="text-2xl font-bold font-display text-blue-600 mt-1 block">
              {selectedSponsor.reportsAvailable}
            </span>
            <span className="text-[10px] text-[var(--color-ink-400)]">Downloadable PDFs</span>
          </Card>

          <Card className="p-3.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-500)] block">
              Committed Grant
            </span>
            <span className="text-lg font-bold font-display text-[var(--color-ink-900)] mt-1.5 block truncate">
              {selectedSponsor.fundingCommitted}
            </span>
            <span className="text-[10px] text-[var(--color-ink-400)]">Approved budget</span>
          </Card>
        </div>

        {/* Assigned Cohorts & Contact Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-bold text-[var(--color-ink-900)] flex items-center gap-2">
              <Layers size={16} className="text-[var(--color-harbor-600)]" />
              <span>Assigned Cohorts & Impact Program</span>
            </h2>

            <div>
              <span className="text-xs font-semibold text-[var(--color-ink-600)] block mb-2">
                Supported Cohort Batches
              </span>
              <div className="flex flex-wrap gap-2">
                {selectedSponsor.assignedCohorts.map((ch) => (
                  <span
                    key={ch}
                    className="px-2.5 py-1 bg-[var(--color-harbor-50)] text-[var(--color-harbor-700)] border border-[var(--color-harbor-200)] text-xs rounded-md font-medium"
                  >
                    {ch}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-[var(--color-line)]">
              <span className="text-xs font-semibold text-[var(--color-ink-600)] block mb-1">
                Sponsorship Scope
              </span>
              <p className="text-xs text-[var(--color-ink-600)] leading-relaxed">
                Covers tuition scholarships, laptop grants, certification subsidies, and hands-on laboratory compute credits.
              </p>
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-bold text-[var(--color-ink-900)] flex items-center gap-2">
              <Building2 size={16} className="text-[var(--color-harbor-600)]" />
              <span>Institutional Representative Details</span>
            </h2>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-[var(--color-line)]">
                <span className="text-[var(--color-ink-500)] flex items-center gap-2">
                  <Users size={14} /> Contact Representative
                </span>
                <span className="font-semibold text-[var(--color-ink-900)]">{selectedSponsor.contactPerson}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[var(--color-line)]">
                <span className="text-[var(--color-ink-500)] flex items-center gap-2">
                  <Mail size={14} /> Official Email
                </span>
                <span className="font-semibold text-[var(--color-ink-900)]">{selectedSponsor.email}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[var(--color-line)]">
                <span className="text-[var(--color-ink-500)] flex items-center gap-2">
                  <Phone size={14} /> Phone Contact
                </span>
                <span className="font-semibold text-[var(--color-ink-900)]">{selectedSponsor.phone}</span>
              </div>

              <div className="flex items-center justify-between py-1.5">
                <span className="text-[var(--color-ink-500)] flex items-center gap-2">
                  <Calendar size={14} /> Partnership Began
                </span>
                <span className="font-semibold text-[var(--color-ink-900)]">{selectedSponsor.partnershipDate}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Sponsored Students Table */}
        <Card className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-bold text-[var(--color-ink-900)]">
                Sponsored Students Roster ({selectedSponsor.sponsoredStudents.length})
              </h2>
              <p className="text-xs text-[var(--color-ink-500)]">
                Live academic milestone tracking, attendance adherence, and progress reports.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-ink-500)]">Filter:</span>
              <select
                value={selectedStudentFilter}
                onChange={(e) => setSelectedStudentFilter(e.target.value)}
                className="px-2 py-1 bg-white border border-[var(--color-line)] rounded text-xs text-[var(--color-ink-800)]"
              >
                <option value="all">All Beneficiaries</option>
                <option value="On Track">On Track Only</option>
                <option value="Needs Attention">Needs Attention</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[var(--color-paper)] text-[var(--color-ink-600)] border-b border-[var(--color-line)]">
                <tr>
                  <th className="px-4 py-2.5">Beneficiary Name</th>
                  <th className="px-4 py-2.5">Course Track</th>
                  <th className="px-4 py-2.5">Cohort</th>
                  <th className="px-4 py-2.5 text-center">Progress %</th>
                  <th className="px-4 py-2.5 text-center">Attendance %</th>
                  <th className="px-4 py-2.5 text-right">Academic Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {studentsToDisplay.map((st, i) => (
                  <tr key={i} className="hover:bg-[var(--color-paper)]/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-[var(--color-ink-900)]">
                      {st.name}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-ink-600)]">{st.course}</td>
                    <td className="px-4 py-3 text-[var(--color-ink-600)]">{st.cohort}</td>
                    <td className="px-4 py-3 text-center font-bold text-emerald-700">{st.progress}%</td>
                    <td className="px-4 py-3 text-center font-bold text-blue-700">{st.attendance}%</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                          st.status === 'On Track' ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {st.status === 'On Track' ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                        {st.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Modal: Edit Sponsor */}
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-6 space-y-4 border border-[var(--color-line)]">
              <h2 className="text-base font-bold text-[var(--color-ink-900)]">Edit Sponsor Profile</h2>
              <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--color-ink-700)] mb-1">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.organizationName}
                    onChange={(e) => setEditForm({ ...editForm, organizationName: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--color-ink-700)] mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.contactPerson}
                    onChange={(e) => setEditForm({ ...editForm, contactPerson: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--color-ink-700)] mb-1">
                    Official Email
                  </label>
                  <input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--color-ink-700)] mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--color-ink-700)] mb-1">
                    Funding Committed
                  </label>
                  <input
                    type="text"
                    value={editForm.fundingCommitted}
                    onChange={(e) => setEditForm({ ...editForm, fundingCommitted: e.target.value })}
                    className="input"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-3 py-1.5 text-xs text-[var(--color-ink-600)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[var(--color-harbor-600)] text-white font-semibold rounded"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Assign Cohort */}
        {isAssignCohortModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl p-6 space-y-4 border border-[var(--color-line)]">
              <h2 className="text-base font-bold text-[var(--color-ink-900)]">Assign Cohort Sponsorship</h2>
              <form onSubmit={handleAssignCohort} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--color-ink-700)] mb-1">
                    Select Cohort Batch
                  </label>
                  <select
                    value={selectedCohortToAssign}
                    onChange={(e) => setSelectedCohortToAssign(e.target.value)}
                    className="input"
                  >
                    <option value="Cohort A">Cohort A (Cyber & Web Dev)</option>
                    <option value="Cohort B">Cohort B (Data & AI)</option>
                    <option value="Cohort C">Cohort C (Product & Cloud)</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAssignCohortModalOpen(false)}
                    className="px-3 py-1.5 text-xs text-[var(--color-ink-600)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[var(--color-harbor-600)] text-white font-semibold rounded"
                  >
                    Assign Cohort
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ==========================================
  // SPONSORS DIRECTORY LIST
  // ==========================================
  return (
    <div id="sponsors-management-page" className="space-y-6 pb-16">
      <PageHeader
        title="Donors & Sponsors Management"
        subtitle="Manage funding organizations, government grants, assigned cohorts, and sponsored student metrics."
        actions={
          canManage && (
            <button
              id="new-sponsor-btn"
              type="button"
              onClick={() => {
                setEditForm({
                  organizationName: '',
                  contactPerson: '',
                  email: '',
                  phone: '',
                  category: 'Corporate',
                  fundingCommitted: '₦10,000,000',
                })
                setIsCreateModalOpen(true)
              }}
              className="px-3.5 py-2 bg-[var(--color-harbor-600)] hover:bg-[var(--color-harbor-700)] text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
            >
              <Plus size={15} />
              <span>Add Sponsor Partner</span>
            </button>
          )
        }
      />

      {/* Search and Filters */}
      <Card className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[var(--color-ink-400)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sponsors by organization name, contact, or email..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-[var(--color-line)] rounded-lg text-xs text-[var(--color-ink-900)] focus:outline-hidden focus:border-[var(--color-harbor-500)]"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-ink-500)] flex items-center gap-1">
            <Filter size={13} /> Status:
          </span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            className="px-2.5 py-1.5 bg-white border border-[var(--color-line)] rounded-lg text-xs text-[var(--color-ink-800)]"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-ink-500)]">Category:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-[var(--color-line)] rounded-lg text-xs text-[var(--color-ink-800)]"
          >
            <option value="all">All Categories</option>
            <option value="Government">Government</option>
            <option value="Philanthropic">Philanthropic</option>
            <option value="Corporate">Corporate</option>
            <option value="NGO">NGO</option>
          </select>
        </div>
      </Card>

      {/* Sponsors Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[var(--color-paper)] text-[var(--color-ink-600)] border-b border-[var(--color-line)] uppercase font-semibold">
              <tr>
                <th className="px-5 py-3">Sponsor Organization</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Cohorts</th>
                <th className="px-4 py-3 text-center">Beneficiaries</th>
                <th className="px-4 py-3 text-center">Avg Progress</th>
                <th className="px-4 py-3 text-center">Avg Performance</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {filteredSponsors.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-[var(--color-ink-400)]">
                    <Building2 className="w-8 h-8 mx-auto mb-2 text-[var(--color-ink-300)]" />
                    <p className="text-sm font-semibold text-[var(--color-ink-800)]">No sponsors found</p>
                    <p className="text-xs text-[var(--color-ink-500)] mt-0.5">
                      Adjust your search filters or add a new sponsoring organization.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredSponsors.map((sponsor) => (
                  <tr
                    key={sponsor.id}
                    onClick={() => setSelectedSponsorId(sponsor.id)}
                    className="hover:bg-[var(--color-paper)]/70 cursor-pointer transition-colors group"
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-[var(--color-ink-900)] group-hover:text-[var(--color-harbor-600)] flex items-center gap-2">
                        <span>{sponsor.organizationName}</span>
                      </div>
                      <div className="text-[11px] text-[var(--color-ink-500)] mt-0.5">
                        Rep: {sponsor.contactPerson} • {sponsor.email}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-800 text-[10px] font-semibold rounded">
                        {sponsor.category}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {sponsor.assignedCohorts.map((ch) => (
                          <span
                            key={ch}
                            className="px-1.5 py-0.5 bg-slate-100 text-[var(--color-ink-700)] text-[10px] rounded font-medium"
                          >
                            {ch}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-center font-bold text-[var(--color-ink-900)]">
                      {sponsor.sponsoredStudents.length}
                    </td>

                    <td className="px-4 py-3.5 text-center font-semibold text-emerald-700">
                      {sponsor.progressAverage}%
                    </td>

                    <td className="px-4 py-3.5 text-center font-semibold text-amber-600">
                      {sponsor.performanceAverage}%
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <Badge tone={sponsor.status === 'active' ? 'success' : 'neutral'}>
                        {sponsor.status === 'active' ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canManage && (
                          <button
                            type="button"
                            title={sponsor.status === 'active' ? 'Deactivate Sponsor' : 'Activate Sponsor'}
                            onClick={(e) => handleToggleStatus(sponsor, e)}
                            className="p-1 text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)] rounded hover:bg-white"
                          >
                            <Power size={14} />
                          </button>
                        )}
                        <span className="text-xs font-semibold text-[var(--color-harbor-600)] group-hover:underline">
                          View Profile →
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal: Create Sponsor */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-6 space-y-4 border border-[var(--color-line)]">
            <h2 className="text-base font-bold text-[var(--color-ink-900)]">Register Sponsoring Entity</h2>
            <form onSubmit={handleCreateSponsor} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--color-ink-700)] mb-1">
                  Organization / Initiative Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Osun Tech Talent Initiative"
                  value={editForm.organizationName}
                  onChange={(e) => setEditForm({ ...editForm, organizationName: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--color-ink-700)] mb-1">
                  Contact Person
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hon. Demola Babalola"
                  value={editForm.contactPerson}
                  onChange={(e) => setEditForm({ ...editForm, contactPerson: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--color-ink-700)] mb-1">
                  Official Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. grants@osunstate.gov.ng"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--color-ink-700)] mb-1">
                    Category
                  </label>
                  <select
                    value={editForm.category}
                    onChange={(e) =>
                      setEditForm({ ...editForm, category: e.target.value as SponsorRecord['category'] })
                    }
                    className="input"
                  >
                    <option value="Government">Government</option>
                    <option value="Corporate">Corporate</option>
                    <option value="Philanthropic">Philanthropic</option>
                    <option value="NGO">NGO</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--color-ink-700)] mb-1">
                    Committed Funding
                  </label>
                  <input
                    type="text"
                    value={editForm.fundingCommitted}
                    onChange={(e) => setEditForm({ ...editForm, fundingCommitted: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-[var(--color-ink-600)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[var(--color-harbor-600)] hover:bg-[var(--color-harbor-700)] text-white font-semibold rounded"
                >
                  Register Partner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
