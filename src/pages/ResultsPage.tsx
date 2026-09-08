import { useState, useMemo, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Award,
  BookOpen,
  CalendarCheck,
  ChevronRight,
  FileCheck,
  FolderKanban,
  MessageSquare,
  Sparkles,
  TrendingUp,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import { Card, Badge, SectionHeading } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { COURSE_RESULTS_DATA, type CourseResult } from '@/lib/studentFlow'
import { useAuth } from '@/app/auth'

export function ResultsPage() {
  const { role } = useAuth()
  const isStaff = role === 'trainer' || role === 'manager' || role === 'admin'
  const isParent = role === 'parent'
  const { courseId: paramCourseId } = useParams<{ courseId?: string }>()

  const [courseResults, setCourseResults] = useState<CourseResult[]>(() => COURSE_RESULTS_DATA)
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(paramCourseId ?? null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [selectedDetailItem, setSelectedDetailItem] = useState<{
    title: string
    category: 'Assessment' | 'Classwork' | 'Project'
    score: number
    maxScore: number
    weight?: number
    status?: string
    feedback?: string
  } | null>(null)

  useEffect(() => {
    const handleUpdate = () => {
      setCourseResults([...COURSE_RESULTS_DATA])
    }
    window.addEventListener('course-results-updated', handleUpdate)
    window.addEventListener('app-data-cleared', handleUpdate)
    return () => {
      window.removeEventListener('course-results-updated', handleUpdate)
      window.removeEventListener('app-data-cleared', handleUpdate)
    }
  }, [])

  const selectedCourse = useMemo(() => {
    const id = selectedCourseId ?? paramCourseId
    if (!id) return null
    return courseResults.find(c => c.course_id === id) ?? null
  }, [selectedCourseId, paramCourseId, courseResults])

  // Overall calculations across all courses
  const cumulativeAverage = useMemo(() => {
    if (courseResults.length === 0) return 0
    const sum = courseResults.reduce((acc, c) => acc + c.overall_score, 0)
    return Math.round((sum / courseResults.length) * 10) / 10
  }, [courseResults])

  const averageAttendance = useMemo(() => {
    if (courseResults.length === 0) return 0
    const sum = courseResults.reduce((acc, c) => acc + c.attendance_percent, 0)
    return Math.round(sum / courseResults.length)
  }, [courseResults])

  const cumulativeGpa = useMemo(() => {
    if (courseResults.length === 0) return '—'
    if (cumulativeAverage >= 93) return '3.9'
    if (cumulativeAverage >= 88) return '3.7'
    if (cumulativeAverage >= 83) return '3.3'
    if (cumulativeAverage >= 75) return '2.9'
    return '2.5'
  }, [cumulativeAverage, courseResults.length])

  const academicStanding = useMemo(() => {
    if (courseResults.length === 0) return 'No Published Records'
    if (cumulativeAverage >= 90) return 'Exceeding Expectations'
    if (cumulativeAverage >= 75) return 'Meeting Expectations'
    return 'Academic Support'
  }, [cumulativeAverage, courseResults.length])

  const trackProgress = useMemo(() => {
    if (courseResults.length === 0) return 0
    const completed = courseResults.filter(c => c.status === 'Completed').length
    return Math.round((completed / courseResults.length) * 100)
  }, [courseResults])

  const avgAssessments = useMemo(() => {
    if (courseResults.length === 0) return 0
    const sum = courseResults.reduce((acc, c) => acc + c.assessments_score, 0)
    return Math.round((sum / courseResults.length) * 10) / 10
  }, [courseResults])

  const avgClasswork = useMemo(() => {
    if (courseResults.length === 0) return 0
    const sum = courseResults.reduce((acc, c) => acc + c.classwork_score, 0)
    return Math.round((sum / courseResults.length) * 10) / 10
  }, [courseResults])

  const avgProjects = useMemo(() => {
    if (courseResults.length === 0) return 0
    const sum = courseResults.reduce((acc, c) => acc + c.projects_score, 0)
    return Math.round((sum / courseResults.length) * 10) / 10
  }, [courseResults])

  const handleSelectCourse = (course: CourseResult) => {
    setSelectedCourseId(course.course_id)
    setSelectedDetailItem(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleBackToOverview = () => {
    setSelectedCourseId(null)
    setSelectedDetailItem(null)
  }

  return (
    <div id="results-page" className="space-y-6 pb-12">
      {/* If Course is selected -> Show Course Results View */}
      {selectedCourse ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button
              id="back-to-results-overview-btn"
              onClick={handleBackToOverview}
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-ink-600)] hover:text-[var(--color-harbor-600)] transition-colors"
            >
              <ArrowLeft size={16} />
              Back to Results Overview
            </button>
            <Badge
              tone={
                selectedCourse.performance_status === 'Exceeding Expectations'
                  ? 'success'
                  : 'harbor'
              }
            >
              {selectedCourse.performance_status}
            </Badge>
          </div>

          {/* Course Results Header Card */}
          <Card className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge tone="harbor">{selectedCourse.course_code}</Badge>
                  <span className="text-xs text-[var(--color-ink-400)]">{selectedCourse.cohort_name}</span>
                </div>
                <h1 className="font-display text-2xl font-bold text-[var(--color-ink-900)]">
                  {selectedCourse.course_name}
                </h1>
                <p className="mt-1 text-sm text-[var(--color-ink-500)]">
                  Lead Instructor: <strong className="text-[var(--color-ink-700)]">{selectedCourse.trainer_name}</strong> · Status: <span className="font-medium text-[var(--color-ink-800)]">{selectedCourse.status}</span>
                </p>
              </div>

              {/* Overall Course Grade Badge */}
              <div className="flex items-center gap-6 bg-[var(--color-surface)] border border-[var(--color-line)] p-4 rounded-[var(--radius-lg)] shrink-0">
                <div className="text-center pr-6 border-r border-[var(--color-line)]">
                  <span className="text-xs font-semibold uppercase text-[var(--color-ink-400)] block">Course Grade</span>
                  <span className="font-display text-3xl font-black text-[var(--color-harbor-600)]">
                    {selectedCourse.overall_grade}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-2xl font-bold text-[var(--color-ink-900)]">
                      {selectedCourse.overall_score}%
                    </span>
                    <span className="text-xs text-[var(--color-success-600)] font-semibold">
                      Weighted Score
                    </span>
                  </div>
                  <div className="text-xs text-[var(--color-ink-400)] flex items-center gap-2">
                    <span>Attendance: <strong>{selectedCourse.attendance_percent}%</strong></span>
                    <span>·</span>
                    <span>Progress: <strong>{selectedCourse.completion_percent}%</strong></span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Holistic Trainer Feedback */}
          <Card className="p-6 bg-gradient-to-r from-[var(--color-surface)] to-[var(--color-harbor-50)]/40 border border-[var(--color-line)]">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-[var(--color-harbor-100)] text-[var(--color-harbor-600)] flex items-center justify-center shrink-0 mt-0.5">
                <MessageSquare size={20} />
              </div>
              <div>
                <h2 className="font-display text-base font-semibold text-[var(--color-ink-900)]">
                  Instructor Performance Evaluation
                </h2>
                <p className="mt-1 text-sm text-[var(--color-ink-700)] leading-relaxed">
                  &quot;{selectedCourse.summary_feedback}&quot;
                </p>
                <span className="mt-2 block text-xs font-medium text-[var(--color-ink-500)]">
                  — {selectedCourse.trainer_name}, Lead Trainer
                </span>
              </div>
            </div>
          </Card>

          {/* Component Performance Breakdown */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-[var(--color-ink-900)]">
                Component Performance Breakdown
              </h2>
              <span className="text-xs text-[var(--color-ink-400)]">
                Click any evaluation to view granular rubric breakdown
              </span>
            </div>

            {/* 1. Assessment Breakdown */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-[var(--color-harbor-100)] text-[var(--color-harbor-600)] flex items-center justify-center">
                    <FileCheck size={16} />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-semibold text-[var(--color-ink-900)]">
                      Assessment Breakdown
                    </h3>
                    <p className="text-xs text-[var(--color-ink-400)]">Quizzes, Midterm Examinations & Practical Tests</p>
                  </div>
                </div>
                <Badge tone="harbor">
                  Avg:{' '}
                  {Math.round(
                    selectedCourse.assessment_breakdown.reduce((a, b) => a + b.score, 0) /
                      selectedCourse.assessment_breakdown.length
                  )}
                  %
                </Badge>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--color-line)] text-[var(--color-ink-400)] uppercase font-semibold">
                      <th className="py-2.5 px-3">Assessment Title</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Weight</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3 text-right">Score</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-line)]">
                    {selectedCourse.assessment_breakdown.map((item, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-[var(--color-surface)] transition-colors cursor-pointer"
                        onClick={() =>
                          setSelectedDetailItem({
                            title: item.title,
                            category: 'Assessment',
                            score: item.score,
                            maxScore: item.max_score,
                            weight: item.weight_percent,
                            status: 'Completed',
                            feedback: 'Detailed responses evaluated against standard technical assessment rubrics.',
                          })
                        }
                      >
                        <td className="py-3 px-3 font-medium text-[var(--color-ink-800)]">{item.title}</td>
                        <td className="py-3 px-3 text-[var(--color-ink-500)]">{item.type}</td>
                        <td className="py-3 px-3 text-[var(--color-ink-500)]">{item.weight_percent}%</td>
                        <td className="py-3 px-3 text-[var(--color-ink-400)]">{item.date}</td>
                        <td className="py-3 px-3 text-right font-bold text-[var(--color-ink-900)]">
                          {item.score} / {item.max_score}
                        </td>
                        <td className="py-3 px-3 text-right text-[var(--color-harbor-600)] font-semibold">
                          View details →
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* 2. Classwork Performance */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-[var(--color-success-100)] text-[var(--color-success-600)] flex items-center justify-center">
                    <BookOpen size={16} />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-semibold text-[var(--color-ink-900)]">
                      Classwork & Practical Labs
                    </h3>
                    <p className="text-xs text-[var(--color-ink-400)]">Regular assignments, coding labs, and practical exercises</p>
                  </div>
                </div>
                <Badge tone="success">
                  {selectedCourse.classwork_performance.filter(c => c.status === 'Completed').length} /{' '}
                  {selectedCourse.classwork_performance.length} Completed
                </Badge>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--color-line)] text-[var(--color-ink-400)] uppercase font-semibold">
                      <th className="py-2.5 px-3">Classwork / Lab</th>
                      <th className="py-2.5 px-3">Format</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Completed On</th>
                      <th className="py-2.5 px-3 text-right">Score</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-line)]">
                    {selectedCourse.classwork_performance.map((item, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-[var(--color-surface)] transition-colors cursor-pointer"
                        onClick={() =>
                          setSelectedDetailItem({
                            title: item.title,
                            category: 'Classwork',
                            score: item.score,
                            maxScore: item.max_score,
                            status: item.status,
                            feedback: 'Practical exercise evaluated for code modularity, styling, and semantic correctness.',
                          })
                        }
                      >
                        <td className="py-3 px-3 font-medium text-[var(--color-ink-800)]">{item.title}</td>
                        <td className="py-3 px-3 text-[var(--color-ink-500)]">{item.type}</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--color-success-100)] text-[var(--color-success-700)]">
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[var(--color-ink-400)]">{item.date}</td>
                        <td className="py-3 px-3 text-right font-bold text-[var(--color-ink-900)]">
                          {item.score} / {item.max_score}
                        </td>
                        <td className="py-3 px-3 text-right text-[var(--color-harbor-600)] font-semibold">
                          View details →
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* 3. Project Performance */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-[var(--color-ember-100)] text-[var(--color-ember-600)] flex items-center justify-center">
                    <FolderKanban size={16} />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-semibold text-[var(--color-ink-900)]">
                      Project & Capstone Performance
                    </h3>
                    <p className="text-xs text-[var(--color-ink-400)]">Milestone deliverables, portfolio capstones, and peer reviews</p>
                  </div>
                </div>
                <Badge tone="ember">Capstone Ready</Badge>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--color-line)] text-[var(--color-ink-400)] uppercase font-semibold">
                      <th className="py-2.5 px-3">Project Title</th>
                      <th className="py-2.5 px-3">Milestone Type</th>
                      <th className="py-2.5 px-3">Weight</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Score</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-line)]">
                    {selectedCourse.project_performance.map((item, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-[var(--color-surface)] transition-colors cursor-pointer"
                        onClick={() =>
                          setSelectedDetailItem({
                            title: item.title,
                            category: 'Project',
                            score: item.score,
                            maxScore: item.max_score,
                            weight: item.weight_percent,
                            status: item.status,
                            feedback: 'Comprehensive capstone project evaluated on user experience, system architecture, and code quality.',
                          })
                        }
                      >
                        <td className="py-3 px-3 font-medium text-[var(--color-ink-800)]">{item.title}</td>
                        <td className="py-3 px-3 text-[var(--color-ink-500)]">{item.type}</td>
                        <td className="py-3 px-3 text-[var(--color-ink-500)]">{item.weight_percent}%</td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              item.status === 'Completed'
                                ? 'bg-[var(--color-success-100)] text-[var(--color-success-700)]'
                                : 'bg-[var(--color-warning-100)] text-[var(--color-warning-700)]'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-[var(--color-ink-900)]">
                          {item.score > 0 ? `${item.score} / ${item.max_score}` : 'Under Review'}
                        </td>
                        <td className="py-3 px-3 text-right text-[var(--color-harbor-600)] font-semibold">
                          View details →
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Modal / Detail View for Selected Item */}
          {selectedDetailItem && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
              <Card className="w-full max-w-lg p-6 bg-white shadow-2xl relative">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <Badge tone="harbor">{selectedDetailItem.category}</Badge>
                    <h3 className="font-display text-lg font-bold text-[var(--color-ink-900)] mt-1">
                      {selectedDetailItem.title}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedDetailItem(null)}
                    className="text-xs text-[var(--color-ink-400)] hover:text-[var(--color-ink-800)] p-1"
                  >
                    ✕ Close
                  </button>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3 p-3 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-line)]">
                    <div>
                      <span className="text-[var(--color-ink-400)] block">Result Score</span>
                      <span className="font-display text-xl font-bold text-[var(--color-ink-900)]">
                        {selectedDetailItem.score} / {selectedDetailItem.maxScore}
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--color-ink-400)] block">Performance Grade</span>
                      <span className="font-display text-xl font-bold text-[var(--color-harbor-600)]">
                        {selectedDetailItem.score >= 90 ? 'Grade A' : selectedDetailItem.score >= 80 ? 'Grade B' : 'In Progress'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="font-semibold text-[var(--color-ink-800)] block mb-1">
                      Evaluator Assessment Notes
                    </span>
                    <p className="text-[var(--color-ink-600)] leading-relaxed bg-[var(--color-surface)] p-3 rounded-[var(--radius-md)]">
                      {selectedDetailItem.feedback}
                    </p>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => setSelectedDetailItem(null)}
                      className="px-4 py-2 bg-[var(--color-harbor-500)] text-white font-semibold rounded-[var(--radius-md)] text-xs hover:bg-[var(--color-harbor-600)]"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      ) : (
        /* View 1: Results Overview */
        <div className="space-y-6">
          <PageHeader
            title={
              isStaff
                ? 'Academic Results & Student Performance'
                : isParent
                ? 'Academic Results & Progress'
                : 'Results Overview'
            }
            subtitle={
              isStaff
                ? 'Institutional transcript record: Audit cumulative averages, course competencies, and exam evaluations.'
                : isParent
                ? 'Guardian portal: Track cumulative GPA, competency benchmarks, and official course grades for your child.'
                : 'How am I performing overall? View cumulative GPA, competency benchmarks, and course results.'
            }
            actions={
              isStaff ? (
                <div className="flex items-center gap-3">
                  <Link
                    to="/grading-queue"
                    className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[var(--color-harbor-600)]"
                  >
                    <FileCheck size={14} />
                    Grade Work
                  </Link>
                  <button
                    id="clear-results-btn"
                    type="button"
                    onClick={() => setShowClearConfirm(true)}
                    className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-danger-300)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-danger-700)] hover:bg-[var(--color-danger-50)] shadow-xs transition-colors"
                  >
                    <Trash2 size={14} />
                    Clear Results Data
                  </button>
                </div>
              ) : undefined
            }
          />

          {/* Top Performance Banner Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[var(--color-harbor-100)] text-[var(--color-harbor-600)] flex items-center justify-center shrink-0">
                <TrendingUp size={20} />
              </div>
              <div>
                <span className="text-xs text-[var(--color-ink-400)] block font-medium">Cumulative GPA</span>
                <span className="font-display text-xl font-bold text-[var(--color-ink-900)]">
                  {cumulativeGpa === '—' ? '—' : `${cumulativeAverage}% · ${cumulativeGpa}`}
                </span>
              </div>
            </Card>

            <Card className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[var(--color-success-100)] text-[var(--color-success-600)] flex items-center justify-center shrink-0">
                <Sparkles size={20} />
              </div>
              <div>
                <span className="text-xs text-[var(--color-ink-400)] block font-medium">Standing</span>
                <span className="font-display text-sm font-bold text-[var(--color-success-700)]">
                  {academicStanding}
                </span>
              </div>
            </Card>

            <Card className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[var(--color-ember-100)] text-[var(--color-ember-600)] flex items-center justify-center shrink-0">
                <Award size={20} />
              </div>
              <div>
                <span className="text-xs text-[var(--color-ink-400)] block font-medium">Track Progress</span>
                <span className="font-display text-xl font-bold text-[var(--color-ink-900)]">
                  {trackProgress}% Complete
                </span>
              </div>
            </Card>

            <Card className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[var(--color-harbor-100)] text-[var(--color-harbor-600)] flex items-center justify-center shrink-0">
                <CalendarCheck size={20} />
              </div>
              <div>
                <span className="text-xs text-[var(--color-ink-400)] block font-medium">Avg Attendance</span>
                <span className="font-display text-xl font-bold text-[var(--color-ink-900)]">
                  {courseResults.length === 0 ? '—' : `${averageAttendance}% Present`}
                </span>
              </div>
            </Card>
          </div>

          {/* Performance Overview Component Breakdown */}
          <Card className="p-6">
            <SectionHeading
              eyebrow="Competency Breakdown"
              title="Performance by Evaluation Area"
            />
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[var(--color-ink-700)]">Assessments & Exams</span>
                  <span className="text-xs font-bold text-[var(--color-harbor-600)]">{avgAssessments}%</span>
                </div>
                <div className="w-full bg-[var(--color-line)] h-2 rounded-full overflow-hidden">
                  <div className="bg-[var(--color-harbor-500)] h-full rounded-full" style={{ width: `${avgAssessments}%` }} />
                </div>
                <span className="mt-2 block text-[11px] text-[var(--color-ink-400)]">Quizzes, Midterms, Practical checks</span>
              </div>

              <div className="p-4 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[var(--color-ink-700)]">Classwork & Labs</span>
                  <span className="text-xs font-bold text-[var(--color-success-600)]">{avgClasswork}%</span>
                </div>
                <div className="w-full bg-[var(--color-line)] h-2 rounded-full overflow-hidden">
                  <div className="bg-[var(--color-success-500)] h-full rounded-full" style={{ width: `${avgClasswork}%` }} />
                </div>
                <span className="mt-2 block text-[11px] text-[var(--color-ink-400)]">Practical assignments and deliverables</span>
              </div>

              <div className="p-4 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[var(--color-ink-700)]">Projects & Capstones</span>
                  <span className="text-xs font-bold text-[var(--color-ember-600)]">{avgProjects}%</span>
                </div>
                <div className="w-full bg-[var(--color-line)] h-2 rounded-full overflow-hidden">
                  <div className="bg-[var(--color-ember-500)] h-full rounded-full" style={{ width: `${avgProjects}%` }} />
                </div>
                <span className="mt-2 block text-[11px] text-[var(--color-ink-400)]">Portfolio milestones and submissions</span>
              </div>
            </div>
          </Card>

          {/* Enrolled Courses Results List */}
          <div className="space-y-4">
            <h2 className="font-display text-base font-semibold text-[var(--color-ink-900)]">
              Enrolled Courses & Academic Standings
            </h2>

            {courseResults.length === 0 ? (
              <Card className="p-12 text-center text-sm text-[var(--color-ink-400)]">
                <BookOpen size={28} className="mx-auto mb-2 text-[var(--color-ink-300)]" />
                <p className="font-semibold text-[var(--color-ink-800)]">No academic results published yet</p>
                <p className="text-xs text-[var(--color-ink-500)] mt-1 max-w-md mx-auto">
                  Institutional transcript records, course grades, weighted exam scores, and capstone evaluations will appear here once finalized by academic trainers.
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {courseResults.map(course => (
                  <Card
                    key={course.course_id}
                    id={`course-result-${course.course_id}`}
                    onClick={() => handleSelectCourse(course)}
                    className="p-6 hover:border-[var(--color-harbor-400)] transition-all cursor-pointer group"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                      {/* Info */}
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge tone="harbor">{course.course_code}</Badge>
                          <Badge tone={course.status === 'Completed' ? 'success' : 'neutral'}>
                            {course.status}
                          </Badge>
                          <span className="text-xs text-[var(--color-ink-400)]">{course.cohort_name}</span>
                        </div>

                        <h3 className="font-display text-lg font-bold text-[var(--color-ink-900)] group-hover:text-[var(--color-harbor-600)] transition-colors">
                          {course.course_name}
                        </h3>

                        <p className="text-xs text-[var(--color-ink-500)]">
                          Instructor: <strong>{course.trainer_name}</strong> · Attendance: <strong>{course.attendance_percent}%</strong>
                        </p>

                        {/* Mini metric badges */}
                        <div className="flex items-center gap-4 pt-1 text-xs">
                          <span className="text-[var(--color-ink-600)]">
                            Assessments: <strong className="text-[var(--color-ink-900)]">{course.assessments_score}%</strong>
                          </span>
                          <span>·</span>
                          <span className="text-[var(--color-ink-600)]">
                            Classwork: <strong className="text-[var(--color-ink-900)]">{course.classwork_score}%</strong>
                          </span>
                          <span>·</span>
                          <span className="text-[var(--color-ink-600)]">
                            Projects: <strong className="text-[var(--color-ink-900)]">{course.projects_score}%</strong>
                          </span>
                        </div>
                      </div>

                      {/* Right: Grade & View Details */}
                      <div className="flex items-center gap-6 justify-between lg:justify-end border-t lg:border-t-0 pt-4 lg:pt-0 border-[var(--color-line)] shrink-0">
                        <div className="text-right">
                          <span className="text-xs text-[var(--color-ink-400)] block uppercase font-semibold">Course Grade</span>
                          <div className="flex items-baseline gap-2">
                            <span className="font-display text-2xl font-bold text-[var(--color-ink-900)]">
                              {course.overall_score}%
                            </span>
                            <span className="text-sm font-bold text-[var(--color-harbor-600)] px-2 py-0.5 rounded-md bg-[var(--color-harbor-100)]">
                              Grade {course.overall_grade}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-harbor-600)] group-hover:translate-x-1 transition-transform">
                          <span>View Course Results</span>
                          <ChevronRight size={16} />
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <Modal title="Clear Academic Results" onClose={() => setShowClearConfirm(false)}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-[var(--radius-md)] bg-[var(--color-danger-50)] p-3 text-xs text-[var(--color-danger-800)] border border-[var(--color-danger-200)]">
              <AlertTriangle className="h-5 w-5 shrink-0 text-[var(--color-danger-600)]" />
              <div>
                <p className="font-semibold">Reset all published academic results?</p>
                <p className="mt-1">
                  This will reset cumulative records, exam marks, and published course completion results.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3.5 py-2 text-xs font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-surface)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.removeItem('ijesha_hub_course_results_v2')
                  } catch {
                    // ignore
                  }
                  setCourseResults([])
                  setSelectedCourseId(null)
                  setShowClearConfirm(false)
                }}
                className="rounded-[var(--radius-md)] bg-[var(--color-danger-600)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--color-danger-700)]"
              >
                Clear Results Now
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
