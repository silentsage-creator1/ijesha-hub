import { Routes, Route } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { DashboardPage } from '@/pages/DashboardPage'
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
import { CourseCohortPage } from '@/pages/CourseCohortPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { CohortDetailPage } from '@/pages/CohortDetailPage'
import { CertificatesPage } from '@/pages/CertificatesPage'
import { LearningWorkspacePage } from '@/pages/LearningWorkspacePage'
import { MyCohortPage } from '@/pages/MyCohortPage'
import { AppCoursesPage } from '@/pages/AppCoursesPage'

export function AppRoutes() {
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
        <Route path="/cohorts" element={<CohortsPage />} />
        <Route path="/my-cohorts" element={<CohortsPage />} />
        <Route path="/my-cohort" element={<MyCohortPage />} />
        <Route path="/cohorts/:id" element={<CohortDetailPage />} />
        <Route path="/sessions" element={<CourseCohortPage kind="sessions" />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/assignments" element={<LearningWorkspacePage kind="classwork" />} />
        <Route path="/classwork" element={<LearningWorkspacePage kind="classwork" />} />
        <Route path="/grading-queue" element={<LearningWorkspacePage kind="grading" />} />
        <Route path="/grades-feedback" element={<LearningWorkspacePage kind="grading" />} />
        <Route path="/results" element={<LearningWorkspacePage kind="results" />} />
        <Route path="/projects" element={<LearningWorkspacePage kind="project" />} />
        <Route path="/portfolio" element={<LearningWorkspacePage kind="project" />} />
        <Route path="/certificates" element={<CertificatesPage />} />
        <Route path="/assessments" element={<LearningWorkspacePage kind="assessment" />} />
        <Route path="/assessments/:id" element={<AssessmentDetailPage />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/announcements" element={<AnnouncementsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/my-courses" element={<CollectionPage title="My Courses" subtitle="Courses connected to your enrollment." table="courses" fields={[{ key: 'name', label: 'Course' }, { key: 'description', label: 'Description', type: 'textarea' }]} managerRoles={[]} />} />
        <Route path="/my-schedule" element={<CollectionPage title="My Schedule" subtitle="Your scheduled training sessions." table="training_sessions" fields={[{ key: 'topic', label: 'Topic' }, { key: 'starts_at', label: 'Starts at' }, { key: 'ends_at', label: 'Ends at' }, { key: 'status', label: 'Status' }]} managerRoles={[]} />} />
        <Route path="/my-attendance" element={<AttendancePage />} />
        <Route path="/child-attendance" element={<AttendancePage />} />
        <Route path="/analytics" element={<CollectionPage title="Analytics" subtitle="Live progress records across your permitted learners." table="student_progress" fields={[{ key: 'student_id', label: 'Student' }, { key: 'progress_percent', label: 'Progress (%)' }, { key: 'updated_at', label: 'Updated' }]} managerRoles={[]} />} />
        <Route path="/performance" element={<CollectionPage title="Performance" subtitle="Assessment results across your authorized learners." table="assessment_results" fields={[{ key: 'student_id', label: 'Student' }, { key: 'assessment_id', label: 'Assessment' }, { key: 'score', label: 'Score' }, { key: 'graded_at', label: 'Graded at' }]} managerRoles={[]} />} />
        <Route path="/goals" element={<CollectionPage title="Goals" subtitle="Your learning goals and achievements." table="student_progress" fields={[{ key: 'progress_percent', label: 'Current progress' }, { key: 'updated_at', label: 'Last updated' }]} managerRoles={[]} />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
