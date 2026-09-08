import { useState, useMemo } from 'react'
import {
  Shield,
  CheckCircle2,
  Plus,
  RotateCcw,
  Save,
  Users,
  Check,
  Info,
} from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import { Card, Badge } from '@/components/ui/primitives'
import {
  getStoredRolePermissions,
  saveStoredRolePermissions,
  DEFAULT_ROLE_PERMISSIONS,
  type RolePermissionDefinition,
  type PermissionCategory,
  logSystemActivity,
} from '@/lib/management'
import type { Role } from '@/types'
import { useAuth } from '@/app/auth'

const CATEGORIES: PermissionCategory[] = [
  'Students',
  'Courses',
  'Cohorts',
  'Training',
  'Assignments',
  'Projects',
  'Assessments',
  'Reports',
  'Management',
  'Settings',
]

const PERMISSION_ACTIONS = ['view', 'create', 'edit', 'delete', 'export'] as const

export function RolesPermissionsPage() {
  const { user, profile, role: currentAdminRole } = useAuth()
  const canManage = currentAdminRole === 'admin'

  const [rolePermissions, setRolePermissions] = useState<RolePermissionDefinition[]>(
    getStoredRolePermissions()
  )
  const [selectedRoleKey, setSelectedRoleKey] = useState<string>('admin')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [saveToast, setSaveToast] = useState(false)

  // Modals
  const [isNewRoleModalOpen, setIsNewRoleModalOpen] = useState(false)
  const [newRoleForm, setNewRoleForm] = useState({
    roleName: '',
    description: '',
    baseRoleToClone: 'student' as Role,
  })

  // Currently active role definition
  const currentRoleDef = useMemo(() => {
    return rolePermissions.find((r) => r.role === selectedRoleKey) || rolePermissions[0]
  }, [rolePermissions, selectedRoleKey])

  // Count active permissions for the role
  const activePermissionsCount = useMemo(() => {
    if (!currentRoleDef) return 0
    let count = 0
    Object.values(currentRoleDef.permissions).forEach((perms) => {
      Object.values(perms).forEach((val) => {
        if (val) count++
      })
    })
    return count
  }, [currentRoleDef])

  // Toggle single permission
  const handleTogglePermission = (
    category: PermissionCategory,
    action: (typeof PERMISSION_ACTIONS)[number]
  ) => {
    if (!canManage) return
    const updated = rolePermissions.map((item) => {
      if (item.role === currentRoleDef.role) {
        return {
          ...item,
          permissions: {
            ...item.permissions,
            [category]: {
              ...item.permissions[category],
              [action]: !item.permissions[category][action],
            },
          },
        }
      }
      return item
    })
    setRolePermissions(updated)
    setHasUnsavedChanges(true)
  }

  // Toggle all permissions in a category
  const handleToggleCategoryAll = (category: PermissionCategory, enable: boolean) => {
    if (!canManage) return
    const updated = rolePermissions.map((item) => {
      if (item.role === currentRoleDef.role) {
        return {
          ...item,
          permissions: {
            ...item.permissions,
            [category]: {
              view: enable,
              create: enable,
              edit: enable,
              delete: enable,
              export: enable,
            },
          },
        }
      }
      return item
    })
    setRolePermissions(updated)
    setHasUnsavedChanges(true)
  }

  // Save changes
  const handleSavePermissions = () => {
    saveStoredRolePermissions(rolePermissions)
    setHasUnsavedChanges(false)
    setSaveToast(true)
    setTimeout(() => setSaveToast(false), 3000)

    logSystemActivity(
      profile?.full_name || user?.name || 'Administrator',
      currentAdminRole || 'admin',
      'Updated Role Permissions',
      currentRoleDef.roleName,
      'Security',
      `Modified category access policies for ${currentRoleDef.roleName}.`
    )
  }

  // Reset to default
  const handleResetDefaults = () => {
    const defaultRole = DEFAULT_ROLE_PERMISSIONS.find((r) => r.role === currentRoleDef.role)
    if (defaultRole) {
      const updated = rolePermissions.map((item) =>
        item.role === currentRoleDef.role ? JSON.parse(JSON.stringify(defaultRole)) : item
      )
      setRolePermissions(updated)
      saveStoredRolePermissions(updated)
      setHasUnsavedChanges(false)

      logSystemActivity(
        profile?.full_name || user?.name || 'Administrator',
        currentAdminRole || 'admin',
        'Reset Role Permissions',
        currentRoleDef.roleName,
        'Security',
        `Restored standard access policies for ${currentRoleDef.roleName}.`
      )
    }
  }

  // Create custom role
  const handleCreateCustomRole = (e: React.FormEvent) => {
    e.preventDefault()
    const baseRoleDef = rolePermissions.find((r) => r.role === newRoleForm.baseRoleToClone)
    const newRoleKey = `custom_${Date.now().toString().slice(-4)}`

    const newDef: RolePermissionDefinition = {
      role: newRoleKey as Role,
      roleName: newRoleForm.roleName,
      description: newRoleForm.description,
      userCount: 0,
      isSystemRole: false,
      permissions: baseRoleDef
        ? JSON.parse(JSON.stringify(baseRoleDef.permissions))
        : JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS[3].permissions)),
    }

    const updated = [...rolePermissions, newDef]
    setRolePermissions(updated)
    saveStoredRolePermissions(updated)
    setIsNewRoleModalOpen(false)
    setSelectedRoleKey(newRoleKey)

    logSystemActivity(
      profile?.full_name || user?.name || 'Administrator',
      currentAdminRole || 'admin',
      'Created Custom Role',
      newDef.roleName,
      'Security',
      `Configured custom role with cloned permissions from ${newRoleForm.baseRoleToClone}.`
    )
  }

  return (
    <div id="roles-permissions-page" className="space-y-6 pb-16">
      <PageHeader
        title="Roles & Access Control Permissions"
        subtitle="Manage fine-grained capabilities across Students, Courses, Cohorts, Reports, and System Settings."
        actions={
          canManage && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setNewRoleForm({
                    roleName: '',
                    description: '',
                    baseRoleToClone: 'student',
                  })
                  setIsNewRoleModalOpen(true)
                }}
                className="px-3 py-2 bg-white border border-[var(--color-line)] hover:bg-[var(--color-paper)] text-xs font-semibold text-[var(--color-ink-800)] rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <Plus size={14} />
                <span>Create Role</span>
              </button>

              <button
                type="button"
                onClick={handleSavePermissions}
                disabled={!hasUnsavedChanges}
                className={`px-3.5 py-2 text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors ${
                  hasUnsavedChanges
                    ? 'bg-[var(--color-harbor-600)] hover:bg-[var(--color-harbor-700)] text-white'
                    : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Save size={14} />
                <span>Save Permissions</span>
              </button>
            </div>
          )
        }
      />

      {/* Save Success Toast */}
      {saveToast && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 size={16} />
            <span>Permissions successfully synchronized and enforced across all active sessions.</span>
          </div>
          <button type="button" onClick={() => setSaveToast(false)} className="text-emerald-700 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Main Two-Column Layout: Roles Sidebar + Permissions Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Role Selector (4 cols) */}
        <Card className="lg:col-span-4 p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--color-line)]">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink-500)]">
              Platform Roles ({rolePermissions.length})
            </h2>
            <Shield size={15} className="text-[var(--color-harbor-600)]" />
          </div>

          <div className="space-y-1.5">
            {rolePermissions.map((r) => {
              const isSelected = r.role === currentRoleDef.role
              return (
                <button
                  key={r.role}
                  type="button"
                  onClick={() => {
                    setHasUnsavedChanges(false)
                    setSelectedRoleKey(r.role)
                  }}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    isSelected
                      ? 'bg-[var(--color-harbor-50)] border-[var(--color-harbor-400)] shadow-xs'
                      : 'bg-white border-transparent hover:border-[var(--color-line)] hover:bg-[var(--color-paper)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-xs font-bold ${
                        isSelected ? 'text-[var(--color-harbor-900)]' : 'text-[var(--color-ink-900)]'
                      }`}
                    >
                      {r.roleName}
                    </span>
                    <span className="text-[10px] text-[var(--color-ink-500)] flex items-center gap-1">
                      <Users size={11} /> {r.userCount} users
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--color-ink-500)] mt-1 line-clamp-2">
                    {r.description}
                  </p>
                </button>
              )
            })}
          </div>

          <div className="pt-3 border-t border-[var(--color-line)] text-xs text-[var(--color-ink-500)] flex items-start gap-1.5">
            <Info size={14} className="shrink-0 text-[var(--color-harbor-600)] mt-0.5" />
            <span>
              Role-level changes apply immediately to all users assigned to this profile.
            </span>
          </div>
        </Card>

        {/* Right Column: Category Permissions Matrix (8 cols) */}
        <Card className="lg:col-span-8 p-5 space-y-5">
          {/* Header of Active Role */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--color-line)]">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold font-display text-[var(--color-ink-900)]">
                  {currentRoleDef.roleName} Permissions
                </h2>
                <Badge tone="neutral">
                  {currentRoleDef.isSystemRole ? 'System Built-In' : 'Custom Profile'}
                </Badge>
              </div>
              <p className="text-xs text-[var(--color-ink-500)] mt-0.5">
                {activePermissionsCount} of 50 total actions authorized across 10 functional modules.
              </p>
            </div>

            {canManage && (
              <button
                type="button"
                onClick={handleResetDefaults}
                className="px-2.5 py-1.5 bg-white border border-[var(--color-line)] text-[var(--color-ink-700)] hover:bg-[var(--color-paper)] text-xs font-medium rounded flex items-center gap-1"
              >
                <RotateCcw size={12} />
                <span>Reset Defaults</span>
              </button>
            )}
          </div>

          {/* Matrix Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[var(--color-paper)] text-[var(--color-ink-600)] border-b border-[var(--color-line)] uppercase font-semibold">
                <tr>
                  <th className="px-3 py-2.5">Module Category</th>
                  <th className="px-2 py-2.5 text-center">View</th>
                  <th className="px-2 py-2.5 text-center">Create</th>
                  <th className="px-2 py-2.5 text-center">Edit</th>
                  <th className="px-2 py-2.5 text-center">Delete</th>
                  <th className="px-2 py-2.5 text-center">Export</th>
                  {canManage && <th className="px-2 py-2.5 text-right">Batch</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {CATEGORIES.map((cat) => {
                  const catPerms = currentRoleDef.permissions[cat] || {
                    view: false,
                    create: false,
                    edit: false,
                    delete: false,
                    export: false,
                  }
                  const allActive = PERMISSION_ACTIONS.every((act) => catPerms[act])

                  return (
                    <tr key={cat} className="hover:bg-[var(--color-paper)]/60 transition-colors">
                      <td className="px-3 py-3 font-bold text-[var(--color-ink-900)]">
                        {cat}
                      </td>

                      {PERMISSION_ACTIONS.map((act) => {
                        const isGranted = catPerms[act]
                        return (
                          <td key={act} className="px-2 py-3 text-center">
                            <button
                              type="button"
                              disabled={!canManage}
                              onClick={() => handleTogglePermission(cat, act)}
                              className={`w-6 h-6 rounded-md inline-flex items-center justify-center transition-all ${
                                isGranted
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                                  : 'bg-slate-100 text-slate-400 border border-slate-200 hover:bg-slate-200'
                              }`}
                            >
                              {isGranted ? <Check size={13} /> : <span className="text-[10px]">—</span>}
                            </button>
                          </td>
                        )
                      })}

                      {canManage && (
                        <td className="px-2 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleToggleCategoryAll(cat, !allActive)}
                            className="text-[10px] text-[var(--color-harbor-600)] hover:underline font-semibold"
                          >
                            {allActive ? 'Revoke All' : 'Grant All'}
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Sticky Bottom Save Bar if unsaved */}
          {hasUnsavedChanges && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-xs">
              <span className="font-semibold text-amber-900">
                You have unsaved permission modifications for {currentRoleDef.roleName}.
              </span>
              <button
                type="button"
                onClick={handleSavePermissions}
                className="px-3 py-1.5 bg-[var(--color-harbor-600)] hover:bg-[var(--color-harbor-700)] text-white font-semibold rounded shadow-xs"
              >
                Save & Apply Changes
              </button>
            </div>
          )}
        </Card>
      </div>

      {/* Modal: Create Custom Role */}
      {isNewRoleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-6 space-y-4 border border-[var(--color-line)]">
            <h2 className="text-base font-bold text-[var(--color-ink-900)]">Create Custom Access Role</h2>
            <form onSubmit={handleCreateCustomRole} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--color-ink-700)] mb-1">
                  Role Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Assistant Lab Instructor"
                  value={newRoleForm.roleName}
                  onChange={(e) => setNewRoleForm({ ...newRoleForm, roleName: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--color-ink-700)] mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Summary of responsibilities and scope..."
                  value={newRoleForm.description}
                  onChange={(e) => setNewRoleForm({ ...newRoleForm, description: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--color-ink-700)] mb-1">
                  Clone Initial Permissions From:
                </label>
                <select
                  value={newRoleForm.baseRoleToClone}
                  onChange={(e) =>
                    setNewRoleForm({ ...newRoleForm, baseRoleToClone: e.target.value as Role })
                  }
                  className="input capitalize"
                >
                  <option value="student">Student</option>
                  <option value="trainer">Trainer / Tutor</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewRoleModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-[var(--color-ink-600)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[var(--color-harbor-600)] hover:bg-[var(--color-harbor-700)] text-white font-semibold rounded"
                >
                  Create Role Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
