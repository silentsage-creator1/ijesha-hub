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
    try {
      const payloads = await Promise.all(['/api/students','/api/admin/accounts','/api/cohorts','/api/courses','/api/certificates'].map(async path => {
        const response = await fetch(apiUrl(path), { credentials: 'include' })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Unable to load dashboard totals.')
        return payload
      }))
      const [students, accounts, cohorts, courses, certificates] = payloads
      setCounts({students:students.students.length,trainers:accounts.users.filter((a:AppAccount)=>a.role==='trainer').length,cohorts:cohorts.cohorts.length,courses:courses.courses.length,certificates:certificates.certificates.filter((c:{status:string})=>c.status==='Issued').length})
      const today = new Date().toISOString().slice(0,10)
      const status = { upcoming:0,active:0,completed:0 }
      for (const c of cohorts.cohorts) {
        if (c.ends_on && c.ends_on < today) status.completed++
        else if (c.starts_on && c.starts_on > today) status.upcoming++
        else status.active++
      }
      setCohortStatus(status)
      const tracks:Record<string,number> = {}
      for (const student of students.students) {
        const track = student.track || 'Unassigned'
        tracks[track] = (tracks[track] || 0) + 1
      }
      setTrackBreakdown(Object.entries(tracks).map(([label,count])=>({label,value:`${count} student${count===1?'':'s'}`})))
      setActivity(accounts.users.slice(0,6).map((a:AppAccount)=>({id:a.id,text:`${a.full_name} (${a.role}) joined the platform`,time:new Date(a.created_at).toLocaleDateString()})))
      setAppAccountError(null)
    } catch(err) { setAppAccountError(err instanceof Error ? err.message : 'Unable to load dashboard totals.') }
    finally { setLoading(false) }
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
