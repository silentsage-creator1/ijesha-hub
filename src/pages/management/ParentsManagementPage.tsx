import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  HeartHandshake,
  Search,
  Filter,
  Plus,
  Users,
  ArrowLeft,
  Mail,
  Phone,
  Pencil,
  Power,
  MapPin,
  BookOpen,
  FileText,
  ExternalLink,
} from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import { Card, Badge } from '@/components/ui/primitives'
import {
  getStoredParents,
  saveStoredParents,
  type ParentRecord,
  logSystemActivity,
} from '@/lib/management'
import { useAuth } from '@/app/auth'

export function ParentsManagementPage() {
  const navigate = useNavigate()
  const { user, profile, role } = useAuth()
  const canManage = role === 'admin' || role === 'manager'

  const [parents, setParents] = useState<ParentRecord[]>(getStoredParents())
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  // Form states
  const [editForm, setEditForm] = useState<{
    fullName: string
    relationship: string
    email: string
    phone: string
    address: string
    occupation: string
    childName: string
    childCourse: string
  }>({
    fullName: '',
    relationship: 'Father',
    email: '',
    phone: '',
    address: '',
    occupation: '',
    childName: '',
    childCourse: 'Cyber Security',
  })

  // Selected parent
  const selectedParent = useMemo(() => {
    return parents.find((p) => p.id === selectedParentId) || null
  }, [parents, selectedParentId])

  // Filtered
  const filteredParents = useMemo(() => {
    return parents.filter((p) => {
      if (
        searchQuery &&
        !p.fullName.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !p.email.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !p.children.some((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
      ) {
        return false
      }
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      return true
    })
  }, [parents, searchQuery, statusFilter])

  // Action: Toggle Status
  const handleToggleStatus = (parent: ParentRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const nextStatus: 'active' | 'inactive' = parent.status === 'active' ? 'inactive' : 'active'
    const updated = parents.map((p) =>
      p.id === parent.id ? { ...p, status: nextStatus } : p
    )
    setParents(updated)
    saveStoredParents(updated)

    logSystemActivity(
      profile?.full_name || user?.name || 'Administrator',
      role || 'admin',
      nextStatus === 'active' ? 'Activated Parent Account' : 'Deactivated Parent Account',
      parent.fullName,
      'User',
      `Parent portal access set to ${nextStatus}.`
    )
  }

  // Action: Save Edit
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedParent) return
    const updated = parents.map((p) =>
      p.id === selectedParent.id
        ? {
            ...p,
            fullName: editForm.fullName,
            relationship: editForm.relationship,
            email: editForm.email,
            phone: editForm.phone,
            address: editForm.address,
            occupation: editForm.occupation,
          }
        : p
    )
    setParents(updated)
    saveStoredParents(updated)
    setIsEditModalOpen(false)

    logSystemActivity(
      profile?.full_name || user?.name || 'Administrator',
      role || 'admin',
      'Updated Parent Record',
      selectedParent.fullName,
      'User',
      'Updated guardian contact information and home address.'
    )
  }

  // Action: Create Parent
  const handleCreateParent = (e: React.FormEvent) => {
    e.preventDefault()
    const newParent: ParentRecord = {
      id: `par-${Date.now().toString().slice(-4)}`,
      fullName: editForm.fullName,
      relationship: editForm.relationship,
      email: editForm.email,
      phone: editForm.phone || '+234 800 000 0000',
      address: editForm.address || 'Ilesa, Osun State',
      occupation: editForm.occupation || 'Professional',
      status: 'active',
      children: [
        {
          name: editForm.childName || 'Enrolled Student',
          course: editForm.childCourse,
          cohort: 'Cohort A',
          progress: 75,
          attendance: 88,
          assignmentsCount: { submitted: 4, total: 5 },
          projectsCount: { completed: 1, total: 2 },
          assessmentsCount: { passed: 4, total: 5 },
          status: 'On Track',
        },
      ],
      registeredDate: 'Just now',
    }
    const updated = [newParent, ...parents]
    setParents(updated)
    saveStoredParents(updated)
    setIsCreateModalOpen(false)
    setSelectedParentId(newParent.id)

    logSystemActivity(
      profile?.full_name || user?.name || 'Administrator',
      role || 'admin',
      'Registered Guardian',
      newParent.fullName,
      'User',
      `Created guardian account linked to ${newParent.children[0]?.name}.`
    )
  }

  // ==========================================
  // PARENT PROFILE VIEW
  // ==========================================
  if (selectedParent) {
    return (
      <div id="parent-profile-view" className="space-y-6 pb-16">
        {/* Header Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)] pb-4">
          <div className="flex items-center gap-3">
            <button
              id="back-to-parents-btn"
              type="button"
              onClick={() => setSelectedParentId(null)}
              className="p-1.5 rounded-lg border border-[var(--color-line)] bg-white text-[var(--color-ink-700)] hover:bg-[var(--color-paper)] transition-colors"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold font-display text-[var(--color-ink-900)]">
                  {selectedParent.fullName}
                </h1>
                <Badge tone={selectedParent.status === 'active' ? 'success' : 'neutral'}>
                  {selectedParent.status === 'active' ? 'Active Guardian' : 'Inactive'}
                </Badge>
                <span className="px-2 py-0.5 bg-purple-50 border border-purple-200 text-purple-800 text-[10px] font-semibold rounded">
                  {selectedParent.relationship}
                </span>
              </div>
              <p className="text-xs text-[var(--color-ink-500)] mt-0.5">
                {selectedParent.occupation} • Registered {selectedParent.registeredDate}
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
                    fullName: selectedParent.fullName,
                    relationship: selectedParent.relationship,
                    email: selectedParent.email,
                    phone: selectedParent.phone,
                    address: selectedParent.address,
                    occupation: selectedParent.occupation,
                    childName: selectedParent.children[0]?.name || '',
                    childCourse: selectedParent.children[0]?.course || 'Cyber Security',
                  })
                  setIsEditModalOpen(true)
                }}
                className="px-3 py-1.5 bg-white border border-[var(--color-line)] rounded-lg text-xs font-semibold text-[var(--color-ink-800)] hover:bg-[var(--color-paper)] flex items-center gap-1.5"
              >
                <Pencil size={13} />
                <span>Edit Parent</span>
              </button>

              <button
                type="button"
                onClick={() => handleToggleStatus(selectedParent)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  selectedParent.status === 'active'
                    ? 'bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100'
                    : 'bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                <Power size={13} />
                <span>{selectedParent.status === 'active' ? 'Deactivate' : 'Activate'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Parent & Contact Information Strip */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-5 space-y-3">
            <h2 className="text-sm font-bold text-[var(--color-ink-900)] flex items-center gap-2">
              <Users size={16} className="text-[var(--color-harbor-600)]" />
              <span>Parent / Guardian Information</span>
            </h2>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-[var(--color-line)]">
                <span className="text-[var(--color-ink-500)]">Relationship:</span>
                <span className="font-semibold text-[var(--color-ink-900)]">{selectedParent.relationship}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[var(--color-line)]">
                <span className="text-[var(--color-ink-500)]">Occupation:</span>
                <span className="font-semibold text-[var(--color-ink-900)]">{selectedParent.occupation}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[var(--color-line)]">
                <span className="text-[var(--color-ink-500)]">Home Address:</span>
                <span className="font-semibold text-[var(--color-ink-900)] flex items-center gap-1">
                  <MapPin size={12} className="text-[var(--color-ink-400)]" />
                  {selectedParent.address}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-[var(--color-ink-500)]">Registration Date:</span>
                <span className="font-semibold text-[var(--color-ink-900)]">{selectedParent.registeredDate}</span>
              </div>
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <h2 className="text-sm font-bold text-[var(--color-ink-900)] flex items-center gap-2">
              <Phone size={16} className="text-[var(--color-harbor-600)]" />
              <span>Contact Channels</span>
            </h2>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-[var(--color-line)]">
                <span className="text-[var(--color-ink-500)] flex items-center gap-1.5">
                  <Mail size={13} /> Email Address:
                </span>
                <span className="font-semibold text-[var(--color-ink-900)]">{selectedParent.email}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[var(--color-line)]">
                <span className="text-[var(--color-ink-500)] flex items-center gap-1.5">
                  <Phone size={13} /> Phone Number:
                </span>
                <span className="font-semibold text-[var(--color-ink-900)]">{selectedParent.phone}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[var(--color-line)]">
                <span className="text-[var(--color-ink-500)]">Weekly Digest:</span>
                <span className="text-emerald-700 font-semibold">Enabled (SMS & Email)</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-[var(--color-ink-500)]">Account Status:</span>
                <Badge tone={selectedParent.status === 'active' ? 'success' : 'neutral'}>
                  {selectedParent.status === 'active' ? 'Verified Access' : 'Inactive'}
                </Badge>
              </div>
            </div>
          </Card>
        </div>

        {/* Children Details: Progress, Attendance, Assignments, Projects, Assessments, Reports */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-[var(--color-ink-900)] flex items-center gap-2">
            <BookOpen size={17} className="text-[var(--color-harbor-600)]" />
            <span>Enrolled Children & Academic Performance</span>
          </h2>

          {selectedParent.children.map((child, idx) => (
            <Card key={idx} className="p-5 space-y-5">
              {/* Child Title Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--color-line)]">
                <div>
                  <h3 className="text-base font-bold text-[var(--color-ink-900)] flex items-center gap-2">
                    <span>{child.name}</span>
                    <Badge tone={child.status === 'On Track' ? 'success' : 'warning'}>
                      {child.status}
                    </Badge>
                  </h3>
                  <p className="text-xs text-[var(--color-ink-500)] mt-0.5">
                    Course: <strong className="text-[var(--color-ink-800)]">{child.course}</strong> • Cohort:{' '}
                    <strong className="text-[var(--color-ink-800)]">{child.cohort}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate('/students')}
                    className="px-3 py-1.5 bg-[var(--color-harbor-50)] text-[var(--color-harbor-700)] hover:bg-[var(--color-harbor-100)] text-xs font-semibold rounded flex items-center gap-1.5 transition-colors"
                  >
                    <span>View Child Profile</span>
                    <ExternalLink size={12} />
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/reports')}
                    className="px-3 py-1.5 bg-white border border-[var(--color-line)] hover:bg-[var(--color-paper)] text-xs font-semibold text-[var(--color-ink-800)] rounded flex items-center gap-1.5"
                  >
                    <FileText size={12} />
                    <span>View Progress Reports</span>
                  </button>
                </div>
              </div>

              {/* Child Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {/* 1. Child Progress */}
                <div className="p-3 bg-[var(--color-paper)] rounded-lg border border-[var(--color-line)]">
                  <span className="text-[10px] font-bold uppercase text-[var(--color-ink-500)] block">
                    Curriculum Progress
                  </span>
                  <span className="text-xl font-bold font-display text-emerald-700 mt-1 block">
                    {child.progress}%
                  </span>
                  <span className="text-[10px] text-[var(--color-ink-400)]">Completed milestones</span>
                </div>

                {/* 2. Attendance */}
                <div className="p-3 bg-[var(--color-paper)] rounded-lg border border-[var(--color-line)]">
                  <span className="text-[10px] font-bold uppercase text-[var(--color-ink-500)] block">
                    Attendance
                  </span>
                  <span className="text-xl font-bold font-display text-blue-700 mt-1 block">
                    {child.attendance}%
                  </span>
                  <span className="text-[10px] text-[var(--color-ink-400)]">Live class sessions</span>
                </div>

                {/* 3. Assignments */}
                <div className="p-3 bg-[var(--color-paper)] rounded-lg border border-[var(--color-line)]">
                  <span className="text-[10px] font-bold uppercase text-[var(--color-ink-500)] block">
                    Assignments
                  </span>
                  <span className="text-xl font-bold font-display text-[var(--color-ink-900)] mt-1 block">
                    {child.assignmentsCount.submitted} / {child.assignmentsCount.total}
                  </span>
                  <span className="text-[10px] text-[var(--color-ink-400)]">Turned in & graded</span>
                </div>

                {/* 4. Projects */}
                <div className="p-3 bg-[var(--color-paper)] rounded-lg border border-[var(--color-line)]">
                  <span className="text-[10px] font-bold uppercase text-[var(--color-ink-500)] block">
                    Capstone Projects
                  </span>
                  <span className="text-xl font-bold font-display text-purple-700 mt-1 block">
                    {child.projectsCount.completed} / {child.projectsCount.total}
                  </span>
                  <span className="text-[10px] text-[var(--color-ink-400)]">Milestones delivered</span>
                </div>

                {/* 5. Assessments */}
                <div className="p-3 bg-[var(--color-paper)] rounded-lg border border-[var(--color-line)]">
                  <span className="text-[10px] font-bold uppercase text-[var(--color-ink-500)] block">
                    Assessments
                  </span>
                  <span className="text-xl font-bold font-display text-amber-700 mt-1 block">
                    {child.assessmentsCount.passed} / {child.assessmentsCount.total}
                  </span>
                  <span className="text-[10px] text-[var(--color-ink-400)]">Benchmarks passed</span>
                </div>
              </div>

              {/* Recent Coursework Breakdown */}
              <div className="text-xs space-y-2">
                <span className="font-bold text-[var(--color-ink-900)] block">
                  Academic Highlights & Progress Summary:
                </span>
                <p className="text-[var(--color-ink-600)] leading-relaxed">
                  {child.name} is performing consistently across weekly modules. Attendance meets the required minimum threshold of 80%, practical lab benchmarks are completed on schedule, and the latest published report is available for verification.
                </p>
              </div>
            </Card>
          ))}
        </div>

        {/* Modal: Edit Parent */}
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-6 space-y-4 border border-[var(--color-line)]">
              <h2 className="text-base font-bold text-[var(--color-ink-900)]">Edit Parent Profile</h2>
              <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--color-ink-700)] mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.fullName}
                    onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                    className="input"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--color-ink-700)] mb-1">
                      Relationship
                    </label>
                    <select
                      value={editForm.relationship}
                      onChange={(e) => setEditForm({ ...editForm, relationship: e.target.value })}
                      className="input"
                    >
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Guardian">Guardian</option>
                      <option value="Sponsor Relative">Sponsor Relative</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--color-ink-700)] mb-1">
                      Occupation
                    </label>
                    <input
                      type="text"
                      value={editForm.occupation}
                      onChange={(e) => setEditForm({ ...editForm, occupation: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--color-ink-700)] mb-1">
                    Email Address
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
                    Home Address
                  </label>
                  <input
                    type="text"
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
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
      </div>
    )
  }

  // ==========================================
  // PARENTS DIRECTORY LIST
  // ==========================================
  return (
    <div id="parents-management-page" className="space-y-6 pb-16">
      <PageHeader
        title="Parents & Guardians Management"
        subtitle="Manage parental contacts, enrolled children relationships, weekly progress access, and notifications."
        actions={
          canManage && (
            <button
              id="new-parent-btn"
              type="button"
              onClick={() => {
                setEditForm({
                  fullName: '',
                  relationship: 'Father',
                  email: '',
                  phone: '',
                  address: '',
                  occupation: '',
                  childName: '',
                  childCourse: 'Cyber Security',
                })
                setIsCreateModalOpen(true)
              }}
              className="px-3.5 py-2 bg-[var(--color-harbor-600)] hover:bg-[var(--color-harbor-700)] text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
            >
              <Plus size={15} />
              <span>Register Parent</span>
            </button>
          )
        }
      />

      {/* Filter and Search */}
      <Card className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[var(--color-ink-400)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search parents by name, email, or linked student..."
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
      </Card>

      {/* Parents Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[var(--color-paper)] text-[var(--color-ink-600)] border-b border-[var(--color-line)] uppercase font-semibold">
              <tr>
                <th className="px-5 py-3">Parent / Guardian</th>
                <th className="px-4 py-3">Relationship</th>
                <th className="px-4 py-3">Linked Children</th>
                <th className="px-4 py-3">Contact Email & Phone</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {filteredParents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[var(--color-ink-400)]">
                    <HeartHandshake className="w-8 h-8 mx-auto mb-2 text-[var(--color-ink-300)]" />
                    <p className="text-sm font-semibold text-[var(--color-ink-800)]">No parents found</p>
                    <p className="text-xs text-[var(--color-ink-500)] mt-0.5">
                      Adjust your search or link a guardian to an enrolled student.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredParents.map((parent) => (
                  <tr
                    key={parent.id}
                    onClick={() => setSelectedParentId(parent.id)}
                    className="hover:bg-[var(--color-paper)]/70 cursor-pointer transition-colors group"
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-[var(--color-ink-900)] group-hover:text-[var(--color-harbor-600)] flex items-center gap-2">
                        <span>{parent.fullName}</span>
                      </div>
                      <div className="text-[11px] text-[var(--color-ink-500)] mt-0.5">
                        {parent.occupation} • {parent.address}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 bg-purple-50 text-purple-800 text-[10px] font-semibold rounded">
                        {parent.relationship}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="space-y-1">
                        {parent.children.map((c, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <span className="font-semibold text-[var(--color-ink-900)]">{c.name}</span>
                            <span className="text-[10px] text-[var(--color-ink-400)]">({c.course})</span>
                          </div>
                        ))}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="text-[var(--color-ink-800)] font-medium">{parent.email}</div>
                      <div className="text-[11px] text-[var(--color-ink-500)]">{parent.phone}</div>
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <Badge tone={parent.status === 'active' ? 'success' : 'neutral'}>
                        {parent.status === 'active' ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canManage && (
                          <button
                            type="button"
                            title={parent.status === 'active' ? 'Deactivate Parent' : 'Activate Parent'}
                            onClick={(e) => handleToggleStatus(parent, e)}
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

      {/* Modal: Register Parent */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-6 space-y-4 border border-[var(--color-line)]">
            <h2 className="text-base font-bold text-[var(--color-ink-900)]">Register Parent / Guardian</h2>
            <form onSubmit={handleCreateParent} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--color-ink-700)] mb-1">
                  Parent / Guardian Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mr. Olusegun Ogunlesi"
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  className="input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--color-ink-700)] mb-1">
                    Relationship
                  </label>
                  <select
                    value={editForm.relationship}
                    onChange={(e) => setEditForm({ ...editForm, relationship: e.target.value })}
                    className="input"
                  >
                    <option value="Father">Father</option>
                    <option value="Mother">Mother</option>
                    <option value="Guardian">Guardian</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--color-ink-700)] mb-1">
                    Occupation
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Civil Engineer"
                    value={editForm.occupation}
                    onChange={(e) => setEditForm({ ...editForm, occupation: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--color-ink-700)] mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. o.ogunlesi@gmail.com"
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
                  placeholder="e.g. +234 802 334 9912"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="input"
                />
              </div>

              <div className="pt-2 border-t border-[var(--color-line)]">
                <span className="block text-[11px] font-bold text-[var(--color-ink-800)] mb-2">
                  Linked Student Details:
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-[var(--color-ink-600)] mb-1">
                      Child Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Adebayo Ogunlesi"
                      value={editForm.childName}
                      onChange={(e) => setEditForm({ ...editForm, childName: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-[var(--color-ink-600)] mb-1">
                      Enrolled Track
                    </label>
                    <select
                      value={editForm.childCourse}
                      onChange={(e) => setEditForm({ ...editForm, childCourse: e.target.value })}
                      className="input"
                    >
                      <option value="Cyber Security">Cyber Security</option>
                      <option value="Full-Stack Web Development">Full-Stack Web</option>
                      <option value="Data Analytics">Data Analytics</option>
                    </select>
                  </div>
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
                  Register Guardian
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
