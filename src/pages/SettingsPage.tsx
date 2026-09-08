import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/shell/PageHeader'
import { Card } from '@/components/ui/primitives'
import { useAuth } from '@/app/auth'
import { supabaseConfigured } from '@/lib/supabase'
import {
  getOrganizationSettings,
  saveOrganizationSettings,
  type OrganizationSettings,
} from '@/lib/orgSettings'
import {
  Building2,
  User,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Check,
} from 'lucide-react'
import { clearAllAppData } from '@/lib/clearData'

export function SettingsPage() {
  const { profile, session, updateEmail, updateProfile, role } = useAuth()
  const [activeTab, setActiveTab] = useState<'profile' | 'organization'>('profile')

  // Profile state
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [emailUpdates, setEmailUpdates] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)

  // Organization state
  const [orgSettings, setOrgSettings] = useState<OrganizationSettings>(getOrganizationSettings())
  const [orgNotice, setOrgNotice] = useState<string | null>(null)
  const [savingOrg, setSavingOrg] = useState(false)
  const [clearNotice, setClearNotice] = useState<string | null>(null)

  // Data Cleanup Modal state
  const [showCleanupModal, setShowCleanupModal] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [preserveSession, setPreserveSession] = useState(true)
  const [purgeDatabase, setPurgeDatabase] = useState(false)
  const [cleanupStats, setCleanupStats] = useState<{ keysCleared: number; dbCleaned: boolean } | null>(null)

  const canManageOrg = role === 'admin' || role === 'manager'

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name)
      setEmail(session?.user.email ?? '')
      setEmailUpdates(profile.notification_preferences?.email ?? true)
    }
    setOrgSettings(getOrganizationSettings())
  }, [profile, session?.user.email])

  const handleExecuteCleanup = async () => {
    setClearing(true)
    try {
      const result = await clearAllAppData(preserveSession, { clearDatabaseRecords: purgeDatabase })
      setCleanupStats({ keysCleared: result.clearedKeysCount, dbCleaned: result.dbCleaned })
      setClearNotice(
        `Workspace cleaned successfully! Cleared ${result.clearedKeysCount} cached storage items${
          result.dbCleaned ? ' and purged connected database test tables' : ''
        }. Platform is ready for publishing.`
      )
      setShowCleanupModal(false)
    } catch (err) {
      console.error('Failed to execute cleanup:', err)
      setClearNotice('Failed to complete data reset. Please try again.')
    } finally {
      setClearing(false)
    }
  }

  async function saveProfile() {
    if (!profile) return
    setNotice(null)
    setSavingProfile(true)
    const profileResult = await updateProfile(fullName.trim())
    if (profileResult.error) {
      setSavingProfile(false)
      setNotice(profileResult.error)
      return
    }

    if (email.trim() && email.trim().toLowerCase() !== session?.user.email?.toLowerCase()) {
      const emailResult = await updateEmail(email.trim())
      setNotice(emailResult.error ?? 'Settings saved. Check your new email address to confirm the change.')
    } else {
      setNotice('Settings saved successfully.')
    }
    setSavingProfile(false)
  }

  function handleSaveOrg(e: React.FormEvent) {
    e.preventDefault()
    setSavingOrg(true)
    setOrgNotice(null)
    const updated = saveOrganizationSettings(orgSettings)
    setOrgSettings(updated)
    setSavingOrg(false)
    setOrgNotice('Organization branding and report settings updated.')
    setTimeout(() => setOrgNotice(null), 4000)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Manage your personal preferences and organization report branding."
      />

      {/* Tabs */}
      <div className="flex border-b border-[var(--color-line)] gap-4">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'profile'
              ? 'border-[var(--color-harbor-600)] text-[var(--color-harbor-600)]'
              : 'border-transparent text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)]'
          }`}
        >
          <User size={16} />
          <span>My Profile</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('organization')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'organization'
              ? 'border-[var(--color-harbor-600)] text-[var(--color-harbor-600)]'
              : 'border-transparent text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)]'
          }`}
        >
          <Building2 size={16} />
          <span>Organization Branding</span>
        </button>
      </div>

      {activeTab === 'profile' ? (
        <Card className="max-w-xl p-5">
          <label className="block text-sm font-medium text-[var(--color-ink-700)]">
            Display name
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input mt-1"
            />
          </label>

          <label className="mt-4 block text-sm font-medium text-[var(--color-ink-700)]">
            Login email
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input mt-1"
            />
            <span className="mt-1 block text-xs font-normal text-[var(--color-ink-400)]">
              Changing this requires confirmation from the new email address.
            </span>
          </label>

          <label className="mt-4 flex items-center gap-2 text-sm text-[var(--color-ink-700)]">
            <input
              type="checkbox"
              checked={emailUpdates}
              onChange={(e) => setEmailUpdates(e.target.checked)}
            />
            Receive email notifications
          </label>

          <p className="mt-4 text-xs text-[var(--color-ink-400)]">
            Use “Forgot password?” on the Sign In page if you need to reset your password.
          </p>

          {notice && (
            <p className="mt-4 text-sm text-[var(--color-ink-600)] bg-[var(--color-paper)] p-2.5 rounded border border-[var(--color-line)]">
              {notice}
            </p>
          )}

          <button
            onClick={saveProfile}
            disabled={savingProfile}
            className="mt-5 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-harbor-600)] disabled:opacity-50"
          >
            {savingProfile ? 'Saving...' : 'Save settings'}
          </button>
        </Card>
      ) : (
        <Card className="max-w-2xl p-6">
          <div className="mb-4">
            <h2 className="text-base font-bold text-[var(--color-ink-900)]">
              Organization Branding & Report Headers
            </h2>
            <p className="text-xs text-[var(--color-ink-500)]">
              This branding is automatically rendered in the header and footer of official Student Progress Report PDF documents.
            </p>
          </div>

          <form onSubmit={handleSaveOrg} className="space-y-4 text-sm">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink-700)] mb-1">
                Organization Name
              </label>
              <input
                type="text"
                required
                value={orgSettings.name}
                onChange={(e) => setOrgSettings({ ...orgSettings, name: e.target.value })}
                className="input"
                placeholder="e.g. IJESHA DIGITAL HUB"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink-700)] mb-1">
                Institutional Tagline
              </label>
              <input
                type="text"
                value={orgSettings.tagline}
                onChange={(e) => setOrgSettings({ ...orgSettings, tagline: e.target.value })}
                className="input"
                placeholder="e.g. Centre for Digital Skills, Innovation & Technology Training"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink-700)] mb-1">
                  Contact Email
                </label>
                <input
                  type="email"
                  value={orgSettings.email}
                  onChange={(e) => setOrgSettings({ ...orgSettings, email: e.target.value })}
                  className="input"
                  placeholder="contact@ijeshadigitalhub.org"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink-700)] mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={orgSettings.phone}
                  onChange={(e) => setOrgSettings({ ...orgSettings, phone: e.target.value })}
                  className="input"
                  placeholder="+234 (0) 800 453 7421"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink-700)] mb-1">
                Campus / Address
              </label>
              <input
                type="text"
                value={orgSettings.address}
                onChange={(e) => setOrgSettings({ ...orgSettings, address: e.target.value })}
                className="input"
                placeholder="Ijesha Hub Complex, Osun State, Nigeria"
              />
            </div>

            {/* Live Preview Box */}
            <div className="mt-4 p-4 rounded-lg bg-[var(--color-ink-900)] text-white text-xs border border-[var(--color-ink-700)]">
              <span className="text-[10px] uppercase font-bold text-[var(--color-harbor-300)] tracking-wider block mb-2">
                PDF Header Banner Live Preview
              </span>
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div>
                  <div className="font-bold text-sm tracking-wide">{orgSettings.name.toUpperCase()}</div>
                  <div className="text-[11px] text-blue-200">STUDENT PROGRESS REPORT</div>
                </div>
                <div className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded font-bold">
                  OFFICIALLY PUBLISHED
                </div>
              </div>
              <div className="mt-2 text-[10px] text-slate-400">
                {orgSettings.tagline} • {orgSettings.address}
              </div>
            </div>

            {orgNotice && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md text-xs flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>{orgNotice}</span>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingOrg || !canManageOrg}
                className="rounded-[var(--radius-md)] bg-[var(--color-harbor-600)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-harbor-700)] disabled:opacity-50"
              >
                {savingOrg ? 'Saving...' : canManageOrg ? 'Save Organization Branding' : 'Admin Permissions Required'}
              </button>
              {!canManageOrg && (
                <span className="text-xs text-[var(--color-ink-400)] ml-3">
                  Only administrators or managers can update organization branding.
                </span>
              )}
            </div>
          </form>
        </Card>
      )}

      {canManageOrg && (
        <Card className="p-6 mt-6 border border-rose-200 bg-white">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-rose-950 flex items-center gap-2">
                <Trash2 size={18} className="text-rose-600" />
                Data Management & Publishing Cleanup
              </h2>
              <p className="mt-1 text-sm text-[var(--color-ink-500)] max-w-xl">
                Reset all locally cached test data, sample submissions, temporary cohorts, and mock records. This prepares your workspace for production publishing and onboarding real users.
              </p>
            </div>
            <button
              type="button"
              id="clear-all-data-btn"
              onClick={() => setShowCleanupModal(true)}
              className="shrink-0 flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100 transition-colors shadow-xs"
            >
              <Trash2 size={16} />
              Clear All Data
            </button>
          </div>

          {clearNotice && (
            <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-emerald-900">Workspace Cleared for Production</p>
                  <p className="text-xs text-emerald-700 mt-0.5">{clearNotice}</p>
                  {cleanupStats && (
                    <p className="text-2xs text-emerald-600 mt-1 font-mono">
                      Purged {cleanupStats.keysCleared} local storage registries • DB purge: {cleanupStats.dbCleaned ? 'Complete' : 'Skipped'}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="shrink-0 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <RefreshCw size={13} />
                <span>Refresh View</span>
              </button>
            </div>
          )}
        </Card>
      )}

      {/* Confirmation & Options Modal for Resetting App Data */}
      {showCleanupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl p-6 space-y-5 border border-[var(--color-line)]">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--color-ink-900)]">
                  Reset Workspace for Publishing?
                </h3>
                <p className="text-xs text-[var(--color-ink-500)] mt-0.5">
                  This will wipe all cached demonstration records and mock artifacts so you can onboard authentic users from a clean state.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-3 text-xs space-y-2">
              <p className="font-semibold text-[var(--color-ink-800)]">Data that will be cleared:</p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[var(--color-ink-600)]">
                <li className="flex items-center gap-1.5">
                  <Check size={14} className="text-emerald-600" />
                  <span>Sample cohorts & rosters</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check size={14} className="text-emerald-600" />
                  <span>Projects & submissions</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check size={14} className="text-emerald-600" />
                  <span>Portfolio items & showcases</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check size={14} className="text-emerald-600" />
                  <span>Attendance & training logs</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check size={14} className="text-emerald-600" />
                  <span>Audit logs & security events</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check size={14} className="text-emerald-600" />
                  <span>Notifications & alerts</span>
                </li>
              </ul>
            </div>

            <div className="space-y-2 pt-1 border-t border-[var(--color-line)]">
              <label className="flex items-center gap-2.5 text-xs text-[var(--color-ink-700)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={preserveSession}
                  onChange={(e) => setPreserveSession(e.target.checked)}
                  className="rounded border-[var(--color-line)] text-[var(--color-harbor-600)] focus:ring-[var(--color-harbor-500)]"
                />
                <span>Preserve active administrator login session (recommended)</span>
              </label>

              {supabaseConfigured && (
                <label className="flex items-center gap-2.5 text-xs text-[var(--color-ink-700)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={purgeDatabase}
                    onChange={(e) => setPurgeDatabase(e.target.checked)}
                    className="rounded border-[var(--color-line)] text-[var(--color-harbor-600)] focus:ring-[var(--color-harbor-500)]"
                  />
                  <span>Also purge connected database test tables (projects, attendance, notifications)</span>
                </label>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--color-line)]">
              <button
                type="button"
                onClick={() => setShowCleanupModal(false)}
                disabled={clearing}
                className="px-4 py-2 border border-[var(--color-line)] hover:bg-[var(--color-paper)] text-xs font-semibold rounded-lg text-[var(--color-ink-700)] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-execute-cleanup-btn"
                onClick={handleExecuteCleanup}
                disabled={clearing}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-xs font-semibold rounded-lg text-white shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {clearing ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Resetting Workspace…</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Yes, Reset Workspace</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
