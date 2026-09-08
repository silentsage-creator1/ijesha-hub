import type { NavSection, Role, RoleInfo } from '@/types'

export const ROLES: RoleInfo[] = [
  { id: 'admin', label: 'Administrator', shortLabel: 'Admin', description: 'Full platform oversight' },
  { id: 'manager', label: 'Manager', shortLabel: 'Manager', description: 'Team & cohort operations' },
  { id: 'trainer', label: 'Trainer', shortLabel: 'Trainer', description: 'Assigned students & sessions' },
  { id: 'student', label: 'Student', shortLabel: 'Student', description: 'Your own learning space' },
  { id: 'parent', label: 'Parent/Guardian', shortLabel: 'Parent', description: 'Your linked child only' },
  { id: 'sponsor', label: 'Sponsor', shortLabel: 'Sponsor', description: 'Sponsored course and cohort outcomes' },
]

const ALL: Role[] = ['admin', 'manager', 'trainer', 'student', 'parent', 'sponsor']
const STAFF: Role[] = ['admin', 'manager', 'trainer']

/**
 * NAVIGATION ARCHITECTURE
 * ------------------------------------------------------------------
 * Every leaf declares the roles that may SEE it. This filtering is a
 * convenience for information architecture and wayfinding only.
 * It is not a security boundary — see /ARCHITECTURE.md, Part 14.
 * Real access control must be enforced server-side against the
 * authenticated session, not against anything read from the client.
 * ------------------------------------------------------------------
 */
export const NAVIGATION: NavSection[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', path: '/', icon: 'LayoutDashboard', roles: ALL },
      { id: 'sponsor-dashboard', label: 'Sponsored learning', path: '/sponsor', icon: 'HeartHandshake', roles: ['sponsor'] },
    ],
  },
  {
    id: 'training',
    label: 'Training',
    items: [
      { id: 'students', label: 'Students', path: '/students', icon: 'Users', roles: ['admin', 'manager', 'trainer'] },
      { id: 'my-cohort', label: 'My Cohort', path: '/my-cohort', icon: 'Layers', roles: ['student'] },
      { id: 'courses', label: 'Courses', path: '/courses', icon: 'BookOpen', roles: STAFF },
      { id: 'cohorts', label: 'Cohorts', path: '/cohorts', icon: 'Layers', roles: STAFF },
      { id: 'sessions', label: 'Training Sessions', path: '/sessions', icon: 'CalendarClock', roles: STAFF },
      { id: 'attendance', label: 'Attendance', path: '/attendance', icon: 'ClipboardCheck', roles: STAFF },
      { id: 'my-courses', label: 'My Courses', path: '/my-courses', icon: 'BookOpen', roles: ['student'] },
      { id: 'my-schedule', label: 'My Schedule', path: '/my-schedule', icon: 'CalendarClock', roles: ['student'] },
      { id: 'my-attendance', label: 'My Attendance', path: '/my-attendance', icon: 'ClipboardCheck', roles: ['student'] },
      { id: 'tutor-cohorts', label: 'My Cohorts', path: '/my-cohorts', icon: 'Layers', roles: ['trainer'] },
      { id: 'child-attendance', label: 'Attendance', path: '/child-attendance', icon: 'ClipboardCheck', roles: ['parent'] },
    ],
  },
  {
    id: 'learning',
    label: 'Learning',
    items: [
      { id: 'assignments', label: 'Assignments', path: '/assignments', icon: 'FileText', roles: ['admin', 'manager', 'trainer', 'student'] },
      { id: 'classwork', label: 'Classwork', path: '/classwork', icon: 'FileText', roles: ['admin', 'manager', 'trainer', 'student', 'parent'] },
      { id: 'grading-queue', label: 'Grading Queue', path: '/grading-queue', icon: 'ListChecks', roles: ['admin', 'manager', 'trainer'] },
      { id: 'grades-feedback', label: 'Grades & Feedback', path: '/grades-feedback', icon: 'ListChecks', roles: ['admin', 'manager', 'trainer', 'student', 'parent'] },
      { id: 'results', label: 'Results', path: '/results', icon: 'Activity', roles: ['admin', 'manager', 'trainer', 'student', 'parent'] },
      { id: 'projects', label: 'Projects', path: '/projects', icon: 'FolderKanban', roles: ['admin', 'manager', 'trainer'] },
      { id: 'portfolio', label: 'Projects / Portfolio', path: '/portfolio', icon: 'FolderKanban', roles: ['admin', 'manager', 'trainer', 'student', 'parent'] },
      { id: 'certificates', label: 'Certificates', path: '/certificates', icon: 'Award', roles: ['admin', 'student'] },
      { id: 'assessments', label: 'Assessments', path: '/assessments', icon: 'ListChecks', roles: ['admin', 'manager', 'trainer', 'student'] },
      { id: 'progress', label: 'Progress', path: '/progress', icon: 'TrendingUp', roles: ALL },
      { id: 'goals', label: 'Goals & Achievements', path: '/goals', icon: 'Trophy', roles: ['student'] },
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    items: [
      { id: 'reports', label: 'Progress Reports', path: '/reports', icon: 'FileBarChart', roles: ALL },
      { id: 'notifications', label: 'Notifications', path: '/notifications', icon: 'Bell', roles: ALL },
      { id: 'announcements', label: 'Announcements', path: '/announcements', icon: 'Megaphone', roles: ALL },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    items: [
      { id: 'analytics', label: 'Analytics', path: '/analytics', icon: 'BarChart3', roles: ['admin', 'manager'] },
      { id: 'performance', label: 'Performance', path: '/performance', icon: 'Activity', roles: ['admin', 'manager'] },
    ],
  },
  {
    id: 'management',
    label: 'Management',
    items: [
      { id: 'trainers', label: 'Trainers', path: '/trainers', icon: 'GraduationCap', roles: ['admin', 'manager'] },
      { id: 'managers', label: 'Managers', path: '/managers', icon: 'Users', roles: ['admin'] },
      { id: 'sponsors', label: 'Sponsors', path: '/sponsors', icon: 'HeartHandshake', roles: ['admin', 'manager'] },
      { id: 'parents', label: 'Parents', path: '/parents', icon: 'Users', roles: ['admin', 'manager'] },
      { id: 'users', label: 'Users', path: '/users', icon: 'UserCog', roles: ['admin', 'manager'] },
      { id: 'roles-permissions', label: 'Roles & Permissions', path: '/roles-permissions', icon: 'ShieldCheck', roles: ['admin'] },
      { id: 'org-settings', label: 'Org Settings', path: '/org-settings', icon: 'Settings', roles: ['admin'] },
      { id: 'audit-logs', label: 'Audit Logs', path: '/audit-logs', icon: 'ScrollText', roles: ['admin', 'manager'] },
      { id: 'settings', label: 'Settings', path: '/settings', icon: 'Settings', roles: ['admin', 'manager'] },
      { id: 'profile', label: 'Profile', path: '/profile', icon: 'UserCircle', roles: ALL },
    ],
  },
]

export function navigationForRole(role: Role): NavSection[] {
  return NAVIGATION
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.roles.includes(role)),
    }))
    .filter((section) => section.items.length > 0)
}
