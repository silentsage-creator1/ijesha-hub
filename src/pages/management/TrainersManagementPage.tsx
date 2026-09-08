import { useState, useMemo } from 'react'
import {
  GraduationCap,
  Search,
  Filter,
  Plus,
  BookOpen,
  Layers,
  Users,
  Calendar,
  CheckCircle2,
  Award,
  ArrowLeft,
  Mail,
  Phone,
  Pencil,
  Power,
  Clock,
} from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import { Card, Badge } from '@/components/ui/primitives'
import {
  getStoredTrainers,
  saveStoredTrainers,
  type TrainerRecord,
  logSystemActivity,
} from '@/lib/management'
import { useAuth } from '@/app/auth'

export function TrainersManagementPage() {
  const { user, profile, role } = useAuth()
  const canManage = role === 'admin' || role === 'manager'

  const [trainers, setTrainers] = useState<TrainerRecord[]>(getStoredTrainers())
  const [selectedTrainerId, setSelectedTrainerId] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('all')

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
    specialty: string
    bio: string
  }>({
    fullName: '',
    email: '',
    phone: '',
    specialty: '',
    bio: '',
  })

  const [selectedCourseToAssign, setSelectedCourseToAssign] = useState('Cyber Security')
  const [selectedCohortToAssign, setSelectedCohortToAssign] = useState('Cohort A')

  // Selected trainer
  const selectedTrainer = useMemo(() => {
    return trainers.find((t) => t.id === selectedTrainerId) || null
  }, [trainers, selectedTrainerId])

  // Specialties
  const specialties = useMemo(() => {
    const set = new Set<string>()
    trainers.forEach((t) => {
      if (t.specialty) set.add(t.specialty)
    })
    return Array.from(set)
  }, [trainers])

  // Filtered
  const filteredTrainers = useMemo(() => {
    return trainers.filter((t) => {
      if (
        searchQuery &&
        !t.fullName.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !t.specialty.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !t.email.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false
      }
      if (statusFilter !== 'all' && t.status !== statusFilter) return false
      if (specialtyFilter !== 'all' && t.specialty !== specialtyFilter) return false
      return true
    })
  }, [trainers, searchQuery, statusFilter, specialtyFilter])

  // Action: Toggle Status (Activate / Deactivate)
  const handleToggleStatus = (trainer: TrainerRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const nextStatus: 'active' | 'inactive' = trainer.status === 'active' ? 'inactive' : 'active'
    const updated = trainers.map((t) =>
      t.id === trainer.id ? { ...t, status: nextStatus } : t
    )
    setTrainers(updated)
    saveStoredTrainers(updated)

    logSystemActivity(
      profile?.full_name || user?.name || 'Administrator',
      role || 'admin',
      nextStatus === 'active' ? 'Activated Trainer' : 'Deactivated Trainer',
      trainer.fullName,
      'User',
      `Trainer status changed to ${nextStatus}.`
    )
  }

  // Action: Save Edit Trainer
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTrainer) return
    const updated = trainers.map((t) =>
      t.id === selectedTrainer.id ? { ...t, ...editForm } : t
    )
    setTrainers(updated)
    saveStoredTrainers(updated)
    setIsEditModalOpen(false)

    logSystemActivity(
      profile?.full_name || user?.name || 'Administrator',
      role || 'admin',
      'Updated Trainer Profile',
      selectedTrainer.fullName,
      'User',
      'Updated contact information and curriculum specialty.'
    )
  }

  // Action: Assign Course
  const handleAssignCourse = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTrainer) return
    if (!selectedTrainer.courses.includes(selectedCourseToAssign)) {
      const newCourses = [...selectedTrainer.courses, selectedCourseToAssign]
      const updated = trainers.map((t) =>
        t.id === selectedTrainer.id ? { ...t, courses: newCourses } : t
      )
      setTrainers(updated)
      saveStoredTrainers(updated)

      logSystemActivity(
        profile?.full_name || user?.name || 'Administrator',
        role || 'admin',
        'Assigned Course to Trainer',
        `${selectedCourseToAssign} → ${selectedTrainer.fullName}`,
        'Course',
        `Added course ${selectedCourseToAssign} to trainer instructional catalog.`
      )
    }
    setIsAssignCourseModalOpen(false)
  }

  // Action: Assign Cohort
  const handleAssignCohort = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTrainer) return
    if (!selectedTrainer.cohorts.includes(selectedCohortToAssign)) {
      const newCohorts = [...selectedTrainer.cohorts, selectedCohortToAssign]
      const updated = trainers.map((t) =>
        t.id === selectedTrainer.id ? { ...t, cohorts: newCohorts } : t
      )
      setTrainers(updated)
      saveStoredTrainers(updated)

      logSystemActivity(
        profile?.full_name || user?.name || 'Administrator',
        role || 'admin',
        'Assigned Cohort to Trainer',
        `${selectedCohortToAssign} → ${selectedTrainer.fullName}`,
        'Cohort',
        `Assigned instructional lead for ${selectedCohortToAssign}.`
      )
    }
    setIsAssignCohortModalOpen(false)
  }

  // Action: Create Trainer
  const handleCreateTrainer = (e: React.FormEvent) => {
    e.preventDefault()
    const newTrainer: TrainerRecord = {
      id: `tr-${Date.now().toString().slice(-4)}`,
      fullName: editForm.fullName,
      email: editForm.email,
      phone: editForm.phone || '+234 800 000 0000',
      specialty: editForm.specialty || 'General Digital Technology',
      status: 'active',
      courses: [selectedCourseToAssign],
      cohorts: [selectedCohortToAssign],
      studentsCount: 20,
      sessionsTotal: 12,
      sessionsCompleted: 0,
      attendanceRate: 100,
      performanceRating: 5.0,
      joinDate: 'Just now',
      bio: editForm.bio || 'Instructional tutor at Ijesha Digital Hub.',
    }
    const updated = [newTrainer, ...trainers]
    setTrainers(updated)
    saveStoredTrainers(updated)
    setIsCreateModalOpen(false)
    setSelectedTrainerId(newTrainer.id)

    logSystemActivity(
      profile?.full_name || user?.name || 'Administrator',
      role || 'admin',
      'Onboarded New Trainer',
      newTrainer.fullName,
      'User',
      `Created trainer account with assigned course ${selectedCourseToAssign}.`
    )
  }

  // ==========================================
  // TRAINER PROFILE VIEW
  // ==========================================
  if (selectedTrainer) {
    return (
      <div id="trainer-profile-view" className="space-y-6 pb-16">
        {/* Back navigation & Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)] pb-4">
          <div className="flex items-center gap-3">
            <button
              id="back-to-trainers-btn"
              type="button"
              onClick={() => setSelectedTrainerId(null)}
              className="p-1.5 rounded-lg border border-[var(--color-line)] bg-white text-[var(--color-ink-700)] hover:bg-[var(--color-paper)] transition-colors"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold font-display text-[var(--color-ink-900)]">
                  {selectedTrainer.fullName}
                </h1>
                <Badge tone={selectedTrainer.status === 'active' ? 'success' : 'neutral'}>
                  {selectedTrainer.status === 'active' ? 'Active Staff' : 'Inactive'}
                </Badge>
              </div>
              <p className="text-xs text-[var(--color-ink-500)] mt-0.5">
                {selectedTrainer.specialty} • Joined {selectedTrainer.joinDate}
              </p>
            </div>
          </div>

          {/* Admin action buttons */}
          {canManage && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditForm({
                    fullName: selectedTrainer.fullName,
                    email: selectedTrainer.email,
                    phone: selectedTrainer.phone,
                    specialty: selectedTrainer.specialty,
                    bio: selectedTrainer.bio,
                  })
                  setIsEditModalOpen(true)
                }}
                className="px-3 py-1.5 bg-white border border-[var(--color-line)] rounded-lg text-xs font-semibold text-[var(--color-ink-800)] hover:bg-[var(--color-paper)] flex items-center gap-1.5"
              >
                <Pencil size={13} />
                <span>Edit Trainer</span>
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
                onClick={() => handleToggleStatus(selectedTrainer)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  selectedTrainer.status === 'active'
                    ? 'bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100'
                    : 'bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                <Power size={13} />
                <span>{selectedTrainer.status === 'active' ? 'Deactivate' : 'Activate'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Overview Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <Card className="p-3.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-500)] block">
              Courses
            </span>
            <span className="text-2xl font-bold font-display text-[var(--color-ink-900)] mt-1 block">
              {selectedTrainer.courses.length}
            </span>
            <span className="text-[10px] text-[var(--color-ink-400)]">Assigned curriculum</span>
          </Card>

          <Card className="p-3.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-500)] block">
              Cohorts
            </span>
            <span className="text-2xl font-bold font-display text-[var(--color-ink-900)] mt-1 block">
              {selectedTrainer.cohorts.length}
            </span>
            <span className="text-[10px] text-[var(--color-ink-400)]">Active batches</span>
          </Card>

          <Card className="p-3.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-500)] block">
              Students
            </span>
            <span className="text-2xl font-bold font-display text-[var(--color-ink-900)] mt-1 block">
              {selectedTrainer.studentsCount}
            </span>
            <span className="text-[10px] text-[var(--color-ink-400)]">Under supervision</span>
          </Card>

          <Card className="p-3.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-500)] block">
              Sessions
            </span>
            <span className="text-2xl font-bold font-display text-[var(--color-ink-900)] mt-1 block">
              {selectedTrainer.sessionsCompleted} / {selectedTrainer.sessionsTotal}
            </span>
            <span className="text-[10px] text-[var(--color-ink-400)]">Completed sessions</span>
          </Card>

          <Card className="p-3.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">
              Attendance
            </span>
            <span className="text-2xl font-bold font-display text-emerald-600 mt-1 block">
              {selectedTrainer.attendanceRate}%
            </span>
            <span className="text-[10px] text-[var(--color-ink-400)]">Average cohort rate</span>
          </Card>

          <Card className="p-3.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 block">
              Performance
            </span>
            <span className="text-2xl font-bold font-display text-amber-600 mt-1 block">
              {selectedTrainer.performanceRating} <span className="text-xs text-[var(--color-ink-400)]">/ 5.0</span>
            </span>
            <span className="text-[10px] text-[var(--color-ink-400)]">Tutor evaluation score</span>
          </Card>
        </div>

        {/* Tabular Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Courses & Cohorts Card */}
          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-bold text-[var(--color-ink-900)] flex items-center gap-2">
              <BookOpen size={16} className="text-[var(--color-harbor-600)]" />
              <span>Assigned Courses & Active Cohorts</span>
            </h2>

            <div>
              <span className="text-xs font-semibold text-[var(--color-ink-600)] block mb-2">
                Courses Taught
              </span>
              <div className="flex flex-wrap gap-2">
                {selectedTrainer.courses.map((c) => (
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
                Assigned Cohorts
              </span>
              <div className="flex flex-wrap gap-2">
                {selectedTrainer.cohorts.map((ch) => (
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
                Biography & Experience
              </span>
              <p className="text-xs text-[var(--color-ink-600)] leading-relaxed">
                {selectedTrainer.bio}
              </p>
            </div>
          </Card>

          {/* Contact & Administration Profile */}
          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-bold text-[var(--color-ink-900)] flex items-center gap-2">
              <Users size={16} className="text-[var(--color-harbor-600)]" />
              <span>Contact & Staff Credentials</span>
            </h2>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-[var(--color-line)]">
                <span className="text-[var(--color-ink-500)] flex items-center gap-2">
                  <Mail size={14} /> Email Address
                </span>
                <span className="font-semibold text-[var(--color-ink-900)]">{selectedTrainer.email}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[var(--color-line)]">
                <span className="text-[var(--color-ink-500)] flex items-center gap-2">
                  <Phone size={14} /> Phone Number
                </span>
                <span className="font-semibold text-[var(--color-ink-900)]">{selectedTrainer.phone}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[var(--color-line)]">
                <span className="text-[var(--color-ink-500)] flex items-center gap-2">
                  <Calendar size={14} /> Onboarding Date
                </span>
                <span className="font-semibold text-[var(--color-ink-900)]">{selectedTrainer.joinDate}</span>
              </div>

              <div className="flex items-center justify-between py-1.5">
                <span className="text-[var(--color-ink-500)] flex items-center gap-2">
                  <Award size={14} /> Instructor Status
                </span>
                <Badge tone={selectedTrainer.status === 'active' ? 'success' : 'neutral'}>
                  {selectedTrainer.status === 'active' ? 'Certified Active' : 'Suspended'}
                </Badge>
              </div>
            </div>
          </Card>
        </div>

        {/* Training Sessions & Attendance Performance Table */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-[var(--color-ink-900)]">
                Training Sessions & Attendance Logs
              </h2>
              <p className="text-xs text-[var(--color-ink-500)]">
                Record of weekly curriculum delivery and classroom participation.
              </p>
            </div>
            <span className="text-xs text-[var(--color-harbor-600)] font-semibold">
              {selectedTrainer.sessionsCompleted} of {selectedTrainer.sessionsTotal} sessions logged
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[var(--color-paper)] text-[var(--color-ink-600)] border-b border-[var(--color-line)]">
                <tr>
                  <th className="px-4 py-2.5">Session Topic</th>
                  <th className="px-4 py-2.5">Cohort</th>
                  <th className="px-4 py-2.5">Delivery Status</th>
                  <th className="px-4 py-2.5 text-center">Class Attendance</th>
                  <th className="px-4 py-2.5 text-right">Student Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                <tr>
                  <td className="px-4 py-3 font-medium text-[var(--color-ink-900)]">
                    Threat Modeling & Defensive Perimeter Design
                  </td>
                  <td className="px-4 py-3 text-[var(--color-ink-600)]">Cohort A</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                      <CheckCircle2 size={13} /> Completed
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-emerald-700">96%</td>
                  <td className="px-4 py-3 text-right font-semibold text-amber-600">4.9 / 5.0</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-[var(--color-ink-900)]">
                    Vulnerability Scanning & OpenVAS Configuration
                  </td>
                  <td className="px-4 py-3 text-[var(--color-ink-600)]">Cohort A</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                      <CheckCircle2 size={13} /> Completed
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-emerald-700">92%</td>
                  <td className="px-4 py-3 text-right font-semibold text-amber-600">4.8 / 5.0</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-[var(--color-ink-900)]">
                    Incident Response Drills & SOC Simulation
                  </td>
                  <td className="px-4 py-3 text-[var(--color-ink-600)]">Cohort B</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-blue-700 font-semibold">
                      <Clock size={13} /> Scheduled Next
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-[var(--color-ink-400)]">—</td>
                  <td className="px-4 py-3 text-right text-[var(--color-ink-400)]">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        {/* Modal: Edit Trainer */}
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-6 space-y-4 border border-[var(--color-line)]">
              <h2 className="text-base font-bold text-[var(--color-ink-900)]">Edit Trainer Profile</h2>
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
                    Instructional Specialty
                  </label>
                  <input
                    type="text"
                    value={editForm.specialty}
                    onChange={(e) => setEditForm({ ...editForm, specialty: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--color-ink-700)] mb-1">
                    Biography
                  </label>
                  <textarea
                    rows={3}
                    value={editForm.bio}
                    onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
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
              <h2 className="text-base font-bold text-[var(--color-ink-900)]">Assign Course to Trainer</h2>
              <form onSubmit={handleAssignCourse} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--color-ink-700)] mb-1">
                    Select Course Track
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
              <h2 className="text-base font-bold text-[var(--color-ink-900)]">Assign Cohort to Trainer</h2>
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
  // TRAINERS DIRECTORY LIST
  // ==========================================
  return (
    <div id="trainers-management-page" className="space-y-6 pb-16">
      <PageHeader
        title="Trainers & Tutors Management"
        subtitle="Manage instructional staff, assigned courses, cohort schedules, and teaching performance."
        actions={
          canManage && (
            <button
              id="new-trainer-btn"
              type="button"
              onClick={() => {
                setEditForm({
                  fullName: '',
                  email: '',
                  phone: '',
                  specialty: '',
                  bio: '',
                })
                setIsCreateModalOpen(true)
              }}
              className="px-3.5 py-2 bg-[var(--color-harbor-600)] hover:bg-[var(--color-harbor-700)] text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
            >
              <Plus size={15} />
              <span>Onboard Trainer</span>
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
            placeholder="Search trainers by name, specialty, or email..."
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
          <span className="text-xs text-[var(--color-ink-500)]">Specialty:</span>
          <select
            value={specialtyFilter}
            onChange={(e) => setSpecialtyFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-[var(--color-line)] rounded-lg text-xs text-[var(--color-ink-800)] max-w-[180px] truncate"
          >
            <option value="all">All Disciplines</option>
            {specialties.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Trainers Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[var(--color-paper)] text-[var(--color-ink-600)] border-b border-[var(--color-line)] uppercase font-semibold">
              <tr>
                <th className="px-5 py-3">Trainer Name & Specialty</th>
                <th className="px-4 py-3">Assigned Courses</th>
                <th className="px-4 py-3">Cohorts</th>
                <th className="px-4 py-3 text-center">Students</th>
                <th className="px-4 py-3 text-center">Attendance %</th>
                <th className="px-4 py-3 text-center">Rating</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {filteredTrainers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-[var(--color-ink-400)]">
                    <GraduationCap className="w-8 h-8 mx-auto mb-2 text-[var(--color-ink-300)]" />
                    <p className="text-sm font-semibold text-[var(--color-ink-800)]">No trainers found</p>
                    <p className="text-xs text-[var(--color-ink-500)] mt-0.5">
                      Adjust your search or add a new instructor to the directory.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredTrainers.map((trainer) => (
                  <tr
                    key={trainer.id}
                    onClick={() => setSelectedTrainerId(trainer.id)}
                    className="hover:bg-[var(--color-paper)]/70 cursor-pointer transition-colors group"
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-[var(--color-ink-900)] group-hover:text-[var(--color-harbor-600)] flex items-center gap-2">
                        <span>{trainer.fullName}</span>
                      </div>
                      <div className="text-[11px] text-[var(--color-ink-500)] mt-0.5">
                        {trainer.specialty}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {trainer.courses.slice(0, 2).map((c) => (
                          <span
                            key={c}
                            className="px-1.5 py-0.5 bg-[var(--color-harbor-50)] text-[var(--color-harbor-700)] text-[10px] rounded font-medium"
                          >
                            {c}
                          </span>
                        ))}
                        {trainer.courses.length > 2 && (
                          <span className="text-[10px] text-[var(--color-ink-400)]">
                            +{trainer.courses.length - 2} more
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {trainer.cohorts.map((ch) => (
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
                      {trainer.studentsCount}
                    </td>

                    <td className="px-4 py-3.5 text-center font-semibold text-emerald-700">
                      {trainer.attendanceRate}%
                    </td>

                    <td className="px-4 py-3.5 text-center font-semibold text-amber-600">
                      ★ {trainer.performanceRating}
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <Badge tone={trainer.status === 'active' ? 'success' : 'neutral'}>
                        {trainer.status === 'active' ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canManage && (
                          <button
                            type="button"
                            title={trainer.status === 'active' ? 'Deactivate Trainer' : 'Activate Trainer'}
                            onClick={(e) => handleToggleStatus(trainer, e)}
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

      {/* Modal: Onboard Trainer */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-6 space-y-4 border border-[var(--color-line)]">
            <h2 className="text-base font-bold text-[var(--color-ink-900)]">Onboard New Trainer</h2>
            <form onSubmit={handleCreateTrainer} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--color-ink-700)] mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Engr. Bamidele Adeleke"
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
                  placeholder="e.g. b.adeleke@ijeshadigitalhub.org"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--color-ink-700)] mb-1">
                  Instructional Specialty
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cloud Security & DevOps"
                  value={editForm.specialty}
                  onChange={(e) => setEditForm({ ...editForm, specialty: e.target.value })}
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
                    <option value="UI/UX Product Design">UI/UX Design</option>
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
                  Onboard Instructor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
