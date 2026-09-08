export type Role = 'admin' | 'manager' | 'trainer' | 'student' | 'parent' | 'sponsor'

export interface RoleInfo {
  id: Role
  label: string
  shortLabel: string
  description: string
}

export interface NavLeaf {
  id: string
  label: string
  path: string
  icon: string
  /** Roles allowed to see this item. This is UI convenience only —
   *  see ARCHITECTURE.md: real authorization is enforced server-side. */
  roles: Role[]
  badge?: 'new' | number
}

export interface NavSection {
  id: string
  label: string
  items: NavLeaf[]
}

export interface CurrentUser {
  name: string
  role: Role
  initials: string
  org?: string
  photoPath?: string
}

export interface Profile {
  id: string
  full_name: string
  role: Role
  organization: string | null
  created_at: string
  approval_status?: 'pending' | 'approved' | 'rejected' | 'suspended'
  notification_preferences?: Record<string, boolean>
  phone_number?: string | null
  photo_path?: string | null
  department?: string | null
}

export interface Student {
  id: string
  profile_id: string | null
  full_name: string
  email: string | null
  cohort: string | null
  track: string | null
  status: 'new' | 'active' | 'paused' | 'graduated' | 'withdrawn'
  assigned_trainer_id: string | null
  organization: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Teacher {
  id: string
  profile_id: string | null
  full_name: string
  email: string | null
  specialty: string | null
  status: 'active' | 'inactive'
  organization: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'

export interface TrainingSession {
  id: string
  cohort_id: string
  trainer_id: string | null
  trainer_name?: string | null
  topic: string
  starts_at: string
  ends_at?: string | null
  status: 'scheduled' | 'completed' | 'cancelled'
  week_number?: number | null
  created_at?: string
}

export interface AttendanceRecord {
  id: string
  student_id: string
  student_name?: string
  cohort_id?: string | null
  training_session_id?: string | null
  attended_on: string
  status: AttendanceStatus
  recorded_by?: string | null
  created_at?: string
}

export interface Cohort {
  id: string
  name: string
  course_id: string
  starts_on?: string | null
  ends_on?: string | null
  created_at?: string
}

export interface Course {
  id: string
  name: string
  description?: string | null
  active?: boolean
  created_at?: string
}

export type AssignmentType =
  | 'Individual Assignment'
  | 'Practical Assignment'
  | 'Written Assignment'
  | 'Research'
  | 'Quiz'
  | 'Classwork'
  | 'Other'

export type SubmissionType =
  | 'File Upload'
  | 'Text Submission'
  | 'File + Text'
  | 'Link Submission'

export type AssignmentStatus = 'Draft' | 'Published'

export interface AssignmentResource {
  id: string
  name: string
  type: string
  size?: string
  url?: string
}

export interface Assignment {
  id: string
  cohort_id: string
  cohort_name?: string
  course_id?: string
  course_name?: string
  training_week: number
  title: string
  description: string
  instructions: string
  assignment_type: AssignmentType
  start_date: string
  due_date: string
  submission_type: SubmissionType
  maximum_marks: number
  resources: AssignmentResource[]
  status: AssignmentStatus
  created_by?: string | null
  created_at?: string
  updated_at?: string
}

export type StudentAssignmentStatus = 'Not Started' | 'In Progress' | 'Submitted' | 'Graded'

export interface AssignmentSubmission {
  id: string
  assignment_id: string
  student_id: string
  student_name: string
  student_email?: string | null
  status: StudentAssignmentStatus
  submission_type?: SubmissionType
  response_text?: string | null
  response_link?: string | null
  response_files?: AssignmentResource[]
  marks?: number | null
  feedback?: string | null
  submitted_at?: string | null
  graded_at?: string | null
  graded_by?: string | null
  created_at?: string
  updated_at?: string
}

export type AssessmentType =
  | 'Quiz'
  | 'Test'
  | 'Practical Assessment'
  | 'Project Assessment'
  | 'Mid-Training Assessment'
  | 'Final Assessment'
  | 'Other'

export type AssessmentStatus = 'Draft' | 'Published' | 'Closed'

export type QuestionType = 'Multiple Choice' | 'True/False' | 'Short Answer' | 'Long Answer'

export interface QuestionOption {
  key: 'A' | 'B' | 'C' | 'D'
  text: string
}

export interface AssessmentQuestion {
  id: string
  question_text: string
  question_type: QuestionType
  options?: QuestionOption[]
  correct_answer?: string
  marks: number
}

export interface AssessmentSettings {
  passing_score: number
  shuffle_questions: boolean
  show_results_after_submission: boolean
  allow_retake: boolean
}

export interface Assessment {
  id: string
  cohort_id: string
  cohort_name?: string
  course_id?: string
  course_name?: string
  training_week: number
  title: string
  description: string
  assessment_type: AssessmentType
  instructions: string
  start_date: string
  start_time: string
  end_date?: string
  time_limit_minutes: number
  questions: AssessmentQuestion[]
  total_marks: number
  settings: AssessmentSettings
  status: AssessmentStatus
  created_by?: string | null
  created_at?: string
  updated_at?: string
}

export interface AssessmentAttempt {
  id: string
  assessment_id: string
  student_id: string
  student_name: string
  student_email?: string | null
  status: 'Not Started' | 'In Progress' | 'Completed'
  score?: number | null
  percentage?: number | null
  result?: 'Passed' | 'Failed' | null
  started_at?: string | null
  completed_at?: string | null
  time_spent_seconds?: number
  answers?: Record<string, string>
  feedback?: string | null
}

export type CertificateStatus = 'Issued' | 'Pending' | 'Draft'

export interface Certificate {
  id: string
  student_id: string
  student_name: string
  course: string
  cohort: string
  certificate_type: string
  issue_date: string
  status: CertificateStatus
  template_url?: string
  created_at?: string
}

