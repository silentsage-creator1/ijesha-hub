import { useEffect, useState } from 'react'
import { Outlet, Link } from 'react-router-dom'
import { Clock, XCircle, UserCheck, Check, X, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Sidebar } from '@/components/shell/Sidebar'
import { Topbar } from '@/components/shell/Topbar'
import { useAuth } from '@/app/auth'
import {
  getPendingStudentVerifications,
  setStudentVerificationStatus,
  type PendingStudentVerification,
} from '@/lib/management'
import { sendStudentApprovedNotification } from '@/lib/notifications'

export function AppShell() {
  const { role, profile } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [pendingVerifications, setPendingVerifications] = useState<PendingStudentVerification[]>([])
  const [verifyingId, setVerifyingId] = useState<string | null>(null)
  const [inAppToast, setInAppToast] = useState<string | null>(null)

  // Sync pending verification queue in real time
  useEffect(() => {
    const load = () => {
      setPendingVerifications(getPendingStudentVerifications())
    }
    load()
    window.addEventListener('storage', load)
    window.addEventListener('ijesha_approval_status_changed', load)
    window.addEventListener('app-notifications-updated', load)
    return () => {
      window.removeEventListener('storage', load)
      window.removeEventListener('ijesha_approval_status_changed', load)
      window.removeEventListener('app-notifications-updated', load)
    }
  }, [])

  const pendingStudents = pendingVerifications.filter((v) => v.status === 'pending')
  const firstPending = pendingStudents[0]

  const handleQuickConfirmInApp = async (student: PendingStudentVerification) => {
    setVerifyingId(student.id)
    const adminName = profile?.full_name || 'Administrator'
    setStudentVerificationStatus(student.id, 'approved', adminName)
    try {
      await sendStudentApprovedNotification({
        id: student.id,
        fullName: student.fullName,
        email: student.email,
        approverName: adminName,
      })
    } catch {}
    setPendingVerifications(getPendingStudentVerifications())
    setVerifyingId(null)
    setInAppToast(`Confirmed in App! ${student.fullName} has been verified and authorized.`)
    setTimeout(() => setInAppToast(null), 5000)
  }

  const handleQuickDeclineInApp = (student: PendingStudentVerification) => {
    const adminName = profile?.full_name || 'Administrator'
    setStudentVerificationStatus(student.id, 'rejected', adminName)
    setPendingVerifications(getPendingStudentVerifications())
    setInAppToast(`Declined account creation for ${student.fullName}.`)
    setTimeout(() => setInAppToast(null), 5000)
  }

  // Close the mobile drawer on any route change via popstate-ish effect
  useEffect(() => {
    if (!drawerOpen) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  return (
    <div className="min-h-screen bg-[var(--color-paper)]">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      {inAppToast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg bg-[var(--color-ink-900)] px-4 py-3 text-sm font-medium text-white shadow-xl animate-fade-in border border-white/10">
          <CheckCircle2 size={18} className="text-[var(--color-success-400)] shrink-0" />
          <span>{inAppToast}</span>
        </div>
      )}

      <div className="flex">
        {/* Desktop rail */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="fixed h-screen w-64">
            <Sidebar />
          </div>
        </aside>

        {/* Mobile drawer */}
        {drawerOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-[var(--color-ink-950)]/50"
              onClick={() => setDrawerOpen(false)}
              aria-hidden
            />
            <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw]" role="dialog" aria-modal="true" aria-label="Navigation">
              <Sidebar onNavigate={() => setDrawerOpen(false)} onClose={() => setDrawerOpen(false)} />
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onMenuClick={() => setDrawerOpen(true)} />
          <main id="main-content" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            {/* ADMIN / MANAGER IN-APP CONFIRMATION BANNER */}
            {(role === 'admin' || role === 'manager') && pendingStudents.length > 0 && firstPending && (
              <div className="mb-6 rounded-[var(--radius-lg)] border border-[var(--color-harbor-300)] bg-[var(--color-harbor-50)] p-4 text-[var(--color-ink-900)] shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-harbor-200)] text-[var(--color-harbor-800)]">
                      <UserCheck size={20} />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-semibold text-[var(--color-ink-900)]">
                          In-App Verification Required ({pendingStudents.length} pending)
                        </h2>
                        <span className="rounded-full bg-[var(--color-harbor-200)] px-2 py-0.5 text-[11px] font-bold text-[var(--color-harbor-900)]">
                          Admin Confirm In App
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--color-ink-600)]">
                        <strong>{firstPending.fullName}</strong> ({firstPending.email}) created a student account for{' '}
                        <span className="font-semibold text-[var(--color-ink-800)]">{firstPending.track || 'Training Track'}</span>.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleQuickConfirmInApp(firstPending)}
                      disabled={verifyingId === firstPending.id}
                      className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-600)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-harbor-700)] shadow-xs transition-colors"
                    >
                      <Check size={14} />
                      <span>{verifyingId === firstPending.id ? 'Confirming...' : 'Confirm in App'}</span>
                    </button>
                    <button
                      onClick={() => handleQuickDeclineInApp(firstPending)}
                      className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-xs font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]"
                    >
                      <X size={14} />
                      <span>Decline</span>
                    </button>
                    <Link
                      to="/users?tab=verifications"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-harbor-700)] hover:underline ml-1"
                    >
                      <span>Review All ({pendingStudents.length})</span>
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* STUDENT PENDING IN-APP REVIEW BANNER */}
            {role === 'student' && profile?.approval_status === 'pending' && (
              <div className="mb-6 rounded-[var(--radius-lg)] border border-amber-300/80 bg-amber-50/90 p-4 text-amber-950 shadow-xs">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-200/80 text-amber-800">
                    <Clock size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold text-amber-950">
                        Awaiting In-App Admin Confirmation
                      </h2>
                      <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                        In-App Review Pending
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-amber-900/90 leading-relaxed">
                      Welcome to Ijesha Digital Hub, <strong>{profile.full_name}</strong>! Your account has been registered and you are signed in. An in-app verification request has been dispatched to the administration. As soon as the administrator confirms your account inside the app, your permissions will activate automatically.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {role === 'student' && profile?.approval_status === 'rejected' && (
              <div className="mb-6 rounded-[var(--radius-lg)] border border-red-300/80 bg-red-50/90 p-4 text-red-950 shadow-xs">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-200/80 text-red-800">
                    <XCircle size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold text-red-950">
                        Account Registration Under Review
                      </h2>
                      <span className="rounded-full bg-red-200 px-2 py-0.5 text-[11px] font-bold text-red-900">
                        Verification Required
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-red-900/90 leading-relaxed">
                      Your account registration requires administrative confirmation. Please contact the academy administration or your hub coordinator.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
