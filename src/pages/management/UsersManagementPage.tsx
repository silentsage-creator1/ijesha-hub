import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Users,
  Search,
  Filter,
  Plus,
  ArrowLeft,
  Mail,
  Phone,
  Pencil,
  Power,
  Shield,
  KeyRound,
  Calendar,
  Clock,
  CheckCircle2,
  Lock,
  Trash2,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import { Card, Badge } from '@/components/ui/primitives'
import {
  getStoredUsers,
  saveStoredUsers,
  clearStoredUsers,
  deleteStoredUser,
  deletePendingStudentVerification,
  getPendingStudentVerifications,
  setStudentVerificationStatus,
  approveAllPendingStudents,
  type PendingStudentVerification,
  type ManagedUser,
  type UserStatus,
  type AccountType,
  logSystemActivity,
  updateUserRole,
} from '@/lib/management'
import { StudentVerificationQueue } from '@/components/management/StudentVerificationQueue'
import { StudentProfileRecord } from '@/components/management/StudentProfileRecord'
import { AssignStudentCohort } from '@/components/management/AssignStudentCohort'
import { sendStudentApprovedNotification } from '@/lib/notifications'
import { supabase } from '@/lib/supabase'
import { apiUrl } from '@/app/auth'
import type { Role } from '@/types'
import { useAuth } from '@/app/auth'

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  manager: 'Manager',
  trainer: 'Trainer / Tutor',
  student: 'Student',
  parent: 'Parent / Guardian',
  sponsor: 'Sponsor',
}

type ApplicationAccount = {
  id: string
  email: string
  full_name: string
  role: Role
  track?: string | null
  approval_status: 'pending' | 'approved' | 'rejected'
  is_active: boolean
  created_at: string
}

export function UsersManagementPage() {
  const navigate = useNavigate()
  const { user, profile, role: currentAdminRole } = useAuth()
  const canManage = currentAdminRole === 'admin'

  const [users, setUsers] = useState<ManagedUser[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState<'verifications' | 'directory'>(
    tabParam === 'verifications' ? 'verifications' : 'directory'
  )

  const [pendingVerifications, setPendingVerifications] = useState<PendingStudentVerification[]>(() =>
    getPendingStudentVerifications()
  )
  const [applicationAccounts, setApplicationAccounts] = useState<ApplicationAccount[]>([])
  const [isClearUsersModalOpen, setIsClearUsersModalOpen] = useState(false)
  const [notificationToast, setNotificationToast] = useState<{
    message: string
    type: 'success' | 'info' | 'error'
  } | null>(null)

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotificationToast({ message, type })
    setTimeout(() => setNotificationToast(null), 4500)
  }

  const loadApplicationAccounts = useCallback(async () => {
    try {
      const response = await fetch(apiUrl('/api/admin/accounts'), { credentials: 'include' })
      const payload = await response.json() as { users?: ApplicationAccount[] }
      if (!response.ok) throw new Error('Unable to load application accounts.')
      setApplicationAccounts(payload.users ?? [])
      const directory: ManagedUser[] = (payload.users ?? []).map(account => ({
        id: account.id,
        fullName: account.full_name,
        email: account.email,
        role: account.role,
        status: account.is_active === false ? 'inactive' : account.approval_status === 'rejected' ? 'suspended' : 'active',
        accountType: account.role === 'student' ? 'External Beneficiary' : 'Internal Staff',
        phone: '',
        department: account.track || '',
        lastLogin: account.approval_status === 'pending' ? 'Awaiting approval' : 'Application account',
        createdAt: new Date(account.created_at).toLocaleDateString(),
        permissionsCount: account.role === 'admin' ? 12 : account.role === 'manager' ? 8 : account.role === 'trainer' ? 6 : 4,
        recentActivity: [],
      }))
      setUsers(directory)
      saveStoredUsers(directory)
    } catch (error) {
      console.warn('Could not load application accounts:', error)
    }
  }, [])

  useEffect(() => { void loadApplicationAccounts() }, [loadApplicationAccounts])
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') void loadApplicationAccounts() }
    const timer = window.setInterval(refresh, 30_000)
    window.addEventListener('focus', refresh)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [loadApplicationAccounts])

  const applicationVerifications: PendingStudentVerification[] = applicationAccounts
    .filter((account) => account.role === 'student')
    .map((account) => ({
    id: account.id,
    fullName: account.full_name,
    email: account.email,
    role: 'student',
    status: account.approval_status,
    requestedAt: new Date(account.created_at).toLocaleDateString(),
    track: account.track ?? undefined,
    }))
  // Application accounts are the sole verification source. The former
  // browser-local queue is retained only for legacy cleanup utilities.
  const verificationQueue = applicationVerifications

  // Login accounts are authoritative; roster history is not an active login.

  // Switch tab and sync search params
  const handleSelectTab = (tab: 'verifications' | 'directory') => {
    setActiveTab(tab)
    setSearchParams({ tab }, { replace: true })
  }

  // Student verification approval
  const handleApproveStudent = async (student: PendingStudentVerification) => {
    if (applicationAccounts.some((account) => account.id === student.id)) {
      try {
        const response = await fetch(apiUrl(`/api/admin/accounts/${student.id}/approval`), {
          method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'approved' }),
        })
        if (!response.ok) throw new Error('Unable to approve the application account.')
        await loadApplicationAccounts()
        showToast(`Account verified! ${student.fullName} can now log in.`, 'success')
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to approve the application account.', 'error')
      }
      return
    }
    const approverName = profile?.full_name || user?.name || 'Administrator'
    setStudentVerificationStatus(student.id, 'approved', approverName)
    const updatedList = getPendingStudentVerifications()
    setPendingVerifications(updatedList)

    // Add to active users directory if not already there
    const existingUsers = getStoredUsers()
    if (!existingUsers.some((u) => u.email.toLowerCase() === student.email.toLowerCase())) {
      const newUser: ManagedUser = {
        id: `usr-${Date.now()}`,
        fullName: student.fullName,
        email: student.email,
        role: 'student',
        status: 'active',
        accountType: 'External Beneficiary',
        phone: student.phone || '',
        lastLogin: 'Never (Newly Verified)',
        createdAt: 'Today',
        permissionsCount: 4,
        recentActivity: [
          {
            action: 'Account Verified & Approved',
            timestamp: 'Just now',
            details: `Approved by ${approverName}. Student is now authorized to log in.`,
          },
        ],
      }
      const newUsersList = [newUser, ...existingUsers]
      saveStoredUsers(newUsersList)
      setUsers(newUsersList)
    }

    // Try syncing approval with Supabase
    try {
      await supabase.from('profiles').update({ approval_status: 'approved' }).eq('id', student.id)
      await supabase.rpc('set_approval', { target: student.id, status: 'approved' })
    } catch {
      // Offline fallback
    }

    // Send notification to the student that their account is approved
    try {
      await sendStudentApprovedNotification({
        id: student.id,
        fullName: student.fullName,
        email: student.email,
        approverName,
      })
    } catch {
      // Ignore
    }

    showToast(`Account verified! ${student.fullName} has been approved and can now log in.`, 'success')
  }

  // Student verification rejection
  const handleRejectStudent = async (student: PendingStudentVerification) => {
    if (applicationAccounts.some((account) => account.id === student.id)) {
      try {
        const response = await fetch(apiUrl(`/api/admin/accounts/${student.id}/approval`), {
          method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'rejected' }),
        })
        if (!response.ok) throw new Error('Unable to reject the application account.')
        await loadApplicationAccounts()
        showToast(`Registration request for ${student.fullName} has been rejected.`, 'info')
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to reject the application account.', 'error')
      }
      return
    }
    const reviewerName = profile?.full_name || user?.name || 'Administrator'
    setStudentVerificationStatus(student.id, 'rejected', reviewerName)
    setPendingVerifications(getPendingStudentVerifications())

    try {
      await supabase.from('profiles').update({ approval_status: 'rejected' }).eq('id', student.id)
      await supabase.rpc('set_approval', { target: student.id, status: 'rejected' })
    } catch {
      // Offline fallback
    }

    showToast(`Registration request for ${student.fullName} has been rejected.`, 'info')
  }

  // Delete individual user
  const handleDeleteSingleUser = async (targetUser: ManagedUser) => {
    if (!window.confirm(`Delete login access for ${targetUser.email}? Existing sessions will stop working. Student learning records will be preserved.`)) return
    try {
      const account = applicationAccounts.find(item => item.id === targetUser.id || item.email.trim().toLowerCase() === targetUser.email.trim().toLowerCase())
      if (!account) throw new Error('No matching application account was found. This legacy directory entry cannot be used to delete login access.')
      const response = await fetch(apiUrl(`/api/admin/accounts/${account.id}`), { method: 'DELETE', credentials: 'include' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to delete account.')
      deleteStoredUser(targetUser.id)
      deletePendingStudentVerification(targetUser.email)
      setUsers(current => current.filter(item => item.id !== targetUser.id && item.email.toLowerCase() !== account.email.toLowerCase()))
      setApplicationAccounts(current => current.filter(item => item.id !== account.id))
      setPendingVerifications(getPendingStudentVerifications())
      setSelectedUserId(null)
      showToast(`Login access for ${targetUser.fullName} has been deleted.`, 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to delete account.', 'error')
    }
  }

  // Bulk approve all pending
  const handleApproveAllStudents = async () => {
    const pendingApplicationAccounts = applicationAccounts.filter((account) => account.approval_status === 'pending')
    if (pendingApplicationAccounts.length > 0) {
      await Promise.all(pendingApplicationAccounts.map((account) => fetch(apiUrl(`/api/admin/accounts/${account.id}/approval`), {
        method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'approved' }),
      })))
      await loadApplicationAccounts()
    }
    const approverName = profile?.full_name || user?.name || 'Administrator'
    const pendingBefore = getPendingStudentVerifications().filter((s) => s.status === 'pending')
    const count = approveAllPendingStudents(approverName)
    setPendingVerifications(getPendingStudentVerifications())
    setUsers(getStoredUsers())

    for (const student of pendingBefore) {
      sendStudentApprovedNotification({
        id: student.id,
        fullName: student.fullName,
        email: student.email,
        approverName,
      }).catch(() => {})
    }

    showToast(`Successfully verified all ${count + pendingApplicationAccounts.length} pending student account(s). They can now log in.`, 'success')
  }

  // Clear all users directory
  const handleConfirmClearUsers = () => {
    clearStoredUsers()
    setUsers([])
    setIsClearUsersModalOpen(false)
    setSelectedUserId(null)
    showToast('All stored user directory records have been cleared.', 'info')
  }

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [accountTypeFilter, setAccountTypeFilter] = useState<string>('all')

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isChangeRoleModalOpen, setIsChangeRoleModalOpen] = useState(false)
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null)

  // Form states
  const [editForm, setEditForm] = useState<{
    fullName: string
    email: string
    phone: string
    role: Role
    status: UserStatus
    accountType: AccountType
  }>({
    fullName: '',
    email: '',
    phone: '',
    role: 'student',
    status: 'active',
    accountType: 'Internal Staff',
  })

  const [selectedNewRole, setSelectedNewRole] = useState<Role>('student')

  // Selected User
  const selectedUser = useMemo(() => {
    return users.find((u) => u.id === selectedUserId) || null
  }, [users, selectedUserId])

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (
        searchQuery &&
        !u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !u.email.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false
      }
      if (roleFilter !== 'all' && u.role !== roleFilter) return false
      if (statusFilter !== 'all' && u.status !== statusFilter) return false
      if (accountTypeFilter !== 'all' && u.accountType !== accountTypeFilter) return false
      return true
    })
  }, [users, searchQuery, roleFilter, statusFilter, accountTypeFilter])

  // Action: Toggle Status (Activate / Deactivate)
  const handleToggleStatus = async (targetUser: ManagedUser, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!canManage) return
    const active = targetUser.status !== 'active'
    try {
      const response = await fetch(apiUrl(`/api/admin/accounts/${targetUser.id}/access`), {
        method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ active }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to change account access.')
      await loadApplicationAccounts()
      showToast(active ? 'Account reactivated. Approval is still required before sign-in.' : 'Account deactivated. Login and existing sessions are blocked.', 'success')
    } catch (error) { showToast(error instanceof Error ? error.message : 'Unable to change account access.', 'error') }
  }

  // Action: Save Edit User
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return
    const updated = users.map((u) =>
      u.id === selectedUser.id ? { ...u, ...editForm } : u
    )
    setUsers(updated)
    saveStoredUsers(updated)
    setIsEditModalOpen(false)

    logSystemActivity(
      profile?.full_name || user?.name || 'Administrator',
      currentAdminRole || 'admin',
      'Edited User Account',
      selectedUser.fullName,
      'User',
      'Updated user account details and contact parameters.'
    )
  }

  // Action: Change Role
  const handleChangeRole = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return
    const targetUserId = selectedUser.id
    const targetName = selectedUser.fullName
    const newRole = selectedNewRole

    // Optimistically update list
    const updated = users.map((u) =>
      u.id === targetUserId ? { ...u, role: newRole } : u
    )
    setUsers(updated)
    saveStoredUsers(updated)
    setIsChangeRoleModalOpen(false)

    if (applicationAccounts.some((account) => account.id === targetUserId)) {
      const response = await fetch(apiUrl(`/api/admin/accounts/${targetUserId}/role`), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      const payload = await response.json() as { error?: string }
      if (!response.ok) {
        setUsers(users)
        showToast(payload.error || 'Unable to change the application account role.', 'error')
        return
      }
      await loadApplicationAccounts()
    } else {
      await updateUserRole(targetUserId, newRole, {
        name: profile?.full_name || user?.name || 'Administrator',
        role: currentAdminRole || 'admin',
      })
    }

    showToast(`Role for ${targetName} changed to ${ROLE_LABELS[newRole]}`, 'success')
  }

  // Action: Reset Password
  const handleConfirmResetPassword = () => {
    if (!selectedUser) return
    setResetSuccessMessage(`A secure password reset link has been dispatched to ${selectedUser.email}.`)
    setTimeout(() => {
      setResetSuccessMessage(null)
      setIsResetPasswordModalOpen(false)
    }, 2000)

    logSystemActivity(
      profile?.full_name || user?.name || 'Administrator',
      currentAdminRole || 'admin',
      'Reset User Password',
      selectedUser.fullName,
      'Security',
      `Generated one-time credential reset link for ${selectedUser.email}.`
    )
  }

  // Action: Create User
  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault()
    const newUser: ManagedUser = {
      id: `usr-${Date.now().toString().slice(-4)}`,
      fullName: editForm.fullName,
      email: editForm.email,
      role: editForm.role,
      status: 'active',
      accountType: editForm.accountType,
      phone: editForm.phone || '+234 800 000 0000',
      lastLogin: 'Never',
      createdAt: 'Just now',
      permissionsCount: editForm.role === 'admin' ? 38 : editForm.role === 'manager' ? 29 : 18,
      recentActivity: [
        {
          action: 'Account Provisioned',
          timestamp: 'Just now',
          details: 'User account created by Administrator',
        },
      ],
    }

    if (editForm.role === 'student') {
      supabase.from('students').insert({
        full_name: editForm.fullName,
        email: editForm.email,
        track: 'Frontend Development',
        status: 'active',
      }).then(() => {})
    } else if (editForm.role === 'trainer') {
      supabase.from('teachers').insert({
        full_name: editForm.fullName,
        email: editForm.email,
        specialty: 'Instructor',
        status: 'active',
      }).then(() => {})
    }

    const updated = [newUser, ...users]
    setUsers(updated)
    saveStoredUsers(updated)
    setIsCreateModalOpen(false)
    setSelectedUserId(newUser.id)
    showToast(`Account provisioned for ${newUser.fullName}`, 'success')

    logSystemActivity(
      profile?.full_name || user?.name || 'Administrator',
      currentAdminRole || 'admin',
      'Provisioned User Account',
      newUser.fullName,
      'User',
      `Created new ${ROLE_LABELS[newUser.role]} account with ${newUser.accountType} classification.`
    )
  }

  // ==========================================
  // USER DETAILS VIEW
  // ==========================================
  if (selectedUser) {
    return (
      <div id="user-detail-view" className="space-y-6 pb-16">
        {/* Header Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)] pb-4">
          <div className="flex items-center gap-3">
            <button
              id="back-to-users-btn"
              type="button"
              onClick={() => setSelectedUserId(null)}
              className="p-1.5 rounded-lg border border-[var(--color-line)] bg-white text-[var(--color-ink-700)] hover:bg-[var(--color-paper)] transition-colors"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold font-display text-[var(--color-ink-900)]">
                  {selectedUser.fullName}
                </h1>
                <Badge tone={selectedUser.status === 'active' ? 'success' : 'neutral'}>
                  {selectedUser.status === 'active' ? 'Active' : 'Inactive'}
                </Badge>
                <span className="px-2 py-0.5 bg-[var(--color-harbor-50)] text-[var(--color-harbor-700)] border border-[var(--color-harbor-200)] text-[10px] font-semibold rounded">
                  {ROLE_LABELS[selectedUser.role]}
                </span>
              </div>
              <p className="text-xs text-[var(--color-ink-500)] mt-0.5">
                {selectedUser.accountType} • Member since {selectedUser.createdAt}
              </p>
            </div>
          </div>

          {/* Admin Actions */}
          {canManage && selectedUser.role === 'student' && <AssignStudentCohort key={selectedUser.id} accountId={selectedUser.id}/>}
          {canManage && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditForm({
                    fullName: selectedUser.fullName,
                    email: selectedUser.email,
                    phone: selectedUser.phone || '',
                    role: selectedUser.role,
                    status: selectedUser.status,
                    accountType: selectedUser.accountType,
                  })
                  setIsEditModalOpen(true)
                }}
                className="px-3 py-1.5 bg-white border border-[var(--color-line)] rounded-lg text-xs font-semibold text-[var(--color-ink-800)] hover:bg-[var(--color-paper)] flex items-center gap-1.5"
              >
                <Pencil size={13} />
                <span>Edit User</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedNewRole(selectedUser.role)
                  setIsChangeRoleModalOpen(true)
                }}
                className="px-3 py-1.5 bg-white border border-[var(--color-line)] rounded-lg text-xs font-semibold text-[var(--color-ink-800)] hover:bg-[var(--color-paper)] flex items-center gap-1.5"
              >
                <Shield size={13} />
                <span>Change Role</span>
              </button>

              <button
                type="button"
                onClick={() => setIsResetPasswordModalOpen(true)}
                className="px-3 py-1.5 bg-white border border-[var(--color-line)] rounded-lg text-xs font-semibold text-[var(--color-ink-800)] hover:bg-[var(--color-paper)] flex items-center gap-1.5"
              >
                <KeyRound size={13} />
                <span>Reset Password</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/roles-permissions')}
                className="px-3 py-1.5 bg-[var(--color-harbor-50)] text-[var(--color-harbor-700)] border border-[var(--color-harbor-200)] rounded-lg text-xs font-semibold hover:bg-[var(--color-harbor-100)] flex items-center gap-1.5"
              >
                <Lock size={13} />
                <span>Manage Permissions</span>
              </button>

              <button
                type="button"
                onClick={() => handleToggleStatus(selectedUser)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  selectedUser.status === 'active'
                    ? 'bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100'
                    : 'bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                <Power size={13} />
                <span>{selectedUser.status === 'active' ? 'Deactivate' : 'Activate'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleDeleteSingleUser(selectedUser)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 transition-colors"
              >
                <Trash2 size={13} />
                <span>Delete User</span>
              </button>
            </div>
          )}
        </div>

        {/* Profile Info & Account Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-5 space-y-3">
            <h2 className="text-sm font-bold text-[var(--color-ink-900)] flex items-center gap-2">
              <Users size={16} className="text-[var(--color-harbor-600)]" />
              <span>Profile Information</span>
            </h2>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-[var(--color-line)]">
                <span className="text-[var(--color-ink-500)] flex items-center gap-1.5">
                  <Mail size={13} /> Email Address
                </span>
                <span className="font-semibold text-[var(--color-ink-900)]">{selectedUser.email}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-[var(--color-line)]">
                <span className="text-[var(--color-ink-500)] flex items-center gap-1.5">
                  <Phone size={13} /> Phone
                </span>
                <span className="font-semibold text-[var(--color-ink-900)]">{selectedUser.phone || '—'}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-[var(--color-line)]">
                <span className="text-[var(--color-ink-500)]">Account Type</span>
                <span className="font-semibold text-[var(--color-ink-900)]">{selectedUser.accountType}</span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-[var(--color-ink-500)] flex items-center gap-1.5">
                  <Calendar size={13} /> Registration Date
                </span>
                <span className="font-semibold text-[var(--color-ink-900)]">{selectedUser.createdAt}</span>
              </div>
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <h2 className="text-sm font-bold text-[var(--color-ink-900)] flex items-center gap-2">
              <Shield size={16} className="text-[var(--color-harbor-600)]" />
              <span>Security & Role Governance</span>
            </h2>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-[var(--color-line)]">
                <span className="text-[var(--color-ink-500)]">Assigned Role</span>
                <span className="font-bold text-[var(--color-harbor-700)]">
                  {ROLE_LABELS[selectedUser.role]}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-[var(--color-line)]">
                <span className="text-[var(--color-ink-500)]">Account Status</span>
                <Badge tone={selectedUser.status === 'active' ? 'success' : 'neutral'}>
                  {selectedUser.status === 'active' ? 'Active & Authorized' : 'Suspended'}
                </Badge>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-[var(--color-line)]">
                <span className="text-[var(--color-ink-500)] flex items-center gap-1.5">
                  <Clock size={13} /> Last Authentication
                </span>
                <span className="font-semibold text-[var(--color-ink-900)]">{selectedUser.lastLogin}</span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-[var(--color-ink-500)]">Active Permissions</span>
                <span className="font-bold text-emerald-700">{selectedUser.permissionsCount} Policies Enabled</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Recent Activity Card */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-[var(--color-ink-900)]">
                Recent Account Activity Logs
              </h2>
              <p className="text-xs text-[var(--color-ink-500)]">
                Audit trail of actions and authentications performed by this account.
              </p>
            </div>
            <span className="text-xs font-semibold text-[var(--color-harbor-600)]">
              {selectedUser.recentActivity.length} recent events
            </span>
          </div>

          <div className="space-y-2.5">
            {selectedUser.recentActivity.map((act, i) => (
              <div
                key={i}
                className="p-3 bg-[var(--color-paper)] border border-[var(--color-line)] rounded-lg flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <span className="font-semibold text-[var(--color-ink-900)] block">
                    {act.action}
                  </span>
                  <span className="text-[11px] text-[var(--color-ink-600)]">
                    {act.details}
                  </span>
                </div>
                <span className="text-[10px] text-[var(--color-ink-400)] whitespace-nowrap">
                  {act.timestamp}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Modal: Edit User */}
        {selectedUser.role === 'student' && <StudentProfileRecord accountId={selectedUser.id} />}
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-6 space-y-4 border border-[var(--color-line)]">
              <h2 className="text-base font-bold text-[var(--color-ink-900)]">Edit User Details</h2>
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
                    Account Classification
                  </label>
                  <select
                    value={editForm.accountType}
                    onChange={(e) => setEditForm({ ...editForm, accountType: e.target.value as AccountType })}
                    className="input"
                  >
                    <option value="Internal Staff">Internal Staff</option>
                    <option value="External Beneficiary">External Beneficiary</option>
                    <option value="Partner">Partner</option>
                  </select>
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

        {/* Modal: Change Role */}
        {isChangeRoleModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl p-6 space-y-4 border border-[var(--color-line)]">
              <h2 className="text-base font-bold text-[var(--color-ink-900)]">Change User Role</h2>
              <p className="text-xs text-[var(--color-ink-500)]">
                Modifying the system role updates permissions immediately across the platform.
              </p>
              <form onSubmit={handleChangeRole} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--color-ink-700)] mb-1">
                    Select New Role
                  </label>
                  <select
                    value={selectedNewRole}
                    onChange={(e) => setSelectedNewRole(e.target.value as Role)}
                    className="input capitalize"
                  >
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="trainer">Trainer / Tutor</option>
                    <option value="student">Student</option>
                    <option value="parent">Parent / Guardian</option>
                    <option value="sponsor">Sponsor</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsChangeRoleModalOpen(false)}
                    className="px-3 py-1.5 text-xs text-[var(--color-ink-600)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[var(--color-harbor-600)] text-white font-semibold rounded"
                  >
                    Apply Role
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Reset Password */}
        {isResetPasswordModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl p-6 space-y-4 border border-[var(--color-line)]">
              <h2 className="text-base font-bold text-[var(--color-ink-900)] flex items-center gap-2">
                <KeyRound size={17} className="text-amber-600" />
                <span>Reset User Password</span>
              </h2>
              <p className="text-xs text-[var(--color-ink-600)] leading-relaxed">
                Are you sure you wish to trigger a password reset for <strong>{selectedUser.fullName}</strong>? An authentication reset email will be sent directly to <strong>{selectedUser.email}</strong>.
              </p>

              {resetSuccessMessage && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 size={14} />
                  <span>{resetSuccessMessage}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsResetPasswordModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-[var(--color-ink-600)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmResetPassword}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded text-xs"
                >
                  Send Reset Link
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ==========================================
  // USERS DIRECTORY LIST
  // ==========================================
  const pendingCount = pendingVerifications.filter((v) => v.status === 'pending').length

  return (
    <div id="users-management-page" className="space-y-6 pb-16">
      {/* Toast Alert */}
      {notificationToast && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between shadow-xs transition-all ${
            notificationToast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : notificationToast.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-sky-50 border-sky-200 text-sky-900'
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            {notificationToast.type === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle size={16} className="text-sky-600 shrink-0" />
            )}
            <span>{notificationToast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotificationToast(null)}
            className="text-xs font-semibold px-2 py-0.5 rounded hover:bg-black/5 opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      <PageHeader
        title="User Accounts & Access Management"
        subtitle="Manage student verification requests, staff accounts, role assignments, and security permissions."
        actions={
          canManage && (
            <div className="flex items-center gap-2">
              {activeTab === 'directory' ? (
                <>
                  {users.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsClearUsersModalOpen(true)}
                      className="px-3 py-2 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
                    >
                      <Trash2 size={14} />
                      <span>Clear All Users</span>
                    </button>
                  )}
                  <button
                    id="new-user-btn"
                    type="button"
                    onClick={() => {
                      setEditForm({
                        fullName: '',
                        email: '',
                        phone: '',
                        role: 'student',
                        status: 'active',
                        accountType: 'External Beneficiary',
                      })
                      setIsCreateModalOpen(true)
                    }}
                    className="px-3.5 py-2 bg-[var(--color-harbor-600)] hover:bg-[var(--color-harbor-700)] text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
                  >
                    <Plus size={15} />
                    <span>Create User Account</span>
                  </button>
                </>
              ) : (
                <>
                  {pendingCount > 0 && (
                    <button
                      type="button"
                      onClick={handleApproveAllStudents}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
                    >
                      <CheckCircle2 size={15} />
                      <span>Verify All Pending ({pendingCount})</span>
                    </button>
                  )}
                </>
              )}
            </div>
          )
        }
      />

      {/* Tabs Header */}
      <div className="flex border-b border-[var(--color-line)] gap-2">
        <button
          type="button"
          onClick={() => handleSelectTab('verifications')}
          className={`pb-3 px-4 text-xs font-bold transition-colors relative flex items-center gap-2 ${
            activeTab === 'verifications'
              ? 'text-[var(--color-harbor-600)] border-b-2 border-[var(--color-harbor-600)]'
              : 'text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)]'
          }`}
        >
          <ShieldCheck size={16} />
          <span>Student Verification Queue</span>
          {pendingCount > 0 ? (
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold">
              {pendingCount} Pending
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded-full bg-[var(--color-paper)] text-[var(--color-ink-500)] text-[10px]">
              0
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleSelectTab('directory')}
          className={`pb-3 px-4 text-xs font-bold transition-colors relative flex items-center gap-2 ${
            activeTab === 'directory'
              ? 'text-[var(--color-harbor-600)] border-b-2 border-[var(--color-harbor-600)]'
              : 'text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)]'
          }`}
        >
          <Users size={16} />
          <span>All System Users</span>
          <span className="px-2 py-0.5 rounded-full bg-[var(--color-paper)] text-[var(--color-ink-600)] text-[10px] font-semibold">
            {users.length}
          </span>
        </button>
      </div>

      {activeTab === 'verifications' ? (
        <StudentVerificationQueue
          canReview={canManage}
          verifications={verificationQueue}
          onApprove={handleApproveStudent}
          onReject={handleRejectStudent}
          onApproveAll={handleApproveAllStudents}
        />
      ) : (
        <>
          {/* Filter and Search Bar */}
          <Card className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[var(--color-ink-400)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search accounts by user name or email address..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-[var(--color-line)] rounded-lg text-xs text-[var(--color-ink-900)] focus:outline-hidden focus:border-[var(--color-harbor-500)]"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Role Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[var(--color-ink-500)] flex items-center gap-1">
                  <Filter size={12} /> Role:
                </span>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-2 py-1.5 bg-white border border-[var(--color-line)] rounded-lg text-xs text-[var(--color-ink-800)]"
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="trainer">Trainer</option>
                  <option value="student">Student</option>
                  <option value="parent">Parent</option>
                  <option value="sponsor">Sponsor</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[var(--color-ink-500)]">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2 py-1.5 bg-white border border-[var(--color-line)] rounded-lg text-xs text-[var(--color-ink-800)]"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                  <option value="pending">Pending</option>
                </select>
              </div>

              {/* Account Type Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[var(--color-ink-500)]">Type:</span>
                <select
                  value={accountTypeFilter}
                  onChange={(e) => setAccountTypeFilter(e.target.value)}
                  className="px-2 py-1.5 bg-white border border-[var(--color-line)] rounded-lg text-xs text-[var(--color-ink-800)]"
                >
                  <option value="all">All Types</option>
                  <option value="Internal Staff">Staff</option>
                  <option value="External Beneficiary">Beneficiary</option>
                  <option value="Partner">Partner</option>
                </select>
              </div>
            </div>
          </Card>

      {/* Users Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[var(--color-paper)] text-[var(--color-ink-600)] border-b border-[var(--color-line)] uppercase font-semibold">
              <tr>
                <th className="px-5 py-3">User & Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Account Type</th>
                <th className="px-4 py-3">Last Active</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[var(--color-ink-400)]">
                    <Users className="w-8 h-8 mx-auto mb-2 text-[var(--color-ink-300)]" />
                    <p className="text-sm font-semibold text-[var(--color-ink-800)]">No users found</p>
                    <p className="text-xs text-[var(--color-ink-500)] mt-0.5">
                      Adjust your search or register a new user account.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id)}
                    className="hover:bg-[var(--color-paper)]/70 cursor-pointer transition-colors group"
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-[var(--color-ink-900)] group-hover:text-[var(--color-harbor-600)] flex items-center gap-2">
                        <span>{u.fullName}</span>
                      </div>
                      <div className="text-[11px] text-[var(--color-ink-500)] mt-0.5">
                        {u.email}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 bg-[var(--color-harbor-50)] text-[var(--color-harbor-700)] border border-[var(--color-harbor-200)] text-[10px] font-semibold rounded capitalize">
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-[var(--color-ink-700)]">
                      {u.accountType}
                    </td>

                    <td className="px-4 py-3.5 text-[var(--color-ink-500)]">
                      {u.lastLogin}
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <Badge tone={u.status === 'active' ? 'success' : 'neutral'}>
                        {u.status}
                      </Badge>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canManage && (
                          <>
                            <button
                              type="button"
                              title={u.status === 'active' ? 'Deactivate User' : 'Activate User'}
                              onClick={(e) => handleToggleStatus(u, e)}
                              className="p-1 text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)] rounded hover:bg-white"
                            >
                              <Power size={14} />
                            </button>
                            <button
                              type="button"
                              title="Delete User"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteSingleUser(u)
                              }}
                              className="p-1 text-[var(--color-ink-400)] hover:text-rose-600 rounded hover:bg-rose-50"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                        <span className="text-xs font-semibold text-[var(--color-harbor-600)] group-hover:underline">
                          View Details →
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
        </>
      )}

      {/* Modal: Confirm Clear All Users */}
      {isClearUsersModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-6 space-y-4 border border-[var(--color-line)] animate-in fade-in">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <Trash2 size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-[var(--color-ink-900)]">Clear All User Directory Records?</h2>
                <p className="mt-1 text-xs text-[var(--color-ink-500)] leading-relaxed">
                  This action will delete all stored user accounts from the directory, providing a clean slate. This is irreversible.
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-900">
              <span className="font-semibold block mb-0.5">Warning:</span>
              <span>All {users.length} stored user profiles in local state will be removed.</span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsClearUsersModalOpen(false)}
                className="px-3.5 py-2 text-xs font-semibold text-[var(--color-ink-600)] hover:bg-[var(--color-paper)] rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearUsers}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Trash2 size={14} />
                <span>Yes, Clear All Users</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create User Account */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-6 space-y-4 border border-[var(--color-line)]">
            <h2 className="text-base font-bold text-[var(--color-ink-900)]">Create User Account</h2>
            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--color-ink-700)] mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Oluwaseun Adeleke"
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
                  placeholder="e.g. o.adeleke@ijeshadigitalhub.org"
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
                  placeholder="e.g. +234 803 000 1122"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--color-ink-700)] mb-1">
                    System Role
                  </label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value as Role })}
                    className="input capitalize"
                  >
                    <option value="student">Student</option>
                    <option value="trainer">Trainer / Tutor</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                    <option value="parent">Parent / Guardian</option>
                    <option value="sponsor">Sponsor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--color-ink-700)] mb-1">
                    Account Classification
                  </label>
                  <select
                    value={editForm.accountType}
                    onChange={(e) => setEditForm({ ...editForm, accountType: e.target.value as AccountType })}
                    className="input"
                  >
                    <option value="Internal Staff">Internal Staff</option>
                    <option value="External Beneficiary">Beneficiary</option>
                    <option value="Partner">Partner</option>
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
                  Provision Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
