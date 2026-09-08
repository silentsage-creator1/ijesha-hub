import { useState, useMemo } from 'react'
import {
  Briefcase,
  Search,
  Filter,
  Plus,
  BookOpen,
  Layers,
  Calendar,
  ArrowLeft,
  Mail,
  Phone,
  Pencil,
  Power,
  FileText,
  MapPin,
} from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import { Card, Badge } from '@/components/ui/primitives'
import {
  getStoredManagers,
  saveStoredManagers,
  type ManagerRecord,
  logSystemActivity,
} from '@/lib/management'
import { useAuth } from '@/app/auth'

export function ManagersManagementPage() {
  const { user, profile, role } = useAuth()
  const canManage = role === 'admin'

  const [managers, setManagers] = useState<ManagerRecord[]>(getStoredManagers())
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [departmentFilter, setDepartmentFilter] = useState<string>('all')

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isAssignCourseModalOpen, setIsAssignCourseModalOpen] = useState(false)
  const [isAssignCohortModalOpen, setIsAssignCohortModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  // Form states
  const [editForm, setEditForm] = useState<{
    fullName: string
    email: string
    phone: string
    department: string
    officeLocation: string
  }>({
    fullName: '',
    email: '',
    phone: '',
    department: '',
    officeLocation: '',
  })

  const [selectedCourseToAssign, setSelectedCourseToAssign] = useState('Cyber Security')
  const [selectedCohortToAssign, setSelectedCohortToAssign] = useState('Cohort A')

  // Selected manager
  const selectedManager = useMemo(() => {
    return managers.find((m) => m.id === selectedManagerId) || null
  }, [managers, selectedManagerId])

  // Departments list
  const departments = useMemo(() => {
    const set = new Set<string>()
    managers.forEach((m) => {
      if (m.department) set.add(m.department)
    })
    return Array.from(set)
  }, [managers])

  // Filtered
  const filteredManagers = useMemo(() => {
    return managers.filter((m) => {
      if (
        searchQuery &&
        !m.fullName.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !m.department.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !m.email.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false
      }
      if (statusFilter !== 'all' && m.status !== statusFilter) return false
      if (departmentFilter !== 'all' && m.department !== departmentFilter) return false
      return true
    })
  }, [managers, searchQuery, statusFilter, departmentFilter])

  // Action: Toggle Status
  const handleToggleStatus = (mgr: ManagerRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const nextStatus: 'active' | 'inactive' = mgr.status === 'active' ? 'inactive' : 'active'
    const updated = managers.map((m) =>
      m.id === mgr.id ? { ...m, status: nextStatus } : m
    )
    setManagers(updated)
    saveStoredManagers(updated)

    logSystemActivity(
      profile?.full_name || user?.name || 'Administrator',
      role || 'admin',
      nextStatus === 'active' ? 'Activated Manager' : 'Deactivated Manager',
      mgr.fullName,
      'User',
      `Managerial access status set to ${nextStatus}.`
    )
  }

  // Action: Save Edit
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedManager) return
    const updated = managers.map((m) =>
      m.id === selectedManager.id ? { ...m, ...editForm } : m
    )
    setManagers(updated)
    saveStoredManagers(updated)
    setIsEditModalOpen(false)

    logSystemActivity(
      profile?.full_name || user?.name || 'Administrator',
      role || 'admin',
      'Updated Manager Profile',
      selectedManager.fullName,
      'User',
      'Updated departmental responsibility and contact information.'
    )
  }

  // Action: Assign Course
  const handleAssignCourse = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedManager) return
    if (!selectedManager.assignedCourses.includes(selectedCourseToAssign)) {
      const newCourses = [...selectedManager.assignedCourses, selectedCourseToAssign]
      const updated = managers.map((m) =>
        m.id === selectedManager.id ? { ...m, assignedCourses: newCourses } : m
      )
      setManagers(updated)
      saveStoredManagers(updated)

      logSystemActivity(
        profile?.full_name || user?.name || 'Administrator',
        role || 'admin',
        'Assigned Course to Manager',
        `${selectedCourseToAssign} → ${selectedManager.fullName}`,
        'Course',
        `Assigned curriculum governance for ${selectedCourseToAssign}.`
      )
    }
    setIsAssignCourseModalOpen(false)
  }

  // Action: Assign Cohort
  const handleAssignCohort = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedManager) return
    if (!selectedManager.assignedCohorts.includes(selectedCohortToAssign)) {
      const newCohorts = [...selectedManager.assignedCohorts, selectedCohortToAssign]
      const updated = managers.map((m) =>
        m.id === selectedManager.id ? { ...m, assignedCohorts: newCohorts } : m
      )
      setManagers(updated)
      saveStoredManagers(updated)

      logSystemActivity(
        profile?.full_name || user?.name || 'Administrator',
        role || 'admin',
        'Assigned Cohort to Manager',
        `${selectedCohortToAssign} → ${selectedManager.fullName}`,
        'Cohort',
        `Delegated cohort operational management for ${selectedCohortToAssign}.`
      )
    }
    setIsAssignCohortModalOpen(false)
  }

  // Action: Create Manager
  const handleCreateManager = (e: React.FormEvent) => {
    e.preventDefault()
    const newManager: ManagerRecord = {
      id: `mgr-${Date.now().toString().slice(-4)}`,
      fullName: editForm.fullName,
      email: editForm.email,
      phone: editForm.phone || '+234 800 000 0000',
      department: editForm.department || 'Academic Operations',
      status: 'active',
      assignedCourses: [selectedCourseToAssign],
      assignedCohorts: [selectedCohortToAssign],
      studentsCount: 25,
      reportsCount: 10,
      performanceScore: 95,
      joinDate: 'Just now',
      officeLocation: editForm.officeLocation || 'Main Administrative Block',
    }
    const updated = [newManager, ...managers]
    setManagers(updated)
    saveStoredManagers(updated)
    setIsCreateModalOpen(false)
    setSelectedManagerId(newManager.id)

    logSystemActivity(
      profile?.full_name || user?.name || 'Administrator',
      role || 'admin',
      'Onboarded Program Manager',
      newManager.fullName,
      'User',
      `Appointed ${newManager.fullName} to ${newManager.department}.`
    )
  }

  // ==========================================
  // MANAGER PROFILE VIEW
  // ==========================================
  if (selectedManager) {
    return (
      <div id="manager-profile-view" className="space-y-6 pb-16">
        {/* Header & Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)] pb-4">
          <div className="flex items-center gap-3">
            <button
              id="back-to-managers-btn"
              type="button"
              onClick={() => setSelectedManagerId(null)}
              className="p-1.5 rounded-lg border border-[var(--color-line)] bg-white text-[var(--color-ink-700)] hover:bg-[var(--color-paper)] transition-colors"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold font-display text-[var(--color-ink-900)]">
                  {selectedManager.fullName}
                </h1>
                <Badge tone={selectedManager.status === 'active' ? 'success' : 'neutral'}>
                  {selectedManager.status === 'active' ? 'Active Manager' : 'Inactive'}
                </Badge>
              </div>
              <p className="text-xs text-[var(--color-ink-500)] mt-0.5">
                {selectedManager.department} • Joined {selectedManager.joinDate}
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
                    fullName: selectedManager.fullName,
                    email: selectedManager.email,
                    phone: selectedManager.phone,
                    department: selectedManager.department,
                    officeLocation: selectedManager.officeLocation,
                  })
                  setIsEditModalOpen(true)
                }}
                className="px-3 py-1.5 bg-white border border-[var(--color-line)] rounded-lg text-xs font-semibold text-[var(--color-ink-800)] hover:bg-[var(--color-paper)] flex items-center gap-1.5"
              >
                <Pencil size={13} />
                <span>Edit Manager</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAssignCourseModalOpen(true)}
                className="px-3 py-1.5 bg-white border border-[var(--color-line)] rounded-lg text-xs font-semibold text-[var(--color-ink-800)] hover:bg-[var(--color-paper)] flex items-center gap-1.5"
              >
                <BookOpen size={13} />
                <span>Assign Course</span>
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
                onClick={() => handleToggleStatus(selectedManager)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  selectedManager.status === 'active'
                    ? 'bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100'
                    : 'bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                <Power size={13} />
                <span>{selectedManager.status === 'active' ? 'Deactivate' : 'Activate'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Overview Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          <Card className="p-3.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-500)] block">
              Assigned Courses
            </span>
            <span className="text-2xl font-bold font-display text-[var(--color-ink-900)] mt-1 block">
              {selectedManager.assignedCourses.length}
            </span>
            <span className="text-[10px] text-[var(--color-ink-400)]">Curriculum tracks</span>
          </Card>

          <Card className="p-3.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-500)] block">
              Assigned Cohorts
            </span>
            <span className="text-2xl font-bold font-display text-[var(--color-ink-900)] mt-1 block">
              {selectedManager.assignedCohorts.length}
            </span>
            <span className="text-[10px] text-[var(--color-ink-400)]">Active groups</span>
          </Card>

          <Card className="p-3.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-500)] block">
              Students
            </span>
            <span className="text-2xl font-bold font-display text-[var(--color-ink-900)] mt-1 block">
              {selectedManager.studentsCount}
            </span>
            <span className="text-[10px] text-[var(--color-ink-400)]">Active learners</span>
          </Card>

          <Card className="p-3.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 block">
              Reports Published
            </span>
            <span className="text-2xl font-bold font-display text-blue-600 mt-1 block">
              {selectedManager.reportsCount}
            </span>
            <span className="text-[10px] text-[var(--color-ink-400)]">Approved progress reports</span>
          </Card>

          <Card className="p-3.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">
              Performance
            </span>
            <span className="text-2xl font-bold font-display text-emerald-600 mt-1 block">
              {selectedManager.performanceScore}%
            </span>
            <span className="text-[10px] text-[var(--color-ink-400)]">Operational KPI score</span>
          </Card>
        </div>

        {/* Detailed Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Courses & Cohorts Card */}
          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-bold text-[var(--color-ink-900)] flex items-center gap-2">
              <BookOpen size={16} className="text-[var(--color-harbor-600)]" />
              <span>Assigned Courses & Programs</span>
            </h2>

            <div>
              <span className="text-xs font-semibold text-[var(--color-ink-600)] block mb-2">
                Managed Curriculum Programs
              </span>
              <div className="flex flex-wrap gap-2">
                {selectedManager.assignedCourses.map((c) => (
                  <span
                    key={c}
                    className="px-2.5 py-1 bg-[var(--color-harbor-50)] text-[var(--color-harbor-700)] border border-[var(--color-harbor-200)] text-xs rounded-md font-medium"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-[var(--color-line)]">
              <span className="text-xs font-semibold text-[var(--color-ink-600)] block mb-2">
                Supervised Cohorts
              </span>
              <div className="flex flex-wrap gap-2">
                {selectedManager.assignedCohorts.map((ch) => (
                  <span
                    key={ch}
                    className="px-2.5 py-1 bg-slate-100 text-[var(--color-ink-800)] border border-[var(--color-line)] text-xs rounded-md font-medium"
                  >
                    {ch}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-[var(--color-line)]">
              <span className="text-xs font-semibold text-[var(--color-ink-600)] block mb-1">
                Administrative Focus
              </span>
              <p className="text-xs text-[var(--color-ink-600)] leading-relaxed">
                Oversees instructional quality, mentor attendance adherence, grading verifications, and progress report sign-offs.
              </p>
            </div>
          </Card>

          {/* Contact & Office Card */}
          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-bold text-[var(--color-ink-900)] flex items-center gap-2">
              <Briefcase size={16} className="text-[var(--color-harbor-600)]" />
              <span>Office & Contact Directory</span>
            </h2>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-[var(--color-line)]">
                <span className="text-[var(--color-ink-500)] flex items-center gap-2">
                  <Mail size={14} /> Email Address
                </span>
                <span className="font-semibold text-[var(--color-ink-900)]">{selectedManager.email}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[var(--color-line)]">
                <span className="text-[var(--color-ink-500)] flex items-center gap-2">
                  <Phone size={14} /> Phone Contact
                </span>
                <span className="font-semibold text-[var(--color-ink-900)]">{selectedManager.phone}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[var(--color-line)]">
                <span className="text-[var(--color-ink-500)] flex items-center gap-2">
                  <MapPin size={14} /> Assigned Office
                </span>
                <span className="font-semibold text-[var(--color-ink-900)]">{selectedManager.officeLocation}</span>
              </div>

              <div className="flex items-center justify-between py-1.5">
                <span className="text-[var(--color-ink-500)] flex items-center gap-2">
                  <Calendar size={14} /> Appointment Date
                </span>
                <span className="font-semibold text-[var(--color-ink-900)]">{selectedManager.joinDate}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Reports & Governance Audit Card */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-[var(--color-ink-900)]">
                Reports & Performance Governance
              </h2>
              <p className="text-xs text-[var(--color-ink-500)]">
                Recent academic approvals, cohort reviews, and evaluation sign-offs.
              </p>
            </div>
            <span className="text-xs text-[var(--color-harbor-600)] font-semibold flex items-center gap-1">
              <FileText size={13} /> {selectedManager.reportsCount} Published Reports
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[var(--color-paper)] text-[var(--color-ink-600)] border-b border-[var(--color-line)]">
                <tr>
                  <th className="px-4 py-2.5">Governance Action</th>
                  <th className="px-4 py-2.5">Target Course / Cohort</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Date Verified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                <tr>
                  <td className="px-4 py-3 font-medium text-[var(--color-ink-900)]">
                    Progress Report Sign-Off & Verification
                  </td>
                  <td className="px-4 py-3 text-[var(--color-ink-600)]">Cyber Security — Cohort A</td>
                  <td className="px-4 py-3 text-emerald-700 font-semibold">Approved & Published</td>
                  <td className="px-4 py-3 text-right text-[var(--color-ink-500)]">Yesterday</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-[var(--color-ink-900)]">
                    Mid-Cohort Curriculum Review
                  </td>
                  <td className="px-4 py-3 text-[var(--color-ink-600)]">Full-Stack Web Development</td>
                  <td className="px-4 py-3 text-emerald-700 font-semibold">Quality Verified</td>
                  <td className="px-4 py-3 text-right text-[var(--color-ink-500)]">3 days ago</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        {/* Modal: Edit Manager */}
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-6 space-y-4 border border-[var(--color-line)]">
              <h2 className="text-base font-bold text-[var(--color-ink-900)]">Edit Manager Profile</h2>
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
                    Department
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.department}
                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
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
                    Office Location
                  </label>
                  <input
                    type="text"
                    value={editForm.officeLocation}
                    onChange={(e) => setEditForm({ ...editForm, officeLocation: e.target.value })}
                    className="input"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-3 py-1.5 text-xs text-[var(--color-ink-600)] hover:text-[var(--color-ink-900)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[var(--color-harbor-600)] hover:bg-[var(--color-harbor-700)] text-white font-semibold rounded"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Assign Course */}
        {isAssignCourseModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl p-6 space-y-4 border border-[var(--color-line)]">
              <h2 className="text-base font-bold text-[var(--color-ink-900)]">Assign Course Oversight</h2>
              <form onSubmit={handleAssignCourse} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--color-ink-700)] mb-1">
                    Select Course
                  </label>
                  <select
                    value={selectedCourseToAssign}
                    onChange={(e) => setSelectedCourseToAssign(e.target.value)}
                    className="input"
                  >
                    <option value="Cyber Security">Cyber Security</option>
                    <option value="Full-Stack Web Development">Full-Stack Web Development</option>
                    <option value="Data Analytics">Data Analytics</option>
                    <option value="Python for AI">Python for AI</option>
                    <option value="UI/UX Product Design">UI/UX Product Design</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAssignCourseModalOpen(false)}
                    className="px-3 py-1.5 text-xs text-[var(--color-ink-600)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[var(--color-harbor-600)] text-white font-semibold rounded"
                  >
                    Assign Course
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
              <h2 className="text-base font-bold text-[var(--color-ink-900)]">Assign Cohort Oversight</h2>
              <form onSubmit={handleAssignCohort} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--color-ink-700)] mb-1">
                    Select Cohort
                  </label>
                  <select
                    value={selectedCohortToAssign}
                    onChange={(e) => setSelectedCohortToAssign(e.target.value)}
                    className="input"
                  >
                    <option value="Cohort A">Cohort A (Aug – Nov 2025)</option>
                    <option value="Cohort B">Cohort B (Sep – Dec 2025)</option>
                    <option value="Cohort C">Cohort C (Upcoming 2026)</option>
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
  // MANAGERS DIRECTORY LIST
  // ==========================================
  return (
    <div id="managers-management-page" className="space-y-6 pb-16">
      <PageHeader
        title="Program Managers"
        subtitle="Oversee program directors, academic operational management, and curriculum governance."
        actions={
          canManage && (
            <button
              id="new-manager-btn"
              type="button"
              onClick={() => {
                setEditForm({
                  fullName: '',
                  email: '',
                  phone: '',
                  department: '',
                  officeLocation: '',
                })
                setIsCreateModalOpen(true)
              }}
              className="px-3.5 py-2 bg-[var(--color-harbor-600)] hover:bg-[var(--color-harbor-700)] text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
            >
              <Plus size={15} />
              <span>Add Manager</span>
            </button>
          )
        }
      />

      {/* Filter and Search Bar */}
      <Card className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[var(--color-ink-400)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search managers by name, department, or email..."
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
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-ink-500)]">Department:</span>
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-[var(--color-line)] rounded-lg text-xs text-[var(--color-ink-800)] max-w-[200px] truncate"
          >
            <option value="all">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Managers Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[var(--color-paper)] text-[var(--color-ink-600)] border-b border-[var(--color-line)] uppercase font-semibold">
              <tr>
                <th className="px-5 py-3">Manager & Department</th>
                <th className="px-4 py-3">Assigned Courses</th>
                <th className="px-4 py-3">Cohorts</th>
                <th className="px-4 py-3 text-center">Students</th>
                <th className="px-4 py-3 text-center">Reports</th>
                <th className="px-4 py-3 text-center">KPI Score</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {filteredManagers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-[var(--color-ink-400)]">
                    <Briefcase className="w-8 h-8 mx-auto mb-2 text-[var(--color-ink-300)]" />
                    <p className="text-sm font-semibold text-[var(--color-ink-800)]">No managers found</p>
                    <p className="text-xs text-[var(--color-ink-500)] mt-0.5">
                      Adjust your search criteria or register a new program manager.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredManagers.map((mgr) => (
                  <tr
                    key={mgr.id}
                    onClick={() => setSelectedManagerId(mgr.id)}
                    className="hover:bg-[var(--color-paper)]/70 cursor-pointer transition-colors group"
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-[var(--color-ink-900)] group-hover:text-[var(--color-harbor-600)] flex items-center gap-2">
                        <span>{mgr.fullName}</span>
                      </div>
                      <div className="text-[11px] text-[var(--color-ink-500)] mt-0.5">
                        {mgr.department}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {mgr.assignedCourses.map((c) => (
                          <span
                            key={c}
                            className="px-1.5 py-0.5 bg-[var(--color-harbor-50)] text-[var(--color-harbor-700)] text-[10px] rounded font-medium"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {mgr.assignedCohorts.map((ch) => (
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
                      {mgr.studentsCount}
                    </td>

                    <td className="px-4 py-3.5 text-center font-semibold text-blue-700">
                      {mgr.reportsCount}
                    </td>

                    <td className="px-4 py-3.5 text-center font-semibold text-emerald-700">
                      {mgr.performanceScore}%
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <Badge tone={mgr.status === 'active' ? 'success' : 'neutral'}>
                        {mgr.status === 'active' ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canManage && (
                          <button
                            type="button"
                            title={mgr.status === 'active' ? 'Deactivate Manager' : 'Activate Manager'}
                            onClick={(e) => handleToggleStatus(mgr, e)}
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

      {/* Modal: Create Manager */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-6 space-y-4 border border-[var(--color-line)]">
            <h2 className="text-base font-bold text-[var(--color-ink-900)]">Add New Program Manager</h2>
            <form onSubmit={handleCreateManager} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--color-ink-700)] mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kolawole Adeleke"
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--color-ink-700)] mb-1">
                  Institutional Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. k.adeleke@ijeshadigitalhub.org"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--color-ink-700)] mb-1">
                  Department
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Academic Operations"
                  value={editForm.department}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                  className="input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--color-ink-700)] mb-1">
                    Initial Course
                  </label>
                  <select
                    value={selectedCourseToAssign}
                    onChange={(e) => setSelectedCourseToAssign(e.target.value)}
                    className="input"
                  >
                    <option value="Cyber Security">Cyber Security</option>
                    <option value="Full-Stack Web Development">Full-Stack Web</option>
                    <option value="Data Analytics">Data Analytics</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--color-ink-700)] mb-1">
                    Initial Cohort
                  </label>
                  <select
                    value={selectedCohortToAssign}
                    onChange={(e) => setSelectedCohortToAssign(e.target.value)}
                    className="input"
                  >
                    <option value="Cohort A">Cohort A</option>
                    <option value="Cohort B">Cohort B</option>
                  </select>
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
                  Save Manager
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
