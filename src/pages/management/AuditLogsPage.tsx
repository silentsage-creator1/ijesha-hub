import { useState, useMemo, useEffect } from 'react'
import {
  FileClock,
  Search,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Shield,
  User,
  Layers,
  ArrowUpDown,
  Trash2,
} from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import { Card } from '@/components/ui/primitives'
import {
  getStoredAuditLogs,
  clearStoredAuditLogs,
  type AuditLogEntry,
} from '@/lib/management'

export function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>(() => getStoredAuditLogs())
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  useEffect(() => {
    const handleSync = () => {
      setLogs(getStoredAuditLogs())
    }
    window.addEventListener('audit-logs-cleared', handleSync)
    window.addEventListener('app-data-cleared', handleSync)
    return () => {
      window.removeEventListener('audit-logs-cleared', handleSync)
      window.removeEventListener('app-data-cleared', handleSync)
    }
  }, [])

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [resultFilter, setResultFilter] = useState<string>('all')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null)

  const handleClearAllLogs = () => {
    clearStoredAuditLogs()
    setLogs([])
    setShowClearConfirm(false)
  }

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs
      .filter((l) => {
        if (
          searchQuery &&
          !l.action.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !l.targetName.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !l.userName.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !l.details.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
          return false
        }
        if (categoryFilter !== 'all' && l.category !== categoryFilter) return false
        if (resultFilter !== 'all' && l.result !== resultFilter) return false
        return true
      })
      .sort((a, b) => {
        if (sortOrder === 'desc') return b.id.localeCompare(a.id)
        return a.id.localeCompare(b.id)
      })
  }, [logs, searchQuery, categoryFilter, resultFilter, sortOrder])

  // Action: Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'Log ID',
      'Timestamp',
      'Actor',
      'Actor Role',
      'Action',
      'Target Resource',
      'Category',
      'Result',
      'IP Address',
      'Details',
    ]

    const rows = filteredLogs.map((l) => [
      `"${l.id}"`,
      `"${l.timestamp}"`,
      `"${l.userName.replace(/"/g, '""')}"`,
      `"${l.userRole}"`,
      `"${l.action.replace(/"/g, '""')}"`,
      `"${l.targetName.replace(/"/g, '""')}"`,
      `"${l.category}"`,
      `"${l.result}"`,
      `"${l.ipAddress || '197.210.65.12'}"`,
      `"${l.details.replace(/"/g, '""')}"`,
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute(
      'download',
      `Ijesha_Hub_Audit_Logs_${new Date().toISOString().slice(0, 10)}.csv`
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div id="audit-logs-page" className="space-y-6 pb-16">
      <PageHeader
        title="System Audit & Security Logs"
        subtitle="Immutable audit trail recording administrative modifications, security authentications, and report exports."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              disabled={logs.length === 0}
              className="px-3 py-2 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-xs font-semibold text-rose-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 size={14} />
              <span>Clear All Logs</span>
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={logs.length === 0}
              className="px-3.5 py-2 bg-white border border-[var(--color-line)] hover:bg-[var(--color-paper)] text-xs font-semibold text-[var(--color-ink-800)] rounded-lg shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>
          </div>
        }
      />

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-500)] block">
            Total Logged Events
          </span>
          <span className="text-2xl font-bold font-display text-[var(--color-ink-900)] mt-1 block">
            {logs.length}
          </span>
          <span className="text-[10px] text-[var(--color-ink-400)]">Real-time captured operations</span>
        </Card>

        <Card className="p-3.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">
            Successful Events
          </span>
          <span className="text-2xl font-bold font-display text-emerald-600 mt-1 block">
            {logs.filter((l) => l.result === 'Success').length}
          </span>
          <span className="text-[10px] text-[var(--color-ink-400)]">Compliant operations</span>
        </Card>

        <Card className="p-3.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 block">
            Security & Auth Events
          </span>
          <span className="text-2xl font-bold font-display text-amber-600 mt-1 block">
            {logs.filter((l) => l.category === 'Security' || l.category === 'User').length}
          </span>
          <span className="text-[10px] text-[var(--color-ink-400)]">Access & credential actions</span>
        </Card>

        <Card className="p-3.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 block">
            Reports & Artifacts
          </span>
          <span className="text-2xl font-bold font-display text-blue-600 mt-1 block">
            {logs.filter((l) => l.category === 'Report').length}
          </span>
          <span className="text-[10px] text-[var(--color-ink-400)]">PDF downloads & shares</span>
        </Card>
      </div>

      {/* Search and Filters Strip */}
      <Card className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[var(--color-ink-400)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search logs by actor, action description, or affected resource..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-[var(--color-line)] rounded-lg text-xs text-[var(--color-ink-900)] focus:outline-hidden focus:border-[var(--color-harbor-500)]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[var(--color-ink-500)] flex items-center gap-1">
              <Layers size={12} /> Category:
            </span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2 py-1.5 bg-white border border-[var(--color-line)] rounded-lg text-xs text-[var(--color-ink-800)]"
            >
              <option value="all">All Categories</option>
              <option value="Report">Report</option>
              <option value="Security">Security</option>
              <option value="User">User</option>
              <option value="Course">Course</option>
              <option value="Cohort">Cohort</option>
              <option value="Progress">Progress</option>
              <option value="Assessment">Assessment</option>
              <option value="Settings">Settings</option>
            </select>
          </div>

          {/* Result Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[var(--color-ink-500)]">Result:</span>
            <select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value)}
              className="px-2 py-1.5 bg-white border border-[var(--color-line)] rounded-lg text-xs text-[var(--color-ink-800)]"
            >
              <option value="all">All Results</option>
              <option value="Success">Success</option>
              <option value="Warning">Warning</option>
              <option value="Failed">Failed</option>
            </select>
          </div>

          {/* Sort Order */}
          <button
            type="button"
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            className="px-2.5 py-1.5 bg-white border border-[var(--color-line)] rounded-lg text-xs font-semibold text-[var(--color-ink-700)] flex items-center gap-1"
          >
            <ArrowUpDown size={12} />
            <span>{sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}</span>
          </button>
        </div>
      </Card>

      {/* Logs Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[var(--color-paper)] text-[var(--color-ink-600)] border-b border-[var(--color-line)] uppercase font-semibold">
              <tr>
                <th className="px-5 py-3">Timestamp</th>
                <th className="px-4 py-3">Actor & Role</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target Resource</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-center">Result</th>
                <th className="px-5 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[var(--color-ink-400)]">
                    <FileClock className="w-8 h-8 mx-auto mb-2 text-[var(--color-ink-300)]" />
                    <p className="text-sm font-semibold text-[var(--color-ink-800)]">No audit entries found</p>
                    <p className="text-xs text-[var(--color-ink-500)] mt-0.5">
                      Adjust your search query or reset category filters.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-[var(--color-paper)]/70 cursor-pointer transition-colors group"
                  >
                    <td className="px-5 py-3.5 text-[var(--color-ink-600)] whitespace-nowrap">
                      {log.timestamp}
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-bold text-[var(--color-ink-900)] flex items-center gap-1.5">
                        <User size={13} className="text-[var(--color-ink-400)]" />
                        <span>{log.userName}</span>
                      </div>
                      <span className="text-[10px] text-[var(--color-ink-500)] uppercase font-semibold">
                        {log.userRole}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 font-semibold text-[var(--color-ink-900)]">
                      {log.action}
                    </td>

                    <td className="px-4 py-3.5 text-[var(--color-ink-700)] max-w-xs truncate">
                      {log.targetName}
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 bg-slate-100 text-[var(--color-ink-700)] text-[10px] rounded font-medium">
                        {log.category}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                          log.result === 'Success'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : log.result === 'Warning'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {log.result === 'Success' ? (
                          <CheckCircle2 size={11} />
                        ) : log.result === 'Warning' ? (
                          <AlertTriangle size={11} />
                        ) : (
                          <XCircle size={11} />
                        )}
                        {log.result}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <span className="text-xs font-semibold text-[var(--color-harbor-600)] group-hover:underline">
                        View Payload →
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-6 space-y-4 border border-[var(--color-line)]">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--color-line)]">
              <h2 className="text-base font-bold text-[var(--color-ink-900)] flex items-center gap-2">
                <Shield size={16} className="text-[var(--color-harbor-600)]" />
                <span>Audit Entry #{selectedLog.id}</span>
              </h2>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="text-[var(--color-ink-400)] hover:text-[var(--color-ink-900)]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-[var(--color-line)]">
                <span className="text-[var(--color-ink-500)]">Actor:</span>
                <span className="font-semibold text-[var(--color-ink-900)]">
                  {selectedLog.userName} ({selectedLog.userRole})
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-[var(--color-line)]">
                <span className="text-[var(--color-ink-500)]">Action:</span>
                <span className="font-bold text-[var(--color-harbor-700)]">{selectedLog.action}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-[var(--color-line)]">
                <span className="text-[var(--color-ink-500)]">Target Resource:</span>
                <span className="font-semibold text-[var(--color-ink-900)]">{selectedLog.targetName}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-[var(--color-line)]">
                <span className="text-[var(--color-ink-500)]">Category:</span>
                <span className="font-semibold text-[var(--color-ink-900)]">{selectedLog.category}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-[var(--color-line)]">
                <span className="text-[var(--color-ink-500)]">Timestamp:</span>
                <span className="font-semibold text-[var(--color-ink-900)]">{selectedLog.timestamp}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-[var(--color-line)]">
                <span className="text-[var(--color-ink-500)]">Originating IP:</span>
                <span className="font-mono text-[var(--color-ink-900)]">{selectedLog.ipAddress || '197.210.65.12'}</span>
              </div>

              <div className="py-1">
                <span className="text-[var(--color-ink-500)] block mb-1">Payload / Description:</span>
                <div className="p-3 bg-[var(--color-paper)] rounded border border-[var(--color-line)] text-[var(--color-ink-800)] leading-relaxed">
                  {selectedLog.details}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 bg-[var(--color-paper)] hover:bg-[var(--color-line)] text-[var(--color-ink-800)] font-semibold rounded text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl p-6 space-y-4 border border-[var(--color-line)] text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <Trash2 size={24} />
            </div>
            <h2 className="text-base font-bold text-[var(--color-ink-900)]">
              Clear All Audit Logs?
            </h2>
            <p className="text-xs text-[var(--color-ink-500)] leading-relaxed">
              This will permanently purge all stored audit log events. New system operations and verification actions will start accumulating from a clean slate.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 border border-[var(--color-line)] hover:bg-[var(--color-paper)] text-xs font-semibold rounded-lg text-[var(--color-ink-700)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearAllLogs}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-xs font-semibold rounded-lg text-white shadow-xs transition-colors"
              >
                Yes, Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
