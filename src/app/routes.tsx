import { Routes, Route } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { DashboardPage } from '@/pages/DashboardPage'
import { useAuth } from '@/app/auth'
import { StudentLearningSummary } from '@/pages/StudentLearningSummary'
import { StudentsPage } from '@/pages/StudentsPage'
import { StudentDetailPage } from '@/pages/StudentDetailPage'
import { TrainersManagementPage } from '@/pages/management/TrainersManagementPage'
import { ManagersManagementPage } from '@/pages/management/ManagersManagementPage'
import { SponsorsManagementPage } from '@/pages/management/SponsorsManagementPage'
import { ParentsManagementPage } from '@/pages/management/ParentsManagementPage'
import { UsersManagementPage } from '@/pages/management/UsersManagementPage'
import { RolesPermissionsPage } from '@/pages/management/RolesPermissionsPage'
import { AuditLogsPage } from '@/pages/management/AuditLogsPage'
import { SponsorDashboard } from '@/pages/dashboards/SponsorDashboard'
import { SettingsPage } from '@/pages/SettingsPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { CollectionPage } from '@/pages/CollectionPage'
import { AttendancePage } from '@/pages/AttendancePage'
import { ProgressPage } from '@/pages/ProgressPage'
import { NotificationsPage } from '@/pages/NotificationsPage'
import { AssessmentDetailPage } from '@/pages/AssessmentDetailPage'
import { CohortsPage } from '@/pages/CohortsPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { AnnouncementsPage } from '@/pages/AnnouncementsPage'
import { SessionsPage } from '@/pages/SessionsPage'
import { StudentSchedulePage } from '@/pages/StudentSchedulePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { CohortDetailPage } from '@/pages/CohortDetailPage'
import { CertificatesPage } from '@/pages/CertificatesPage'
import { LearningWorkspacePage } from '@/pages/LearningWorkspacePage'
import { MyCohortPage } from '@/pages/MyCohortPage'
import { AppCoursesPage } from '@/pages/AppCoursesPage'
import { AppCourseDetailPage } from '@/pages/AppCourseDetailPage'

export function AppRoutes() {
  const { role } = useAuth()
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/students" element={<StudentsPage />} />
        <Route path="/students/:id" element={<StudentDetailPage />} />
        <Route path="/trainers" element={<TrainersManagementPage />} />
        <Route path="/managers" element={<ManagersManagementPage />} />
        <Route path="/sponsors" element={<SponsorsManagementPage />} />
        <Route path="/parents" element={<ParentsManagementPage />} />
        <Route path="/users" element={<UsersManagementPage />} />
        <Route path="/roles-permissions" element={<RolesPermissionsPage />} />
        <Route path="/audit-logs" element={<AuditLogsPage />} />
        <Route path="/sponsor" element={<SponsorDashboard />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/org-settings" element={<SettingsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/courses" element={<AppCoursesPage />} />
        <Route path="/courses/:id" element={<AppCourseDetailPage />} />
        <Route path="/cohorts" element={<CohortsPage />} />
        <Route path="/my-cohorts" element={<CohortsPage />} />
        <Route path="/my-cohort" element={<MyCohortPage />} />
        <Route path="/cohorts/:id" element={<CohortDetailPage />} />
        <Route path="/sessions" element={<SessionsPage />} />
        <Route path="/sessions/:id" element={<SessionsPage />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/assignments" element={<LearningWorkspacePage kind="assignment" />} />
        <Route path="/classwork" element={<LearningWorkspacePage kind="classwork" />} />
        <Route path="/grading-queue" element={<LearningWorkspacePage kind="grading" />} />
        <Route path="/grades-feedback" element={role === 'student' ? <StudentLearningSummary view="Grades & Feedback"/> : <LearningWorkspacePage kind="grading" />} />
        <Route path="/results" element={role === 'student' ? <StudentLearningSummary view="Results"/> : <LearningWorkspacePage kind="results" />} />
        <Route path="/projects" element={<LearningWorkspacePage kind="project" />} />
        <Route path="/portfolio" element={<LearningWorkspacePage kind="project" />} />
        <Route path="/certificates" element={<CertificatesPage />} />
        <Route path="/assessments" element={<LearningWorkspacePage kind="assessment" />} />
        <Route path="/assessments/:id" element={<AssessmentDetailPage />} />
        <Route path="/progress" element={role === 'student' ? <StudentLearningSummary view="Progress"/> : <ProgressPage />} />
        <Route path="/announcements" element={<AnnouncementsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/my-courses" element={<StudentLearningSummary view="My Courses"/>} />
        <Route path="/my-schedule" element={<StudentSchedulePage />} />
        <Route path="/my-attendance" element={<AttendancePage />} />
        <Route path="/child-attendance" element={<AttendancePage />} />
        <Route path="/analytics" element={<CollectionPage title="Analytics" subtitle="Live progress records across your permitted learners." table="student_progress" fields={[{ key: 'student_id', label: 'Student' }, { key: 'progress_percent', label: 'Progress (%)' }, { key: 'updated_at', label: 'Updated' }]} managerRoles={[]} />} />
        <Route path="/performance" element={<CollectionPage title="Performance" subtitle="Assessment results across your authorized learners." table="assessment_results" fields={[{ key: 'student_id', label: 'Student' }, { key: 'assessment_id', label: 'Assessment' }, { key: 'score', label: 'Score' }, { key: 'graded_at', label: 'Graded at' }]} managerRoles={[]} />} />
        <Route path="/goals" element={<StudentLearningSummary view="Goals & Achievements"/>} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
