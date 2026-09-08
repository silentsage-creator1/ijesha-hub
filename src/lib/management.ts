/**
 * Management Data Layer & Types
 * Supports Trainers, Managers, Sponsors, Parents, Users, Roles & Permissions, and Audit Logs.
 */

import type { Role } from '@/types'
import { supabase } from '@/lib/supabase'

// ==========================================
// 1. TRAINERS
// ==========================================
export interface TrainerRecord {
  id: string
  fullName: string
  email: string
  phone: string
  specialty: string
  status: 'active' | 'inactive'
  courses: string[]
  cohorts: string[]
  studentsCount: number
  sessionsTotal: number
  sessionsCompleted: number
  attendanceRate: number
  performanceRating: number // e.g. 4.8 / 5.0
  joinDate: string
  bio: string
}

// ==========================================
// 2. MANAGERS
// ==========================================
export interface ManagerRecord {
  id: string
  fullName: string
  email: string
  phone: string
  department: string
  status: 'active' | 'inactive'
  assignedCourses: string[]
  assignedCohorts: string[]
  studentsCount: number
  reportsCount: number
  performanceScore: number // e.g. 94%
  joinDate: string
  officeLocation: string
}

// ==========================================
// 3. SPONSORS
// ==========================================
export interface SponsorRecord {
  id: string
  organizationName: string
  contactPerson: string
  email: string
  phone: string
  category: 'Corporate' | 'Government' | 'Philanthropic' | 'NGO'
  status: 'active' | 'inactive'
  assignedCohorts: string[]
  sponsoredStudents: Array<{
    name: string
    course: string
    cohort: string
    progress: number
    attendance: number
    status: 'On Track' | 'Needs Attention' | 'Completed'
  }>
  fundingCommitted: string
  progressAverage: number
  performanceAverage: number
  reportsAvailable: number
  partnershipDate: string
}

// ==========================================
// 4. PARENTS / GUARDIANS
// ==========================================
export interface ParentChildInfo {
  name: string
  course: string
  cohort: string
  progress: number
  attendance: number
  assignmentsCount: { submitted: number; total: number }
  projectsCount: { completed: number; total: number }
  assessmentsCount: { passed: number; total: number }
  latestReportId?: string
  status: 'On Track' | 'Needs Attention' | 'Completed'
}

export interface ParentRecord {
  id: string
  fullName: string
  relationship: string // 'Mother', 'Father', 'Guardian'
  email: string
  phone: string
  address: string
  occupation: string
  status: 'active' | 'inactive'
  children: ParentChildInfo[]
  registeredDate: string
}

// ==========================================
// 5. USERS (Central Account Directory)
// ==========================================
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending'
export type AccountType = 'Internal Staff' | 'External Beneficiary' | 'Partner'

export interface ManagedUser {
  id: string
  fullName: string
  email: string
  role: Role
  status: UserStatus
  approval_status?: 'pending' | 'approved' | 'rejected' | string
  accountType: AccountType
  phone?: string
  department?: string
  lastLogin: string
  createdAt: string
  permissionsCount: number
  recentActivity: Array<{
    action: string
    timestamp: string
    details: string
  }>
}

// ==========================================
// 6. ROLES & PERMISSIONS
// ==========================================
export type PermissionCategory =
  | 'Students'
  | 'Courses'
  | 'Cohorts'
  | 'Training'
  | 'Assignments'
  | 'Projects'
  | 'Assessments'
  | 'Reports'
  | 'Management'
  | 'Settings'

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'export'

export interface RolePermissionDefinition {
  role: Role | string
  roleName: string
  description: string
  userCount: number
  isSystemRole: boolean
  permissions: Record<PermissionCategory, Record<PermissionAction, boolean>>
}

export interface PermissionCategoryDetail {
  id: string
  name: string
  permissions: {
    key: string
    label: string
    description: string
  }[]
}

export const PERMISSION_CATEGORIES: PermissionCategoryDetail[] = [
  {
    id: 'students',
    name: 'Students',
    permissions: [
      { key: 'students.view', label: 'View', description: 'Can browse student rosters and profiles' },
      { key: 'students.create', label: 'Create', description: 'Can enroll new students' },
      { key: 'students.edit', label: 'Edit', description: 'Can update student details and records' },
      { key: 'students.delete', label: 'Delete', description: 'Can withdraw or remove student records' },
    ],
  },
  {
    id: 'courses',
    name: 'Courses',
    permissions: [
      { key: 'courses.view', label: 'View', description: 'Can view course catalog and syllabus' },
      { key: 'courses.create', label: 'Create', description: 'Can create new curriculum courses' },
      { key: 'courses.edit', label: 'Edit', description: 'Can update course modules and outlines' },
      { key: 'courses.delete', label: 'Delete', description: 'Can archive or remove courses' },
    ],
  },
  {
    id: 'cohorts',
    name: 'Cohorts',
    permissions: [
      { key: 'cohorts.view', label: 'View', description: 'Can view cohort batches and timelines' },
      { key: 'cohorts.create', label: 'Create', description: 'Can launch new cohort groups' },
      { key: 'cohorts.edit', label: 'Edit', description: 'Can modify cohort schedules and metadata' },
      { key: 'cohorts.delete', label: 'Delete', description: 'Can disband or remove cohorts' },
    ],
  },
  {
    id: 'training',
    name: 'Training',
    permissions: [
      { key: 'training.view', label: 'View', description: 'Can view scheduled training sessions and attendance' },
      { key: 'training.create', label: 'Create', description: 'Can schedule live training sessions' },
      { key: 'training.edit', label: 'Edit', description: 'Can mark attendance and update session status' },
    ],
  },
  {
    id: 'assignments',
    name: 'Assignments',
    permissions: [
      { key: 'assignments.view', label: 'View', description: 'Can view assigned coursework' },
      { key: 'assignments.create', label: 'Create', description: 'Can author and publish assignments' },
      { key: 'assignments.grade', label: 'Grade', description: 'Can score submissions and provide feedback' },
    ],
  },
  {
    id: 'projects',
    name: 'Projects',
    permissions: [
      { key: 'projects.view', label: 'View', description: 'Can view capstone projects' },
      { key: 'projects.create', label: 'Create', description: 'Can create project milestones' },
      { key: 'projects.grade', label: 'Grade', description: 'Can evaluate project deliverables' },
    ],
  },
  {
    id: 'assessments',
    name: 'Assessments',
    permissions: [
      { key: 'assessments.view', label: 'View', description: 'Can view quizzes, tests, and benchmarks' },
      { key: 'assessments.create', label: 'Create', description: 'Can author question banks and exams' },
      { key: 'assessments.grade', label: 'Grade', description: 'Can review and score student attempts' },
    ],
  },
  {
    id: 'reports',
    name: 'Reports',
    permissions: [
      { key: 'reports.view', label: 'View', description: 'Can read student progress reports' },
      { key: 'reports.create', label: 'Create', description: 'Can draft new evaluation reports' },
      { key: 'reports.edit', label: 'Edit', description: 'Can modify tutor remarks and evaluations' },
      { key: 'reports.publish', label: 'Publish', description: 'Can publish reports to students and parents' },
      { key: 'reports.download', label: 'Download', description: 'Can export official PDF certificates and reports' },
    ],
  },
  {
    id: 'management',
    name: 'Management',
    permissions: [
      { key: 'management.trainers', label: 'Manage Trainers', description: 'Can assign courses/cohorts to trainers' },
      { key: 'management.managers', label: 'Manage Managers', description: 'Can oversee managerial privileges' },
      { key: 'management.sponsors', label: 'Manage Sponsors', description: 'Can link sponsor programs to cohorts' },
      { key: 'management.parents', label: 'Manage Parents', description: 'Can manage guardian linkages' },
      { key: 'management.users', label: 'Manage Users', description: 'Can oversee system accounts and roles' },
    ],
  },
  {
    id: 'settings',
    name: 'Settings',
    permissions: [
      { key: 'settings.org', label: 'Manage Organization', description: 'Can edit institutional branding and policies' },
      { key: 'settings.system', label: 'Manage System Settings', description: 'Can adjust platform defaults and audit rules' },
    ],
  },
]

// ==========================================
// 8. AUDIT LOGS
// ==========================================
export type AuditCategory = 'Progress' | 'Cohort' | 'Assessment' | 'Report' | 'Security' | 'User' | 'Course' | 'Settings'

export interface AuditLogEntry {
  id: string
  userName: string
  userRole: string
  action: string // e.g. "Updated Student Progress"
  targetName: string // e.g. "Adebayo Ogunlesi (Cyber Security)"
  category: AuditCategory
  timestamp: string
  result: 'Success' | 'Warning' | 'Failed'
  details: string
  ipAddress?: string
}

// ==========================================
// STORAGE KEYS (Version 3 — Clean slate)
// ==========================================
const TRAINERS_KEY = 'ijesha_hub_trainers_v3'
const MANAGERS_KEY = 'ijesha_hub_managers_v3'
const SPONSORS_KEY = 'ijesha_hub_sponsors_v3'
const PARENTS_KEY = 'ijesha_hub_parents_v3'
const USERS_KEY = 'ijesha_hub_users_v3'
const ROLES_PERM_KEY = 'ijesha_hub_role_permissions_v3'
const AUDIT_LOGS_KEY = 'ijesha_hub_audit_logs_v3'
const PENDING_VERIFICATIONS_KEY = 'ijesha_hub_student_verifications_v3'

// Auto-purge legacy mock data from older versions if found in user's browser
if (typeof window !== 'undefined') {
  try {
    const legacyKeys = [
      'ijesha_hub_users_v2',
      'ijesha_hub_managed_users_v2',
      'ijesha_hub_users',
      'ijesha_hub_audit_logs_v2',
      'ijesha_hub_audit_logs',
      'ijesha_hub_trainers_v2',
      'ijesha_hub_managers_v2',
      'ijesha_hub_sponsors_v2',
      'ijesha_hub_parents_v2',
    ]
    for (const key of legacyKeys) {
      localStorage.removeItem(key)
    }
  } catch {
    // Ignore localStorage access restrictions
  }
}

// ==========================================
// DEFAULT SEED DATA
// ==========================================

export const DEFAULT_TRAINERS: TrainerRecord[] = []

export const DEFAULT_MANAGERS: ManagerRecord[] = []

export const DEFAULT_SPONSORS: SponsorRecord[] = []

export const DEFAULT_PARENTS: ParentRecord[] = []

export const DEFAULT_USERS: ManagedUser[] = []

export interface PendingStudentVerification {
  id: string
  fullName: string
  email: string
  role: 'student'
  status: 'pending' | 'approved' | 'rejected'
  requestedAt: string
  track?: string
  phone?: string
}

const ALL_CATEGORIES: PermissionCategory[] = [
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

const ALL_ACTIONS: PermissionAction[] = ['view', 'create', 'edit', 'delete', 'export']

function buildRolePermissions(config: {
  all?: boolean
  rules?: Partial<Record<PermissionCategory, Partial<Record<PermissionAction, boolean>>>>
}): Record<PermissionCategory, Record<PermissionAction, boolean>> {
  const perms = {} as Record<PermissionCategory, Record<PermissionAction, boolean>>
  for (const cat of ALL_CATEGORIES) {
    perms[cat] = {} as Record<PermissionAction, boolean>
    for (const act of ALL_ACTIONS) {
      if (config.rules?.[cat]?.[act] !== undefined) {
        perms[cat][act] = config.rules[cat]![act]!
      } else {
        perms[cat][act] = !!config.all
      }
    }
  }
  return perms
}

export const DEFAULT_ROLE_PERMISSIONS: RolePermissionDefinition[] = [
  {
    role: 'admin',
    roleName: 'System Administrator',
    description: 'Unrestricted administrative access to all hub programs, users, finances, and system settings.',
    userCount: 1,
    isSystemRole: true,
    permissions: buildRolePermissions({ all: true }),
  },
  {
    role: 'manager',
    roleName: 'Academic Manager',
    description: 'Oversees operational cohorts, curriculum delivery, trainers, attendance logs, and student performance.',
    userCount: 3,
    isSystemRole: true,
    permissions: buildRolePermissions({
      rules: {
        Students: { view: true, create: true, edit: true, delete: false, export: true },
        Courses: { view: true, create: true, edit: true, delete: false, export: true },
        Cohorts: { view: true, create: true, edit: true, delete: false, export: true },
        Training: { view: true, create: true, edit: true, delete: false, export: true },
        Assignments: { view: true, create: true, edit: true, delete: false, export: true },
        Projects: { view: true, create: true, edit: true, delete: false, export: true },
        Assessments: { view: true, create: true, edit: true, delete: false, export: true },
        Reports: { view: true, create: true, edit: true, delete: false, export: true },
        Management: { view: true, create: false, edit: true, delete: false, export: false },
        Settings: { view: true, create: false, edit: false, delete: false, export: false },
      },
    }),
  },
  {
    role: 'trainer',
    roleName: 'Trainer / Instructor',
    description: 'Facilitates sessions, grades assignments and project milestones, tracks attendance, and drafts reports.',
    userCount: 4,
    isSystemRole: true,
    permissions: buildRolePermissions({
      rules: {
        Students: { view: true, create: false, edit: false, delete: false, export: false },
        Courses: { view: true, create: false, edit: false, delete: false, export: false },
        Cohorts: { view: true, create: false, edit: false, delete: false, export: false },
        Training: { view: true, create: true, edit: true, delete: false, export: false },
        Assignments: { view: true, create: true, edit: true, delete: false, export: false },
        Projects: { view: true, create: true, edit: true, delete: false, export: false },
        Assessments: { view: true, create: true, edit: true, delete: false, export: false },
        Reports: { view: true, create: true, edit: true, delete: false, export: true },
        Management: { view: false, create: false, edit: false, delete: false, export: false },
        Settings: { view: false, create: false, edit: false, delete: false, export: false },
      },
    }),
  },
  {
    role: 'student',
    roleName: 'Enrolled Student',
    description: 'Beneficiary learner accessing syllabus materials, class schedules, assignments, and capstone work.',
    userCount: 65,
    isSystemRole: true,
    permissions: buildRolePermissions({
      rules: {
        Students: { view: false, create: false, edit: false, delete: false, export: false },
        Courses: { view: true, create: false, edit: false, delete: false, export: false },
        Cohorts: { view: true, create: false, edit: false, delete: false, export: false },
        Training: { view: true, create: false, edit: false, delete: false, export: false },
        Assignments: { view: true, create: false, edit: false, delete: false, export: false },
        Projects: { view: true, create: false, edit: false, delete: false, export: false },
        Assessments: { view: true, create: false, edit: false, delete: false, export: false },
        Reports: { view: true, create: false, edit: false, delete: false, export: true },
        Management: { view: false, create: false, edit: false, delete: false, export: false },
        Settings: { view: false, create: false, edit: false, delete: false, export: false },
      },
    }),
  },
  {
    role: 'parent',
    roleName: 'Parent / Guardian',
    description: 'Monitors sponsored dependent attendance, progress milestones, trainer remarks, and official reports.',
    userCount: 42,
    isSystemRole: true,
    permissions: buildRolePermissions({
      rules: {
        Students: { view: false, create: false, edit: false, delete: false, export: false },
        Courses: { view: true, create: false, edit: false, delete: false, export: false },
        Cohorts: { view: false, create: false, edit: false, delete: false, export: false },
        Training: { view: true, create: false, edit: false, delete: false, export: false },
        Assignments: { view: true, create: false, edit: false, delete: false, export: false },
        Projects: { view: true, create: false, edit: false, delete: false, export: false },
        Assessments: { view: true, create: false, edit: false, delete: false, export: false },
        Reports: { view: true, create: false, edit: false, delete: false, export: true },
        Management: { view: false, create: false, edit: false, delete: false, export: false },
        Settings: { view: false, create: false, edit: false, delete: false, export: false },
      },
    }),
  },
  {
    role: 'sponsor',
    roleName: 'Funding Partner / Sponsor',
    description: 'Reviews aggregated scholarship impact data, student milestone completion, and funding allocations.',
    userCount: 6,
    isSystemRole: true,
    permissions: buildRolePermissions({
      rules: {
        Students: { view: true, create: false, edit: false, delete: false, export: true },
        Courses: { view: true, create: false, edit: false, delete: false, export: false },
        Cohorts: { view: true, create: false, edit: false, delete: false, export: true },
        Training: { view: true, create: false, edit: false, delete: false, export: false },
        Assignments: { view: false, create: false, edit: false, delete: false, export: false },
        Projects: { view: true, create: false, edit: false, delete: false, export: false },
        Assessments: { view: false, create: false, edit: false, delete: false, export: false },
        Reports: { view: true, create: false, edit: false, delete: false, export: true },
        Management: { view: false, create: false, edit: false, delete: false, export: false },
        Settings: { view: false, create: false, edit: false, delete: false, export: false },
      },
    }),
  },
]

export const DEFAULT_AUDIT_LOGS: AuditLogEntry[] = []

// ==========================================
// DATA ACCESS & PERSISTENCE HELPERS
// ==========================================

export function getStoredTrainers(): TrainerRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(TRAINERS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveStoredTrainers(data: TrainerRecord[]) {
  try {
    localStorage.setItem(TRAINERS_KEY, JSON.stringify(data))
  } catch (err) {
    console.warn('Failed to save trainers:', err)
  }
}

export function getStoredManagers(): ManagerRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(MANAGERS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveStoredManagers(data: ManagerRecord[]) {
  try {
    localStorage.setItem(MANAGERS_KEY, JSON.stringify(data))
  } catch (err) {
    console.warn('Failed to save managers:', err)
  }
}

export function getStoredSponsors(): SponsorRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(SPONSORS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveStoredSponsors(data: SponsorRecord[]) {
  try {
    localStorage.setItem(SPONSORS_KEY, JSON.stringify(data))
  } catch (err) {
    console.warn('Failed to save sponsors:', err)
  }
}

export function getStoredParents(): ParentRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(PARENTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveStoredParents(data: ParentRecord[]) {
  try {
    localStorage.setItem(PARENTS_KEY, JSON.stringify(data))
  } catch (err) {
    console.warn('Failed to save parents:', err)
  }
}

export function getStoredUsers(): ManagedUser[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(USERS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveStoredUsers(data: ManagedUser[]) {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(data))
  } catch (err) {
    console.warn('Failed to save users:', err)
  }
}

export function getStoredRolePermissions(): RolePermissionDefinition[] {
  if (typeof window === 'undefined') return DEFAULT_ROLE_PERMISSIONS
  try {
    const raw = localStorage.getItem(ROLES_PERM_KEY)
    if (!raw) {
      saveStoredRolePermissions(DEFAULT_ROLE_PERMISSIONS)
      return DEFAULT_ROLE_PERMISSIONS
    }
    return JSON.parse(raw)
  } catch {
    return DEFAULT_ROLE_PERMISSIONS
  }
}

export function saveStoredRolePermissions(matrix: RolePermissionDefinition[]) {
  try {
    localStorage.setItem(ROLES_PERM_KEY, JSON.stringify(matrix))
  } catch (err) {
    console.warn('Failed to save role permissions:', err)
  }
}

export const getRolePermissions = getStoredRolePermissions
export const saveRolePermissions = saveStoredRolePermissions

export function getStoredAuditLogs(): AuditLogEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(AUDIT_LOGS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveStoredAuditLogs(logs: AuditLogEntry[]) {
  try {
    localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(logs))
  } catch (err) {
    console.warn('Failed to save audit logs:', err)
  }
}

export function clearStoredAuditLogs() {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUDIT_LOGS_KEY)
      localStorage.removeItem('ijesha_hub_audit_logs_v2')
      localStorage.removeItem('ijesha_hub_audit_logs')
      window.dispatchEvent(new CustomEvent('audit-logs-cleared'))
      window.dispatchEvent(new CustomEvent('app-data-cleared'))
    }
  } catch (err) {
    console.warn('Failed to clear audit logs:', err)
  }
}

export function clearStoredUsers() {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(USERS_KEY)
      localStorage.removeItem('ijesha_hub_users_v2')
      localStorage.removeItem('ijesha_hub_managed_users_v2')
      localStorage.removeItem('ijesha_hub_users')
    }
  } catch (err) {
    console.warn('Failed to clear users:', err)
  }
}

// ==========================================
// STUDENT ACCOUNT VERIFICATION SYSTEM
// ==========================================

export function getPendingStudentVerifications(): PendingStudentVerification[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(PENDING_VERIFICATIONS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function savePendingStudentVerifications(items: PendingStudentVerification[]) {
  try {
    localStorage.setItem(PENDING_VERIFICATIONS_KEY, JSON.stringify(items))
  } catch (err) {
    console.warn('Failed to save pending verifications:', err)
  }
}

export function addPendingStudentVerification(student: {
  fullName: string
  email: string
  track?: string
  phone?: string
}): PendingStudentVerification {
  const existing = getPendingStudentVerifications()
  const foundIndex = existing.findIndex((s) => s.email.toLowerCase() === student.email.toLowerCase())
  const newRecord: PendingStudentVerification = {
    id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    fullName: student.fullName,
    email: student.email,
    role: 'student',
    status: 'pending',
    requestedAt: new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    track: student.track,
    phone: student.phone,
  }
  if (foundIndex >= 0) {
    existing[foundIndex] = newRecord
  } else {
    existing.unshift(newRecord)
  }
  savePendingStudentVerifications(existing)
  return newRecord
}

export function setStudentVerificationStatus(
  idOrEmail: string,
  status: 'approved' | 'rejected',
  adminName: string
): boolean {
  const existing = getPendingStudentVerifications()
  const target = existing.find(
    (s) => s.id === idOrEmail || s.email.toLowerCase() === idOrEmail.toLowerCase()
  )
  if (!target) return false

  target.status = status
  savePendingStudentVerifications(existing)

  // Update in Users table store if exists
  try {
    const users = getStoredUsers()
    const uMatch = users.find((u) => u.id === target.id || u.email.toLowerCase() === target.email.toLowerCase())
    if (uMatch) {
      uMatch.status = status === 'approved' ? 'active' : 'inactive'
      uMatch.approval_status = status
      saveStoredUsers(users)
    }
  } catch {}

  // Sync with Supabase asynchronously
  void (async () => {
    try {
      if (status === 'approved') {
        await supabase.rpc('admin_confirm_user_in_app', { target_email: target.email })
        await supabase.from('profiles').update({ approval_status: 'approved' }).ilike('full_name', target.fullName)
        await supabase.from('students').update({ status: 'active' }).ilike('email', target.email)
      } else {
        await supabase.from('profiles').update({ approval_status: 'rejected' }).ilike('full_name', target.fullName)
      }
    } catch {}
  })()

  // Dispatch live browser event so open student tabs update immediately
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent('ijesha_approval_status_changed', {
          detail: {
            email: target.email,
            id: target.id,
            fullName: target.fullName,
            status,
            adminName,
          },
        })
      )
      window.dispatchEvent(new CustomEvent('app-notifications-updated'))
    } catch {}
  }

  logSystemActivity(
    adminName,
    'admin',
    status === 'approved' ? 'In-App Confirmed Student Account' : 'Rejected Student Account',
    target.fullName,
    'User',
    status === 'approved'
      ? `Administrator confirmed and verified student account for ${target.fullName} (${target.email}) directly in the app. Account is now authorized with full privileges.`
      : `Administrator declined account creation request for ${target.fullName} (${target.email}) in the app.`
  )

  return true
}

export function approveAllPendingStudents(adminName: string): number {
  const existing = getPendingStudentVerifications()
  const pending = existing.filter((s) => s.status === 'pending')
  if (pending.length === 0) return 0

  for (const s of pending) {
    s.status = 'approved'
  }
  savePendingStudentVerifications(existing)

  logSystemActivity(
    adminName,
    'admin',
    'Bulk Verified Student Accounts',
    `${pending.length} Students`,
    'User',
    `Administrator approved ${pending.length} pending student account creation requests in bulk.`
  )

  return pending.length
}

export function clearPendingStudentVerifications() {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(PENDING_VERIFICATIONS_KEY)
    }
  } catch (err) {
    console.warn('Failed to clear pending verifications:', err)
  }
}

/**
 * Log a system activity.
 * Rule: NO internal IDs should be displayed in the audit trail.
 */
export function logSystemActivity(
  userName: string,
  userRole: string,
  action: string,
  targetName: string,
  category: AuditCategory,
  details: string,
  result: 'Success' | 'Warning' | 'Failed' = 'Success'
): AuditLogEntry {
  const newEntry: AuditLogEntry = {
    id: `log-${Date.now()}`,
    userName,
    userRole,
    action,
    targetName,
    category,
    timestamp: 'Just now',
    result,
    details,
  }

  const existing = getStoredAuditLogs()
  const updated = [newEntry, ...existing]
  saveStoredAuditLogs(updated)
  return newEntry
}

/**
 * Delete a user from stored users.
 */
export function deleteStoredUser(idOrEmail: string): boolean {
  try {
    const users = getStoredUsers()
    const needle = idOrEmail.trim().toLowerCase()
    const filtered = users.filter(
      (u) => u.id !== idOrEmail && u.email.toLowerCase() !== needle && u.fullName.toLowerCase() !== needle
    )
    if (filtered.length !== users.length) {
      saveStoredUsers(filtered)
      return true
    }
    return false
  } catch {
    return false
  }
}

/**
 * Delete or dismiss a pending student verification request.
 */
export function deletePendingStudentVerification(idOrEmail: string): boolean {
  try {
    const items = getPendingStudentVerifications()
    const needle = idOrEmail.trim().toLowerCase()
    const filtered = items.filter(
      (s) => s.id !== idOrEmail && s.email.toLowerCase() !== needle && s.fullName.toLowerCase() !== needle
    )
    if (filtered.length !== items.length) {
      savePendingStudentVerifications(filtered)
      return true
    }
    return false
  } catch {
    return false
  }
}

/**
 * Completely purge a user account across local caches and Supabase database.
 */
export async function purgeUserByEmailOrName(target: {
  email?: string
  name?: string
  adminName?: string
}): Promise<{ deletedUsers: number; deletedVerifications: number }> {
  let deletedUsers = 0
  let deletedVerifications = 0

  const targetEmail = target.email?.trim().toLowerCase()
  const targetName = target.name?.trim().toLowerCase()

  // 1. Remove from stored users
  try {
    const users = getStoredUsers()
    const remainingUsers = users.filter((u) => {
      const matchEmail = targetEmail && u.email.toLowerCase() === targetEmail
      const matchName = targetName && u.fullName.toLowerCase().includes(targetName)
      return !(matchEmail || matchName)
    })
    deletedUsers = users.length - remainingUsers.length
    if (deletedUsers > 0) {
      saveStoredUsers(remainingUsers)
    }
  } catch (err) {
    console.warn('Error purging stored users:', err)
  }

  // 2. Remove from pending student verifications
  try {
    const verifs = getPendingStudentVerifications()
    const remainingVerifs = verifs.filter((v) => {
      const matchEmail = targetEmail && v.email.toLowerCase() === targetEmail
      const matchName = targetName && v.fullName.toLowerCase().includes(targetName)
      return !(matchEmail || matchName)
    })
    deletedVerifications = verifs.length - remainingVerifs.length
    if (deletedVerifications > 0) {
      savePendingStudentVerifications(remainingVerifs)
    }
  } catch (err) {
    console.warn('Error purging verifications:', err)
  }

  // 3. Remove from pending roster sync
  try {
    const raw = localStorage.getItem('ijesha_hub_pending_roster_sync')
    if (raw) {
      const list = JSON.parse(raw)
      if (Array.isArray(list)) {
        const filtered = list.filter((item: any) => {
          const matchEmail = targetEmail && item.email?.toLowerCase() === targetEmail
          const matchName = targetName && item.full_name?.toLowerCase().includes(targetName)
          return !(matchEmail || matchName)
        })
        localStorage.setItem('ijesha_hub_pending_roster_sync', JSON.stringify(filtered))
      }
    }
  } catch {}

  // 4. Remove from notifications
  try {
    const raw = localStorage.getItem('ijesha_hub_notifications')
    if (raw) {
      const list = JSON.parse(raw)
      if (Array.isArray(list)) {
        const filtered = list.filter((n: any) => {
          const text = ((n.title || '') + ' ' + (n.body || '')).toLowerCase()
          const matchEmail = targetEmail && text.includes(targetEmail)
          const matchName = targetName && text.includes(targetName)
          return !(matchEmail || matchName)
        })
        localStorage.setItem('ijesha_hub_notifications', JSON.stringify(filtered))
        window.dispatchEvent(new CustomEvent('app-notifications-updated'))
      }
    }
  } catch {}

  // 5. Delete from Supabase backend tables
  try {
    if (targetEmail) {
      await supabase.from('students').delete().ilike('email', targetEmail)
      await supabase.from('notifications').delete().ilike('body', `%${targetEmail}%`)
    }
    if (targetName) {
      await supabase.from('students').delete().ilike('full_name', `%${targetName}%`)
      await supabase.from('profiles').delete().ilike('full_name', `%${targetName}%`)
    }
  } catch (err) {
    console.warn('Error deleting from Supabase:', err)
  }

  // 6. Audit log
  try {
    logSystemActivity(
      target.adminName || 'Administrator',
      'admin',
      'Deleted User Account',
      target.name || target.email || 'Target User',
      'User',
      `Deleted user account record (Email: ${target.email || 'N/A'}, Name: ${target.name || 'N/A'}). All linked verifications, directory records, and alerts were purged.`,
      'Success'
    )
  } catch {}

  return { deletedUsers, deletedVerifications }
}

/**
 * Update a user's role authoritatively.
 * Updates Supabase profiles table, synchronizes teachers/students tables, updates local cache,
 * dispatches notifications, and emits events so the UI and auth state immediately reflect the change.
 */
export async function updateUserRole(
  userId: string,
  newRole: Role,
  actor?: { name: string; role: string }
): Promise<boolean> {
  const users = getStoredUsers()
  const targetUser = users.find((u) => u.id === userId || (u.email && u.email.toLowerCase() === userId.toLowerCase()))

  const userName = targetUser?.fullName || 'User'
  const userEmail = targetUser?.email || ''

  // 1. Update in local storage
  if (targetUser) {
    targetUser.role = newRole
    saveStoredUsers(users)
  }

  // 2. Update Supabase profiles table
  try {
    let profileUpdated = false
    const { data: updatedProfile } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)
      .select()
      .maybeSingle()

    if (updatedProfile) {
      profileUpdated = true
    }

    if (!profileUpdated && (userEmail || userName)) {
      await supabase
        .from('profiles')
        .update({ role: newRole })
        .or(`full_name.ilike.${userName}`)
    }
  } catch (err) {
    console.warn('Could not update profile role in Supabase:', err)
  }

  // 3. Ensure role-specific table entries exist
  try {
    if (newRole === 'trainer') {
      const { data: existingTrainer } = await supabase
        .from('teachers')
        .select('id')
        .or(`email.eq.${userEmail || 'none'},full_name.ilike.${userName}`)
        .maybeSingle()

      if (!existingTrainer) {
        await supabase.from('teachers').insert({
          profile_id: userId.startsWith('usr-') ? null : userId,
          full_name: userName,
          email: userEmail || null,
          specialty: 'Instructor',
          status: 'active',
        })
      }
    } else if (newRole === 'student') {
      const { data: existingStudent } = await supabase
        .from('students')
        .select('id')
        .or(`email.eq.${userEmail || 'none'},full_name.ilike.${userName}`)
        .maybeSingle()

      if (!existingStudent) {
        await supabase.from('students').insert({
          profile_id: userId.startsWith('usr-') ? null : userId,
          full_name: userName,
          email: userEmail || null,
          track: 'Frontend Development',
          status: 'active',
        })
      }
    }
  } catch (err) {
    console.warn('Could not sync role-specific table:', err)
  }

  // 4. Log system activity
  logSystemActivity(
    actor?.name || 'Administrator',
    (actor?.role as Role) || 'admin',
    'Changed User Role',
    `${userName} → ${newRole.toUpperCase()}`,
    'Security',
    `Authoritatively assigned ${newRole.toUpperCase()} role and permissions to ${userName} (${userEmail || 'N/A'}).`
  )

  // 5. Broadcast live events
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent('ijesha_role_changed', {
          detail: {
            userId,
            email: userEmail,
            role: newRole,
          },
        })
      )
      window.dispatchEvent(new CustomEvent('ijesha_auth_profile_refresh'))
      window.dispatchEvent(new CustomEvent('app-notifications-updated'))
    } catch {}
  }

  return true
}

// Auto-purge requested targets on module initialization
if (typeof window !== 'undefined') {
  setTimeout(() => {
    purgeUserByEmailOrName({ email: 'admin@21stbranding.com' })
  }, 100)
}
