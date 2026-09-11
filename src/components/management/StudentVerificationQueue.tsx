import { useState, useMemo } from 'react'
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  GraduationCap,
  Search,
  Check,
  X,
  UserCheck,
  Mail,
  Calendar,
  Trash2,
} from 'lucide-react'
import { Card } from '@/components/ui/primitives'
import type { PendingStudentVerification } from '@/lib/management'

interface StudentVerificationQueueProps {
  verifications: PendingStudentVerification[]
  onApprove: (item: PendingStudentVerification) => void
  onReject: (item: PendingStudentVerification) => void
  onApproveAll: () => void
  onDelete?: (item: PendingStudentVerification) => void
  canReview?: boolean
}

export function StudentVerificationQueue({
  verifications,
  onApprove,
  onReject,
  onApproveAll,
  onDelete,
  canReview = false,
}: StudentVerificationQueueProps) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [search, setSearch] = useState('')

  const pendingCount = verifications.filter((v) => v.status === 'pending').length
  const approvedCount = verifications.filter((v) => v.status === 'approved').length

  const filtered = useMemo(() => {
    return verifications.filter((v) => {
      if (filter !== 'all' && v.status !== filter) return false
      if (search) {
        const query = search.toLowerCase()
        return (
          v.fullName.toLowerCase().includes(query) ||
          v.email.toLowerCase().includes(query) ||
          (v.track && v.track.toLowerCase().includes(query))
        )
      }
      return true
    })
  }, [verifications, filter, search])

  return (
    <div className="space-y-4">
      {/* Informational Policy Banner */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-amber-950 flex items-center gap-2">
                <span>In-App Student Verification Queue</span>
                {pendingCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-200/80 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                    <Clock size={11} /> {pendingCount} Awaiting Review
                  </span>
                )}
              </h2>
              <p className="mt-0.5 text-xs text-amber-800 leading-relaxed max-w-3xl">
                Prospective students who register for an account require administrator confirmation. Confirm their account directly inside the app below to activate their permissions immediately.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {canReview && pendingCount > 0 && (
              <button
                type="button"
                onClick={onApproveAll}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors"
              >
                <CheckCircle2 size={14} />
                <span>Approve All Pending ({pendingCount})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 block">
              Pending Verification
            </span>
            <span className="text-2xl font-bold font-display text-amber-900 mt-0.5 block">
              {pendingCount}
            </span>
            <span className="text-[10px] text-amber-700">Blocked from logging in</span>
          </div>
          <div className="h-9 w-9 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
            <Clock size={18} />
          </div>
        </Card>

        <Card className="p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">
              Approved Students
            </span>
            <span className="text-2xl font-bold font-display text-emerald-900 mt-0.5 block">
              {approvedCount}
            </span>
            <span className="text-[10px] text-emerald-700">Authorized & active</span>
          </div>
          <div className="h-9 w-9 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 size={18} />
          </div>
        </Card>

        <Card className="p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-500)] block">
              Total Student Requests
            </span>
            <span className="text-2xl font-bold font-display text-[var(--color-ink-900)] mt-0.5 block">
              {verifications.length}
            </span>
            <span className="text-[10px] text-[var(--color-ink-400)]">Registration audit trail</span>
          </div>
          <div className="h-9 w-9 rounded-full bg-[var(--color-paper)] flex items-center justify-center text-[var(--color-ink-600)]">
            <GraduationCap size={18} />
          </div>
        </Card>
      </div>

      {/* Filter and Search */}
      <Card className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[var(--color-ink-400)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search prospective students by name, email, or track..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-[var(--color-line)] rounded-lg text-xs text-[var(--color-ink-900)] focus:outline-hidden focus:border-[var(--color-harbor-500)]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === 'pending'
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'bg-white border border-[var(--color-line)] text-[var(--color-ink-600)] hover:bg-[var(--color-paper)]'
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('approved')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === 'approved'
                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                : 'bg-white border border-[var(--color-line)] text-[var(--color-ink-600)] hover:bg-[var(--color-paper)]'
            }`}
          >
            Approved ({approvedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === 'all'
                ? 'bg-[var(--color-harbor-100)] text-[var(--color-harbor-900)] border border-[var(--color-harbor-300)]'
                : 'bg-white border border-[var(--color-line)] text-[var(--color-ink-600)] hover:bg-[var(--color-paper)]'
            }`}
          >
            All ({verifications.length})
          </button>
        </div>
      </Card>

      {/* Queue Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[var(--color-paper)] text-[var(--color-ink-600)] border-b border-[var(--color-line)] uppercase font-semibold">
              <tr>
                <th className="px-5 py-3">Prospective Student</th>
                <th className="px-4 py-3">Registration Date</th>
                <th className="px-4 py-3 text-center">Verification Status</th>
                <th className="px-5 py-3 text-right">Verification Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-[var(--color-ink-400)]">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                      <CheckCircle2 size={24} />
                    </div>
                    <p className="text-sm font-semibold text-[var(--color-ink-800)]">
                      {filter === 'pending'
                        ? 'No pending student accounts awaiting verification'
                        : 'No matching student accounts found'}
                    </p>
                    <p className="text-xs text-[var(--color-ink-500)] mt-1 max-w-md mx-auto">
                      {filter === 'pending'
                        ? 'New registrations appear here with Approve and Reject actions for administrators. There are no pending requests matching this view.'
                        : 'Try adjusting your search criteria or switch status filters.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-[var(--color-paper)]/70 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-harbor-100)] text-xs font-bold text-[var(--color-harbor-700)]">
                          {item.fullName
                            .split(' ')
                            .map((p) => p[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-bold text-[var(--color-ink-900)]">
                            {item.fullName}
                          </div>
                          <div className="text-[11px] text-[var(--color-ink-500)] flex items-center gap-1">
                            <Mail size={11} className="text-[var(--color-ink-400)]" />
                            <span>{item.email}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-[var(--color-ink-500)]">
                      <div className="flex items-center gap-1">
                        <Calendar size={12} className="text-[var(--color-ink-400)]" />
                        <span>{item.requestedAt}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      {item.status === 'pending' ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                          <Clock size={11} /> Pending Verification
                        </span>
                      ) : item.status === 'approved' ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                          <CheckCircle2 size={11} /> Verified & Approved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-800">
                          <XCircle size={11} /> Rejected
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {item.status === 'pending' && canReview ? (
                          <>
                            <button
                              type="button"
                              onClick={() => onApprove(item)}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors"
                            >
                              <Check size={13} />
                              <span>Approve</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onReject(item)}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition-colors"
                            >
                              <X size={13} />
                              <span>Reject</span>
                            </button>
                          </>
                        ) : item.status === 'pending' ? (
                          <span className="text-xs text-[var(--color-ink-500)]">Awaiting administrator review</span>
                        ) : item.status === 'approved' ? (
                          <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                            <UserCheck size={14} />
                            <span>Authorized to Log In</span>
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--color-ink-400)]">
                            Application Declined
                          </span>
                        )}

                        {onDelete && (
                          <button
                            type="button"
                            title="Delete / Dismiss Record"
                            onClick={() => onDelete(item)}
                            className="p-1.5 text-[var(--color-ink-400)] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-1 border border-transparent hover:border-rose-200"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
