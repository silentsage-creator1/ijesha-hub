import { useEffect, useState, useCallback } from 'react'
import {
  Users,
  GraduationCap,
  Layers,
  Award,
  UserCog,
  RefreshCw,
  BookOpen,
  Check,
  X,
  ArrowRight,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/shell/PageHeader'
import { Card, SectionHeading } from '@/components/ui/primitives'
import { StatCard, ActivityFeed, type ActivityRow } from '@/components/dashboard/blocks'
import { apiUrl, useAuth } from '@/app/auth'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import {
  getPendingStudentVerifications,
  setStudentVerificationStatus,
  type PendingStudentVerification,
} from '@/lib/management'
import { sendStudentApprovedNotification } from '@/lib/notifications'

type AppAccount = {
  id: string
  email: string
  full_name: string
  role: string
  approval_status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

export function AdminDashboard() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [pendingVerifications, setPendingVerifications] = useState<PendingStudentVerification[]>([])
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [appAccounts, setAppAccounts] = useState<AppAccount[]>([])
  const [appAccountError, setAppAccountError] = useState<string | null>(null)
  const [counts, setCounts] = useState({
    students: 0,
    trainers: 0,
    cohorts: 0,
    courses: 0,
    certificates: 0,
  })
  const [cohortStatus, setCohortStatus] = useState({
    upcoming: 0,
    active: 0,
    completed: 0,
  })
  const [trackBreakdown, setTrackBreakdown] = useState<Array<{ label: string; value: string }>>([])
  const [activity, setActivity] = useState<ActivityRow[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    if (!supabaseConfigured) {
      setCounts({
        students: 0,
        trainers: 0,
        cohorts: 0,
        courses: 0,
        certificates: 0,
      })
      setCohortStatus({ upcoming: 0, active: 0, completed: 0 })
      setTrackBreakdown([])
      setActivity([])
      setLoading(false)
      return
    }

    try {
      const [studentsRes, profilesRes, teachersRes, cohortsRes, coursesRes, certsRes] = await Promise.all([
        supabase.from('students').select('id, track, organization'),
        supabase.from('profiles').select('id, full_name, role, created_at').order('created_at', { ascending: false }).limit(6),
        supabase.from('teachers').select('id', { count: 'exact', head: true }),
        supabase.from('cohorts').select('id, status, name'),
        supabase.from('courses').select('id, name'),
        supabase.from('certificates').select('id', { count: 'exact', head: true }),
      ])

      const sList = studentsRes.data ?? []
      const cList = cohortsRes.data ?? []
      const pList = profilesRes.data ?? []

      // Calculate cohort status
      let upcoming = 0
      let active = 0
      let completed = 0
      cList.forEach((c) => {
        const s = (c as any).status?.toLowerCase()
        if (s === 'completed') completed++
        else if (s === 'upcoming') upcoming++
        else active++
      })
      setCohortStatus({ upcoming, active, completed })

      // Calculate track distribution
      const trackCounts: Record<string, number> = {}
      sList.forEach((st) => {
        const t = st.track || 'General Training'
        trackCounts[t] = (trackCounts[t] || 0) + 1
      })
      const tracks = Object.entries(trackCounts).map(([k, v]) => ({
        label: k,
        value: `${v} student${v === 1 ? '' : 's'}`,
      }))
      setTrackBreakdown(tracks.length > 0 ? tracks : [
        { label: 'Unassigned', value: `${sList.length} enrolled` },
      ])

      // Recent real activity from profiles
      const recentRows: ActivityRow[] = pList.map((p, idx) => ({
        id: p.id || String(idx),
        text: `${p.full_name || 'User'} (${p.role || 'student'}) joined the platform`,
        time: p.created_at ? new Date(p.created_at).toLocaleDateString() : 'Recent',
      }))
      setActivity(recentRows)

      // Total students count includes both students table and profile students
      const studentIds = new Set(sList.map(s => s.id))
      pList.forEach(p => {
        if (p.role === 'student') studentIds.add(p.id)
      })

      setCounts({
        students: Math.max(sList.length, studentIds.size),
        trainers: teachersRes.count ?? pList.filter(p => p.role === 'trainer').length,
        cohorts: cList.length,
        courses: coursesRes.data?.length ?? 0,
        certificates: certsRes.count ?? 0,
      })
    } catch (err) {
      console.warn('Admin dashboard load error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadVerifications = useCallback(() => {
    setPendingVerifications(getPendingStudentVerifications())
  }, [])

  const loadAppAccounts = useCallback(async () => {
    try {
      const response = await fetch(apiUrl('/api/admin/accounts'), { credentials: 'include' })
      const payload = await response.json() as { users?: AppAccount[]; error?: string }
      if (!response.ok) throw new Error(payload.error || 'Unable to load application accounts.')
      setAppAccounts(payload.users ?? [])
      setAppAccountError(null)
    } catch (err) {
      setAppAccountError(err instanceof Error ? err.message : 'Unable to load application accounts.')
    }
  }, [])

  const setAppAccountApproval = async (account: AppAccount, status: 'approved' | 'rejected') => {
    setConfirmingId(account.id)
    try {
      const response = await fetch(apiUrl(`/api/admin/accounts/${account.id}/approval`), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const payload = await response.json() as { error?: string }
      if (!response.ok) throw new Error(payload.error || 'Unable to update the account.')
      await loadAppAccounts()
    } catch (err) {
      setAppAccountError(err instanceof Error ? err.message : 'Unable to update the account.')
    } finally {
      setConfirmingId(null)
    }
  }

  useEffect(() => {
    loadData()
    loadVerifications()
    void loadAppAccounts()

    window.addEventListener('storage', loadVerifications)
    window.addEventListener('ijesha_approval_status_changed', loadVerifications)
    window.addEventListener('app-notifications-updated', loadVerifications)

    return () => {
      window.removeEventListener('storage', loadVerifications)
      window.removeEventListener('ijesha_approval_status_changed', loadVerifications)
      window.removeEventListener('app-notifications-updated', loadVerifications)
    }
  }, [loadAppAccounts, loadData, loadVerifications])

  const handleConfirmInApp = async (student: PendingStudentVerification) => {
    setConfirmingId(student.id)
    const adminName = user?.name || 'Administrator'
    setStudentVerificationStatus(student.id, 'approved', adminName)
    try {
      await sendStudentApprovedNotification({
        id: student.id,
        fullName: student.fullName,
        email: student.email,
        approverName: adminName,
      })
    } catch {}
    loadVerifications()
    setConfirmingId(null)
  }

  const handleDeclineInApp = (student: PendingStudentVerification) => {
    const adminName = user?.name || 'Administrator'
    setStudentVerificationStatus(student.id, 'rejected', adminName)
    loadVerifications()
  }

  const pendingList = pendingVerifications.filter((v) => v.status === 'pending')
  const pendingAppAccounts = appAccounts.filter((account) => account.approval_status === 'pending')

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user?.name.split(' ')[0] ?? ''}`}
        subtitle="Ijesha Digital Hub — organization-wide control centre."
        actions={
          <div className="flex flex-wrap items-center gap-2">
          <Link to="/classwork?create=1" className="rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-3 py-2 text-xs font-semibold text-white">Add Classwork</Link>
          <Link to="/assessments?create=1" className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-xs font-semibold">Add Assessment</Link>
          <Link to="/projects?create=1" className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-xs font-semibold">Add Project</Link>
          <Link to="/grading-queue" className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-xs font-semibold">Grade Work</Link>
          <button
            type="button"
            onClick={() => {
              loadData()
              loadVerifications()
              void loadAppAccounts()
            }}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm font-medium hover:bg-[var(--color-ink-50)] transition-colors"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total students" value={String(counts.students)} icon={Users} />
        <StatCard label="Trainers" value={String(counts.trainers)} icon={GraduationCap} />
        <StatCard label="Active cohorts" value={String(counts.cohorts)} icon={Layers} />
        <StatCard label="Available courses" value={String(counts.courses)} icon={BookOpen} />
      </div>

      {pendingAppAccounts.length > 0 && (
        <Card className="mt-6 border-[var(--color-harbor-200)] bg-[var(--color-harbor-50)] p-5 shadow-sm">
          <SectionHeading eyebrow="Application accounts" title={`Pending registrations (${pendingAppAccounts.length})`} />
          <div className="mt-3 divide-y divide-[var(--color-harbor-100)] rounded-lg border border-[var(--color-harbor-200)] bg-white">
            {pendingAppAccounts.map((account) => (
              <div key={account.id} className="flex flex-col justify-between gap-3 p-3.5 sm:flex-row sm:items-center">
                <div>
                  <div className="font-semibold text-sm text-[var(--color-ink-900)]">{account.full_name}</div>
                  <div className="text-xs text-[var(--color-ink-500)]">{account.email} · Registered {new Date(account.created_at).toLocaleDateString()}</div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void setAppAccountApproval(account, 'approved')} disabled={confirmingId === account.id} className="inline-flex items-center gap-1 rounded-[var(--radius-md)] bg-[var(--color-harbor-600)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-harbor-700)] disabled:opacity-60"><Check size={13} />Approve</button>
                  <button type="button" onClick={() => void setAppAccountApproval(account, 'rejected')} disabled={confirmingId === account.id} className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)] disabled:opacity-60"><X size={13} />Reject</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {appAccountError && <p className="mt-3 text-xs text-[var(--color-danger-700)]">Application accounts: {appAccountError}</p>}

      {pendingList.length > 0 && (
        <Card className="mt-6 border-amber-300 bg-amber-50/50 p-5 shadow-sm">
          <SectionHeading
            eyebrow="In-App Verification"
            title={`Pending Student Verifications (${pendingList.length})`}
            action={
              <Link
                to="/users?tab=verifications"
                className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-harbor-600)] hover:underline"
              >
                <span>Open Verification Queue</span>
                <ArrowRight size={14} />
              </Link>
            }
          />
          <div className="mt-3 divide-y divide-amber-200/80 rounded-lg border border-amber-200 bg-white">
            {pendingList.slice(0, 4).map((st) => (
              <div
                key={st.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800 font-bold text-xs">
                    {st.fullName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-[var(--color-ink-900)]">
                      {st.fullName}
                    </div>
                    <div className="text-xs text-[var(--color-ink-500)] flex items-center gap-2">
                      <span>{st.email}</span>
                      <span>•</span>
                      <span className="font-medium text-[var(--color-ink-700)]">
                        {st.track || 'Unassigned'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleConfirmInApp(st)}
                    disabled={confirmingId === st.id}
                    className="inline-flex items-center gap-1 rounded-[var(--radius-md)] bg-[var(--color-harbor-600)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-harbor-700)] shadow-xs transition-colors"
                  >
                    <Check size={13} />
                    <span>{confirmingId === st.id ? 'Confirming...' : 'Confirm in App'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeclineInApp(st)}
                    className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-xs font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]"
                  >
                    <X size={13} />
                    <span>Decline</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <SectionHeading
            eyebrow="Cohorts overview"
            title="Cohort status"
            action={
              <Link to="/cohorts" className="text-sm font-medium text-[var(--color-harbor-600)]">
                Manage cohorts
              </Link>
            }
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--color-ink-400)] font-semibold">Active</p>
              <p className="mt-2 text-2xl font-display font-semibold text-[var(--color-ink-900)]">{cohortStatus.active}</p>
              <p className="mt-1 text-xs text-[var(--color-ink-500)]">Currently running</p>
            </div>
            <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--color-ink-400)] font-semibold">Upcoming</p>
              <p className="mt-2 text-2xl font-display font-semibold text-[var(--color-ink-900)]">{cohortStatus.upcoming}</p>
              <p className="mt-1 text-xs text-[var(--color-ink-500)]">Scheduled to begin</p>
            </div>
            <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--color-ink-400)] font-semibold">Completed</p>
              <p className="mt-2 text-2xl font-display font-semibold text-[var(--color-ink-900)]">{cohortStatus.completed}</p>
              <p className="mt-1 text-xs text-[var(--color-ink-500)]">Finished tracks</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <SectionHeading eyebrow="Admin & roles" title="Access control" />
          <div className="flex gap-2">
            <Link
              to="/users"
              className="rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--color-harbor-600)]"
            >
              Manage Users
            </Link>
            <Link
              to="/roles-permissions"
              className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm font-medium hover:bg-[var(--color-ink-50)]"
            >
              Permissions
            </Link>
          </div>
          <p className="mt-4 text-sm text-[var(--color-ink-500)]">
            Manage student registrations, staff accounts, and delegated permissions securely.
          </p>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <SectionHeading eyebrow="Reports snapshot" title="Organization performance" />
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[var(--radius-md)] bg-[var(--color-harbor-100)] p-4">
              <Award size={18} className="text-[var(--color-harbor-600)]" />
              <p className="mt-2 text-sm font-medium text-[var(--color-ink-900)]">Certificates issued</p>
              <p className="text-xl font-display font-bold text-[var(--color-harbor-700)] mt-1">{counts.certificates}</p>
            </div>
            <div className="rounded-[var(--radius-md)] bg-[var(--color-success-100)] p-4">
              <Users size={18} className="text-[var(--color-success-600)]" />
              <p className="mt-2 text-sm font-medium text-[var(--color-ink-900)]">Enrolled students</p>
              <p className="text-xl font-display font-bold text-[var(--color-success-700)] mt-1">{counts.students}</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <SectionHeading title="Sensitive controls" />
          <Link to="/audit-logs" className="flex items-center gap-2 text-sm font-medium text-[var(--color-harbor-600)] hover:underline">
            <UserCog size={16} />
            Review audit log
          </Link>
          <Link to="/org-settings" className="mt-3 block text-sm font-medium text-[var(--color-harbor-600)] hover:underline">
            Organization settings
          </Link>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <SectionHeading eyebrow="Organization" title="Training tracks overview" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {trackBreakdown.map((item) => (
              <div key={item.label} className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-3">
                <p className="text-sm font-medium text-[var(--color-ink-900)]">{item.label}</p>
                <p className="text-xs text-[var(--color-ink-500)] mt-1">{item.value}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <SectionHeading title="Recent user activity" />
          {activity.length > 0 ? (
            <ActivityFeed rows={activity} />
          ) : (
            <p className="text-xs text-[var(--color-ink-400)] py-4 text-center">No recent activity recorded.</p>
          )}
        </Card>
      </div>
    </div>
  )
}
