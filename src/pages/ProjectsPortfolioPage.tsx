import { useState, useMemo, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  FolderKanban,
  Briefcase,
  Search,
  CheckCircle2,
  ExternalLink,
  Code2,
  Plus,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  Star,
  Save,
  Send,
  ArrowLeft,
  FileText,
  Paperclip,
  Share2,
  Sparkles,
  ListChecks,
} from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import { Card, Badge, SectionHeading } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { Field } from '@/components/ui/Field'
import { useAuth } from '@/app/auth'
import {
  getStudentProjects,
  saveStudentProject,
  getPortfolioItems,
  savePortfolioItem,
  deletePortfolioItem,
  type StudentProject,
  type PortfolioItem,
} from '@/lib/studentFlow'
import { clearProjectsData } from '@/lib/clearData'

export function ProjectsPortfolioPage() {
  const { id: paramProjectId } = useParams<{ id?: string }>()
  const { user, role } = useAuth()
  const isStaff = role === 'trainer' || role === 'manager' || role === 'admin'
  const isParent = role === 'parent'

  // Main navigation tabs: 'projects' | 'portfolio'
  const [activeTab, setActiveTab] = useState<'projects' | 'portfolio'>('projects')

  // Projects State
  const [projects, setProjects] = useState<StudentProject[]>(() => getStudentProjects())
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(paramProjectId ?? null)
  const [projectSearch, setProjectSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState<string>('All')
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  // Project Work Editor State
  const activeProject = useMemo(() => {
    const id = selectedProjectId ?? paramProjectId
    return projects.find(p => p.id === id) ?? null
  }, [projects, selectedProjectId, paramProjectId])

  const [workNotes, setWorkNotes] = useState(activeProject?.student_work.notes ?? '')
  const [workRepo, setWorkRepo] = useState(activeProject?.student_work.repo_url ?? '')
  const [workDemo, setWorkDemo] = useState(activeProject?.student_work.demo_url ?? '')
  const [workFiles, setWorkFiles] = useState(activeProject?.student_work.files ?? [])
  const [saveStatusNotice, setSaveStatusNotice] = useState<string | null>(null)
  const [submitModalOpen, setSubmitModalOpen] = useState(false)

  // Portfolio State
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>(() => getPortfolioItems())
  const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null)
  const [showAddProjectModal, setShowAddProjectModal] = useState(false)
  const [showPublicPreviewModal, setShowPublicPreviewModal] = useState(false)
  const [portfolioNotice, setPortfolioNotice] = useState<string | null>(null)

  useEffect(() => {
    const handleSync = () => {
      setProjects(getStudentProjects())
      setPortfolioItems(getPortfolioItems())
      setSelectedProjectId(null)
    }
    window.addEventListener('student-projects-updated', handleSync)
    window.addEventListener('portfolio-items-updated', handleSync)
    window.addEventListener('app-data-cleared', handleSync)
    return () => {
      window.removeEventListener('student-projects-updated', handleSync)
      window.removeEventListener('portfolio-items-updated', handleSync)
      window.removeEventListener('app-data-cleared', handleSync)
    }
  }, [])

  const handleClearAllProjects = () => {
    clearProjectsData()
    setProjects([])
    setPortfolioItems([])
    setSelectedProjectId(null)
    setShowClearConfirm(false)
  }

  // Sync project editor values when activeProject changes
  const handleSelectProject = (proj: StudentProject) => {
    setSelectedProjectId(proj.id)
    setWorkNotes(proj.student_work.notes)
    setWorkRepo(proj.student_work.repo_url)
    setWorkDemo(proj.student_work.demo_url)
    setWorkFiles(proj.student_work.files)
    setSaveStatusNotice(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Filter projects
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchesSearch =
        !projectSearch.trim() ||
        p.title.toLowerCase().includes(projectSearch.toLowerCase()) ||
        p.course_name.toLowerCase().includes(projectSearch.toLowerCase())
      const matchesFilter =
        projectFilter === 'All'
          ? true
          : projectFilter === 'Completed'
          ? p.status === 'Completed'
          : projectFilter === 'In Progress'
          ? p.status === 'In Progress'
          : projectFilter === 'Submitted'
          ? p.status === 'Submitted'
          : true
      return matchesSearch && matchesFilter
    })
  }, [projects, projectSearch, projectFilter])

  // Completed projects available to add to portfolio
  const eligibleCompletedProjects = useMemo(() => {
    const existingProjectIds = new Set(portfolioItems.map(item => item.project_id))
    return projects.filter(p => p.status === 'Completed' && !existingProjectIds.has(p.id))
  }, [projects, portfolioItems])

  // Save Progress
  const handleSaveProgress = () => {
    if (!activeProject) return
    const updated: StudentProject = {
      ...activeProject,
      student_work: {
        ...activeProject.student_work,
        notes: workNotes,
        repo_url: workRepo,
        demo_url: workDemo,
        files: workFiles,
        last_saved: new Date().toISOString(),
      },
    }
    saveStudentProject(updated)
    setProjects(getStudentProjects())
    setSaveStatusNotice('Work progress saved as draft.')
    setTimeout(() => setSaveStatusNotice(null), 3500)
  }

  // Toggle Phase check
  const handleTogglePhase = (index: number) => {
    if (!activeProject) return
    const updatedPhases = [...activeProject.phases]
    updatedPhases[index].completed = !updatedPhases[index].completed
    const completedCount = updatedPhases.filter(p => p.completed).length
    const progressPct = Math.round((completedCount / updatedPhases.length) * 100)

    const updated: StudentProject = {
      ...activeProject,
      phases: updatedPhases,
      progress_percent: progressPct,
    }
    saveStudentProject(updated)
    setProjects(getStudentProjects())
  }

  // Submit Project
  const handleConfirmSubmit = () => {
    if (!activeProject) return
    const updated: StudentProject = {
      ...activeProject,
      status: 'Submitted',
      student_work: {
        ...activeProject.student_work,
        notes: workNotes,
        repo_url: workRepo,
        demo_url: workDemo,
        files: workFiles,
        last_saved: new Date().toISOString(),
      },
      submission: {
        ...activeProject.submission,
        status: 'Submitted',
        submitted_at: new Date().toISOString(),
      },
    }
    saveStudentProject(updated)
    setProjects(getStudentProjects())
    setSubmitModalOpen(false)
    setSaveStatusNotice('Project successfully submitted for trainer evaluation!')
  }

  // Add completed project to portfolio
  const handleAddProjectToPortfolio = (proj: StudentProject) => {
    const newItem: PortfolioItem = {
      id: `port-${Date.now()}`,
      project_id: proj.id,
      student_id: 'student-curr',
      title: proj.title,
      tagline: proj.description.slice(0, 110) + '...',
      summary_description: proj.description,
      tech_stack: ['React', 'TypeScript', 'Tailwind CSS'],
      live_demo_url: proj.student_work.demo_url || '',
      repo_url: proj.student_work.repo_url || '',
      role: 'Lead Developer',
      key_highlights: [
        'Modular component architecture with responsive viewport optimizations.',
        'Integration with REST API endpoints and state persistence.',
      ],
      cover_image:
        'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80',
      visibility: 'public',
      order_index: portfolioItems.length + 1,
      featured: false,
      added_at: new Date().toISOString(),
    }
    savePortfolioItem(newItem)
    setPortfolioItems(getPortfolioItems())
    setShowAddProjectModal(false)
    setActiveTab('portfolio')
    setPortfolioNotice(`"${proj.title}" added to your portfolio showcase!`)
    setTimeout(() => setPortfolioNotice(null), 4000)
  }

  // Toggle visibility
  const handleToggleVisibility = (item: PortfolioItem) => {
    const updated: PortfolioItem = {
      ...item,
      visibility: item.visibility === 'public' ? 'private' : 'public',
    }
    savePortfolioItem(updated)
    setPortfolioItems(getPortfolioItems())
  }

  // Toggle Featured
  const handleToggleFeatured = (item: PortfolioItem) => {
    const updated: PortfolioItem = {
      ...item,
      featured: !item.featured,
    }
    savePortfolioItem(updated)
    setPortfolioItems(getPortfolioItems())
  }

  // Delete from portfolio
  const handleDeletePortfolioItem = (id: string) => {
    deletePortfolioItem(id)
    setPortfolioItems(getPortfolioItems())
  }

  // Save portfolio edit
  const handleSavePortfolioEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingItem) return
    savePortfolioItem(editingItem)
    setPortfolioItems(getPortfolioItems())
    setEditingItem(null)
    setPortfolioNotice('Portfolio item updated successfully.')
    setTimeout(() => setPortfolioNotice(null), 3000)
  }

  return (
    <div id="projects-portfolio-page" className="space-y-6 pb-12">
      {/* Top Header */}
      <PageHeader
        title={
          isStaff
            ? 'Projects & Student Showcase'
            : isParent
            ? 'Student Projects & Portfolio'
            : 'Projects / Portfolio'
        }
        subtitle={
          isStaff
            ? 'Review cohort capstone deliverables, inspect code repositories and live demos, and audit public showcases.'
            : isParent
            ? "Guardian showcase: Review your child's technical capstone projects, milestones, live demos, and portfolio."
            : 'What have I built and what can I showcase? Manage cohort capstone projects and curate your public developer portfolio.'
        }
        actions={
          activeTab === 'portfolio' ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                disabled={portfolioItems.length === 0}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 size={14} />
                Clear Portfolio
              </button>
              <button
                id="preview-portfolio-btn"
                onClick={() => setShowPublicPreviewModal(true)}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3.5 py-2 text-xs font-semibold text-[var(--color-ink-800)] hover:bg-[var(--color-surface)] shadow-xs transition-colors"
              >
                <Eye size={14} />
                Preview Public Portfolio
              </button>
              {!isParent && (
                <button
                  id="add-to-portfolio-btn"
                  onClick={() => setShowAddProjectModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[var(--color-harbor-600)] transition-colors"
                >
                  <Plus size={14} />
                  Add Project to Portfolio
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                disabled={projects.length === 0}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 size={14} />
                Clear Projects Data
              </button>
              {isStaff && (
                <Link
                  to="/grading-queue"
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[var(--color-harbor-600)] transition-colors"
                >
                  <ListChecks size={14} />
                  Open Grading Queue
                </Link>
              )}
            </div>
          )
        }
      />

      {/* Main Tabs Header */}
      <div className="flex items-center border-b border-[var(--color-line)] gap-8">
        <button
          id="tab-projects"
          onClick={() => {
            setActiveTab('projects')
            setSelectedProjectId(null)
          }}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold transition-colors border-b-2 ${
            activeTab === 'projects'
              ? 'border-[var(--color-harbor-500)] text-[var(--color-harbor-600)]'
              : 'border-transparent text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)]'
          }`}
        >
          <FolderKanban size={18} />
          <span>Projects</span>
          <span className="rounded-full bg-[var(--color-surface)] border border-[var(--color-line)] px-2 py-0.5 text-xs text-[var(--color-ink-600)]">
            {projects.length}
          </span>
        </button>

        <button
          id="tab-portfolio"
          onClick={() => {
            setActiveTab('portfolio')
            setSelectedProjectId(null)
          }}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold transition-colors border-b-2 ${
            activeTab === 'portfolio'
              ? 'border-[var(--color-harbor-500)] text-[var(--color-harbor-600)]'
              : 'border-transparent text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)]'
          }`}
        >
          <Briefcase size={18} />
          <span>Portfolio</span>
          <span className="rounded-full bg-[var(--color-surface)] border border-[var(--color-line)] px-2 py-0.5 text-xs text-[var(--color-ink-600)]">
            {portfolioItems.length}
          </span>
        </button>
      </div>

      {portfolioNotice && (
        <div className="p-3.5 rounded-[var(--radius-md)] bg-[var(--color-success-100)] text-[var(--color-success-700)] border border-[var(--color-success-200)] text-xs flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>{portfolioNotice}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: PROJECTS */}
      {/* ========================================================================= */}
      {activeTab === 'projects' && (
        <>
          {/* Sub-view: Project Details */}
          {activeProject ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <button
                  id="back-to-projects-list-btn"
                  onClick={() => setSelectedProjectId(null)}
                  className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-ink-600)] hover:text-[var(--color-harbor-600)] transition-colors"
                >
                  <ArrowLeft size={16} />
                  Back to Projects
                </button>
                <div className="flex items-center gap-2">
                  <Badge
                    tone={
                      activeProject.status === 'Completed'
                        ? 'success'
                        : activeProject.status === 'Submitted'
                        ? 'harbor'
                        : 'warning'
                    }
                  >
                    {activeProject.status}
                  </Badge>
                  {activeProject.status === 'Completed' && (
                    <button
                      onClick={() => handleAddProjectToPortfolio(activeProject)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-harbor-600)] hover:underline"
                    >
                      <Sparkles size={13} />
                      Add to Portfolio
                    </button>
                  )}
                </div>
              </div>

              {saveStatusNotice && (
                <div className="p-3.5 rounded-[var(--radius-md)] bg-[var(--color-success-100)] text-[var(--color-success-700)] border border-[var(--color-success-200)] text-xs flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>{saveStatusNotice}</span>
                </div>
              )}

              {/* Project Hero Card */}
              <Card className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge tone="harbor">{activeProject.course_name}</Badge>
                      <span className="text-xs text-[var(--color-ink-400)]">{activeProject.cohort_name}</span>
                    </div>
                    <h1 className="font-display text-2xl font-bold text-[var(--color-ink-900)]">
                      {activeProject.title}
                    </h1>
                    <p className="mt-2 text-sm text-[var(--color-ink-600)] max-w-2xl leading-relaxed">
                      {activeProject.description}
                    </p>
                    <div className="mt-3 flex items-center gap-4 text-xs text-[var(--color-ink-400)]">
                      <span>Trainer: <strong className="text-[var(--color-ink-700)]">{activeProject.trainer_name}</strong></span>
                      <span>·</span>
                      <span>Due Date: <strong>{new Date(activeProject.due_date).toLocaleDateString()}</strong></span>
                      <span>·</span>
                      <span>Max Score: <strong>{activeProject.maximum_score} pts</strong></span>
                    </div>
                  </div>

                  {/* Progress Ring Box */}
                  <div className="flex items-center gap-4 bg-[var(--color-surface)] border border-[var(--color-line)] p-4 rounded-[var(--radius-lg)] shrink-0">
                    <div className="text-center pr-4 border-r border-[var(--color-line)]">
                      <span className="text-xs font-semibold uppercase text-[var(--color-ink-400)] block">Progress</span>
                      <span className="font-display text-2xl font-bold text-[var(--color-harbor-600)]">
                        {activeProject.progress_percent}%
                      </span>
                    </div>
                    <div>
                      <span className="text-xs font-semibold uppercase text-[var(--color-ink-400)] block">Review Score</span>
                      <div className="flex items-baseline gap-1">
                        <span className="font-display text-xl font-bold text-[var(--color-ink-900)]">
                          {activeProject.submission.score !== null ? activeProject.submission.score : 'Pending'}
                        </span>
                        <span className="text-xs text-[var(--color-ink-400)]">/ {activeProject.maximum_score}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Grid: Instructions & Work Area */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Instructions & Resources & Progress Phases */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Instructions */}
                  <Card className="p-6">
                    <SectionHeading eyebrow="Brief" title="Instructions & Deliverables" />
                    <div className="mt-4 prose prose-sm text-xs text-[var(--color-ink-700)] max-w-none whitespace-pre-wrap leading-relaxed">
                      {activeProject.instructions}
                    </div>
                  </Card>

                  {/* Implementation Progress Phases */}
                  <Card className="p-6">
                    <SectionHeading eyebrow="Roadmap" title="Project Milestone Phases" />
                    <div className="mt-4 space-y-3">
                      {activeProject.phases.map((phase, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleTogglePhase(idx)}
                          className="flex items-start gap-3 p-3 rounded-[var(--radius-md)] border border-[var(--color-line)] hover:bg-[var(--color-surface)] cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={phase.completed}
                            onChange={() => {}}
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-[var(--color-harbor-600)] focus:ring-[var(--color-harbor-500)] cursor-pointer"
                          />
                          <div className="flex-1 min-w-0 text-xs">
                            <span
                              className={`font-semibold block ${
                                phase.completed
                                  ? 'text-[var(--color-ink-400)] line-through'
                                  : 'text-[var(--color-ink-900)]'
                              }`}
                            >
                              {idx + 1}. {phase.name}
                            </span>
                            <span className="text-[var(--color-ink-500)] text-[11px] block mt-0.5">
                              {phase.description}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* Student Work: Text Editor & Links */}
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <SectionHeading eyebrow="Submissions" title="Student Work & Deliverables" />
                      {activeProject.student_work.last_saved && (
                        <span className="text-[11px] text-[var(--color-ink-400)]">
                          Draft saved: {new Date(activeProject.student_work.last_saved).toLocaleTimeString()}
                        </span>
                      )}
                    </div>

                    <div className="space-y-4 text-xs">
                      <div>
                        <label className="block font-medium text-[var(--color-ink-700)] mb-1">
                          Written Response & Architectural Documentation
                        </label>
                        <textarea
                          rows={6}
                          value={workNotes}
                          onChange={e => setWorkNotes(e.target.value)}
                          placeholder="Describe your technical architecture, component breakdown, trade-offs, and how you met the objectives..."
                          className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] p-3 focus:border-[var(--color-harbor-500)] focus:outline-none leading-relaxed"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block font-medium text-[var(--color-ink-700)] mb-1">
                            GitHub / Source Repository URL
                          </label>
                          <div className="relative">
                            <Code2 size={14} className="absolute left-3 top-2.5 text-[var(--color-ink-400)]" />
                            <input
                              type="url"
                              value={workRepo}
                              onChange={e => setWorkRepo(e.target.value)}
                              placeholder="https://github.com/username/project"
                              className="w-full pl-9 pr-3 py-2 rounded-[var(--radius-md)] border border-[var(--color-line)] focus:outline-none focus:border-[var(--color-harbor-500)]"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block font-medium text-[var(--color-ink-700)] mb-1">
                            Live Demo / Deployed Application URL
                          </label>
                          <div className="relative">
                            <ExternalLink size={14} className="absolute left-3 top-2.5 text-[var(--color-ink-400)]" />
                            <input
                              type="url"
                              value={workDemo}
                              onChange={e => setWorkDemo(e.target.value)}
                              placeholder="https://my-app.vercel.app"
                              className="w-full pl-9 pr-3 py-2 rounded-[var(--radius-md)] border border-[var(--color-line)] focus:outline-none focus:border-[var(--color-harbor-500)]"
                            />
                          </div>
                        </div>
                      </div>

                      {/* File Attachments */}
                      <div>
                        <label className="block font-medium text-[var(--color-ink-700)] mb-1">
                          Supporting Assets / Deliverable Files
                        </label>
                        <label className="flex flex-col items-center justify-center border-2 border-dashed border-[var(--color-line)] rounded-[var(--radius-md)] p-4 text-center cursor-pointer hover:border-[var(--color-harbor-400)] transition-colors">
                          <Paperclip size={18} className="text-[var(--color-ink-400)] mb-1" />
                          <span className="text-xs font-medium text-[var(--color-ink-600)]">
                            Upload project archive or documentation
                          </span>
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            onChange={e => {
                              if (e.target.files && e.target.files.length > 0) {
                                const newF = Array.from(e.target.files).map(f => ({
                                  name: f.name,
                                  size: `${(f.size / (1024 * 1024)).toFixed(1)} MB`,
                                }))
                                setWorkFiles(prev => [...prev, ...newF])
                              }
                            }}
                          />
                        </label>

                        {workFiles.length > 0 && (
                          <div className="mt-3 space-y-1.5">
                            {workFiles.map((file, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between p-2 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-line)]"
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <FileText size={14} className="text-[var(--color-harbor-600)] shrink-0" />
                                  <span className="truncate">{file.name}</span>
                                  <span className="text-[var(--color-ink-400)]">({file.size})</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setWorkFiles(prev => prev.filter((_, i) => i !== idx))}
                                  className="text-xs text-[var(--color-danger-600)] hover:underline ml-2"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Action buttons: Save Progress & Submit */}
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[var(--color-line)]">
                        {isParent ? (
                          <span className="text-xs text-[var(--color-ink-500)] italic">
                            Guardian mode: Deliverables and submissions are submitted by the enrolled student.
                          </span>
                        ) : isStaff ? (
                          <>
                            <div className="flex items-center gap-2">
                              <Badge tone="harbor">Staff Evaluation Mode</Badge>
                              <span className="text-xs text-[var(--color-ink-500)]">
                                Inspect code repo, test live demo, or evaluate submission in queue.
                              </span>
                            </div>
                            <Link
                              to="/grading-queue"
                              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[var(--color-harbor-600)] transition-colors"
                            >
                              <ListChecks size={14} />
                              Open Grading Queue
                            </Link>
                          </>
                        ) : (
                          <>
                            <button
                              id="save-project-progress-btn"
                              type="button"
                              onClick={handleSaveProgress}
                              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-4 py-2 text-xs font-semibold text-[var(--color-ink-800)] hover:bg-[var(--color-surface)] shadow-xs transition-colors"
                            >
                              <Save size={14} />
                              Save Progress
                            </button>

                            <button
                              id="submit-project-btn"
                              type="button"
                              onClick={() => setSubmitModalOpen(true)}
                              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[var(--color-harbor-600)] transition-colors"
                            >
                              <Send size={14} />
                              {activeProject.status === 'Submitted' || activeProject.status === 'Completed'
                                ? 'Resubmit Project'
                                : 'Submit Project'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Right Column: Resources & Review Status */}
                <div className="space-y-6">
                  {/* Learning Resources */}
                  <Card className="p-6">
                    <SectionHeading eyebrow="Learning" title="Learning Resources" />
                    <div className="mt-4 space-y-2">
                      {activeProject.resources.map((res, idx) => (
                        <a
                          key={idx}
                          href={res.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between p-3 rounded-[var(--radius-md)] border border-[var(--color-line)] hover:border-[var(--color-harbor-400)] transition-colors text-xs group"
                        >
                          <span className="font-medium text-[var(--color-ink-800)] group-hover:text-[var(--color-harbor-600)] truncate">
                            {res.name}
                          </span>
                          <ExternalLink size={13} className="text-[var(--color-ink-400)] group-hover:text-[var(--color-harbor-600)] shrink-0 ml-2" />
                        </a>
                      ))}
                    </div>
                  </Card>

                  {/* Review Status & Feedback */}
                  <Card className="p-6">
                    <SectionHeading eyebrow="Evaluation" title="Trainer Review" />
                    <div className="mt-4 space-y-3 text-xs">
                      <div className="flex justify-between py-1.5 border-b border-[var(--color-line)]">
                        <span className="text-[var(--color-ink-500)]">Review Status</span>
                        <Badge
                          tone={
                            activeProject.submission.status === 'Approved'
                              ? 'success'
                              : activeProject.submission.status === 'Submitted'
                              ? 'harbor'
                              : 'warning'
                          }
                        >
                          {activeProject.submission.status}
                        </Badge>
                      </div>

                      {activeProject.submission.trainer_feedback && (
                        <div className="pt-2">
                          <span className="font-semibold text-[var(--color-ink-800)] block mb-1">
                            Trainer Feedback
                          </span>
                          <p className="p-3 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-ink-700)] leading-relaxed">
                            {activeProject.submission.trainer_feedback}
                          </p>
                        </div>
                      )}

                      {activeProject.submission.improvement_notes && (
                        <div className="pt-1">
                          <span className="font-semibold text-[var(--color-ember-700)] block mb-1">
                            Notes for Next Revision
                          </span>
                          <p className="p-3 rounded-[var(--radius-md)] bg-[var(--color-ember-50)] border border-[var(--color-ember-200)] text-[var(--color-ember-900)] leading-relaxed">
                            {activeProject.submission.improvement_notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          ) : (
            /* Projects List View */
            <div className="space-y-6">
              {/* Search & Filter Bar */}
              <Card className="p-4 space-y-3">
                <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                  <div className="relative w-full sm:w-80">
                    <Search size={16} className="absolute left-3 top-2.5 text-[var(--color-ink-400)]" />
                    <input
                      id="search-projects-input"
                      type="text"
                      value={projectSearch}
                      onChange={e => setProjectSearch(e.target.value)}
                      placeholder="Search projects or courses..."
                      className="w-full pl-9 pr-4 py-2 text-xs rounded-[var(--radius-md)] border border-[var(--color-line)] focus:outline-none focus:border-[var(--color-harbor-500)]"
                    />
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                    {(['All', 'In Progress', 'Submitted', 'Completed'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setProjectFilter(f)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                          projectFilter === f
                            ? 'bg-[var(--color-harbor-500)] text-white'
                            : 'bg-[var(--color-surface)] text-[var(--color-ink-600)] hover:bg-[var(--color-line)]'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Projects Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProjects.map(proj => (
                  <Card
                    key={proj.id}
                    id={`project-card-${proj.id}`}
                    onClick={() => handleSelectProject(proj)}
                    className="p-5 hover:border-[var(--color-harbor-400)] transition-all cursor-pointer flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <Badge tone="harbor">{proj.course_name}</Badge>
                        <Badge
                          tone={
                            proj.status === 'Completed'
                              ? 'success'
                              : proj.status === 'Submitted'
                              ? 'harbor'
                              : 'warning'
                          }
                        >
                          {proj.status}
                        </Badge>
                      </div>

                      <h3 className="font-display text-base font-bold text-[var(--color-ink-900)] group-hover:text-[var(--color-harbor-600)] transition-colors">
                        {proj.title}
                      </h3>

                      <p className="mt-2 text-xs text-[var(--color-ink-500)] line-clamp-2 leading-relaxed">
                        {proj.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-4 border-t border-[var(--color-line)] space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[var(--color-ink-500)]">Progress</span>
                        <span className="font-semibold text-[var(--color-ink-800)]">{proj.progress_percent}%</span>
                      </div>
                      <div className="w-full bg-[var(--color-line)] h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-[var(--color-harbor-500)] h-full rounded-full"
                          style={{ width: `${proj.progress_percent}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 text-[var(--color-ink-400)]">
                        <span>Due: {new Date(proj.due_date).toLocaleDateString()}</span>
                        <span className="font-medium text-[var(--color-harbor-600)] group-hover:translate-x-0.5 transition-transform">
                          Open project →
                        </span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {filteredProjects.length === 0 && (
                <Card className="p-8 text-center text-sm text-[var(--color-ink-400)]">
                  No projects match your filter criteria.
                </Card>
              )}
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PORTFOLIO */}
      {/* ========================================================================= */}
      {activeTab === 'portfolio' && (
        <div className="space-y-6">
          {/* Portfolio Welcome Banner */}
          <Card className="p-6 bg-gradient-to-r from-[var(--color-surface)] to-[var(--color-harbor-50)]/50 border border-[var(--color-line)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold uppercase text-[var(--color-harbor-600)] tracking-wider block mb-1">
                  Showcase & Career Readiness
                </span>
                <h2 className="font-display text-lg font-bold text-[var(--color-ink-900)]">
                  Your Curated Project Portfolio
                </h2>
                <p className="mt-1 text-xs text-[var(--color-ink-600)] max-w-xl leading-relaxed">
                  Select completed cohort capstones, customize their public descriptions and tech stack tags, and share your verifiable portfolio link with tech employers.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  id="share-portfolio-btn"
                  onClick={() => {
                    navigator.clipboard?.writeText?.(window.location.origin + '/portfolio?preview=true')
                    setPortfolioNotice('Shareable portfolio link copied to clipboard!')
                    setTimeout(() => setPortfolioNotice(null), 3000)
                  }}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3 py-2 text-xs font-semibold text-[var(--color-ink-800)] hover:bg-[var(--color-surface)] shadow-xs transition-colors"
                >
                  <Share2 size={14} />
                  Copy Share Link
                </button>
              </div>
            </div>
          </Card>

          {/* Portfolio Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {portfolioItems.map(item => (
              <Card key={item.id} id={`portfolio-card-${item.id}`} className="overflow-hidden flex flex-col justify-between">
                <div>
                  {/* Cover image */}
                  <div className="relative h-44 w-full overflow-hidden bg-gray-100">
                    <img
                      src={item.cover_image}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute top-3 right-3 flex items-center gap-2">
                      <button
                        title={item.visibility === 'public' ? 'Make Private' : 'Make Public'}
                        onClick={() => handleToggleVisibility(item)}
                        className={`p-1.5 rounded-full backdrop-blur-xs text-xs font-medium shadow-xs ${
                          item.visibility === 'public'
                            ? 'bg-emerald-500/90 text-white'
                            : 'bg-gray-800/80 text-gray-300'
                        }`}
                      >
                        {item.visibility === 'public' ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>

                      <button
                        title="Toggle Featured"
                        onClick={() => handleToggleFeatured(item)}
                        className={`p-1.5 rounded-full backdrop-blur-xs text-xs font-medium shadow-xs ${
                          item.featured ? 'bg-amber-500 text-white' : 'bg-black/50 text-white/70'
                        }`}
                      >
                        <Star size={14} className={item.featured ? 'fill-current' : ''} />
                      </button>
                    </div>

                    <div className="absolute bottom-3 left-3">
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md bg-black/60 text-white backdrop-blur-xs">
                        {item.role}
                      </span>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge tone={item.visibility === 'public' ? 'success' : 'neutral'}>
                        {item.visibility === 'public' ? 'Public Showcase' : 'Private Draft'}
                      </Badge>
                      {item.featured && <Badge tone="ember">Featured Showcase</Badge>}
                    </div>

                    <h3 className="font-display text-base font-bold text-[var(--color-ink-900)]">
                      {item.title}
                    </h3>

                    <p className="text-xs font-medium text-[var(--color-harbor-600)]">
                      {item.tagline}
                    </p>

                    <p className="text-xs text-[var(--color-ink-600)] line-clamp-3 leading-relaxed">
                      {item.summary_description}
                    </p>

                    {/* Tech stack tags */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {item.tech_stack.map((tech, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-[var(--color-surface)] border border-[var(--color-line)] text-[11px] font-medium text-[var(--color-ink-700)]"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>

                    {/* Key highlights */}
                    <div className="pt-2 border-t border-[var(--color-line)]">
                      <span className="text-[11px] font-semibold uppercase text-[var(--color-ink-400)] block mb-1">
                        Key Accomplishments
                      </span>
                      <ul className="space-y-1 text-xs text-[var(--color-ink-600)]">
                        {item.key_highlights.map((h, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-[var(--color-harbor-500)]">•</span>
                            <span>{h}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="p-4 bg-[var(--color-surface)] border-t border-[var(--color-line)] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {item.live_demo_url && (
                      <a
                        href={item.live_demo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-harbor-600)] hover:underline"
                      >
                        <ExternalLink size={13} />
                        Live Demo
                      </a>
                    )}
                    {item.repo_url && (
                      <a
                        href={item.repo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-ink-700)] hover:underline"
                      >
                        <Code2 size={13} />
                        Code
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingItem(item)}
                      className="p-1.5 text-[var(--color-ink-600)] hover:text-[var(--color-harbor-600)] rounded-[var(--radius-sm)] transition-colors"
                      title="Edit details"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      onClick={() => handleDeletePortfolioItem(item.id)}
                      className="p-1.5 text-[var(--color-danger-600)] hover:text-[var(--color-danger-700)] rounded-[var(--radius-sm)] transition-colors"
                      title="Remove from portfolio"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {portfolioItems.length === 0 && (
            <Card className="p-12 text-center text-sm text-[var(--color-ink-400)]">
              <Briefcase size={28} className="mx-auto mb-2 text-[var(--color-ink-300)]" />
              <p className="font-semibold text-[var(--color-ink-800)]">No portfolio projects published yet.</p>
              <p className="text-xs text-[var(--color-ink-500)] mt-1">
                Completed capstones can be added to your portfolio with one click.
              </p>
              <button
                onClick={() => setShowAddProjectModal(true)}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] text-white text-xs font-semibold"
              >
                <Plus size={14} />
                Add Completed Project
              </button>
            </Card>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SUBMISSION CONFIRMATION */}
      {/* ========================================================================= */}
      {submitModalOpen && activeProject && (
        <Modal title="Submit Project for Review" onClose={() => setSubmitModalOpen(false)}>
          <div className="space-y-4 text-xs">
            <p className="text-[var(--color-ink-600)] leading-relaxed">
              You are submitting <strong className="text-[var(--color-ink-900)]">{activeProject.title}</strong> for trainer evaluation. Your written documentation, repository link, and attached files will be submitted to{' '}
              <strong>{activeProject.trainer_name}</strong>.
            </p>

            <div className="p-3 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-line)] space-y-1.5">
              <div><strong>Demo URL:</strong> {workDemo || 'None specified'}</div>
              <div><strong>Repo URL:</strong> {workRepo || 'None specified'}</div>
              <div><strong>Attached Files:</strong> {workFiles.length} files</div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSubmitModalOpen(false)}
                className="px-3 py-2 border border-[var(--color-line)] rounded-[var(--radius-md)] font-medium text-[var(--color-ink-600)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                className="px-4 py-2 bg-[var(--color-harbor-500)] text-white font-semibold rounded-[var(--radius-md)] hover:bg-[var(--color-harbor-600)]"
              >
                Confirm & Submit
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD COMPLETED PROJECT TO PORTFOLIO */}
      {/* ========================================================================= */}
      {showAddProjectModal && (
        <Modal title="Add Project to Portfolio" onClose={() => setShowAddProjectModal(false)}>
          <div className="space-y-4 text-xs">
            <p className="text-[var(--color-ink-600)]">
              Choose from your completed capstone projects to feature in your developer portfolio:
            </p>

            {eligibleCompletedProjects.length > 0 ? (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {eligibleCompletedProjects.map(proj => (
                  <div
                    key={proj.id}
                    className="p-3 rounded-[var(--radius-md)] border border-[var(--color-line)] hover:border-[var(--color-harbor-400)] transition-colors flex items-center justify-between gap-3"
                  >
                    <div>
                      <h4 className="font-semibold text-[var(--color-ink-900)]">{proj.title}</h4>
                      <p className="text-[11px] text-[var(--color-ink-400)]">{proj.course_name} · Score: {proj.submission.score}/100</p>
                    </div>
                    <button
                      onClick={() => handleAddProjectToPortfolio(proj)}
                      className="px-3 py-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] text-white font-semibold text-[11px] hover:bg-[var(--color-harbor-600)] shrink-0"
                    >
                      Add Project
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-[var(--color-ink-400)] bg-[var(--color-surface)] rounded-[var(--radius-md)]">
                All completed projects have already been added to your portfolio showcase!
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowAddProjectModal(false)}
                className="px-4 py-2 border border-[var(--color-line)] rounded-[var(--radius-md)] text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT PORTFOLIO DETAILS */}
      {/* ========================================================================= */}
      {editingItem && (
        <Modal title="Edit Portfolio Details" onClose={() => setEditingItem(null)}>
          <form onSubmit={handleSavePortfolioEdit} className="space-y-3 text-xs">
            <Field label="Project Title">
              <input
                required
                className="input"
                value={editingItem.title}
                onChange={e => setEditingItem({ ...editingItem, title: e.target.value })}
              />
            </Field>

            <Field label="Headline / Tagline">
              <input
                required
                className="input"
                value={editingItem.tagline}
                onChange={e => setEditingItem({ ...editingItem, tagline: e.target.value })}
              />
            </Field>

            <Field label="Role in Project">
              <input
                className="input"
                value={editingItem.role}
                onChange={e => setEditingItem({ ...editingItem, role: e.target.value })}
                placeholder="e.g. Lead Frontend Developer"
              />
            </Field>

            <Field label="Summary Description">
              <textarea
                rows={3}
                className="input"
                value={editingItem.summary_description}
                onChange={e => setEditingItem({ ...editingItem, summary_description: e.target.value })}
              />
            </Field>

            <Field label="Tech Stack (Comma-separated)">
              <input
                className="input"
                value={editingItem.tech_stack.join(', ')}
                onChange={e =>
                  setEditingItem({
                    ...editingItem,
                    tech_stack: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                  })
                }
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Live Demo URL">
                <input
                  type="url"
                  className="input"
                  value={editingItem.live_demo_url}
                  onChange={e => setEditingItem({ ...editingItem, live_demo_url: e.target.value })}
                />
              </Field>
              <Field label="Repository URL">
                <input
                  type="url"
                  className="input"
                  value={editingItem.repo_url}
                  onChange={e => setEditingItem({ ...editingItem, repo_url: e.target.value })}
                />
              </Field>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[var(--color-line)]">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingItem.visibility === 'public'}
                  onChange={e =>
                    setEditingItem({
                      ...editingItem,
                      visibility: e.target.checked ? 'public' : 'private',
                    })
                  }
                  className="rounded border-gray-300 text-[var(--color-harbor-600)]"
                />
                <span className="font-medium text-[var(--color-ink-700)]">Public Showcase</span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-3 py-2 border border-[var(--color-line)] rounded-[var(--radius-md)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[var(--color-harbor-500)] text-white font-semibold rounded-[var(--radius-md)]"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PUBLIC PORTFOLIO PREVIEW */}
      {/* ========================================================================= */}
      {showPublicPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-3xl rounded-[var(--radius-lg)] bg-white p-6 shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-4 mb-6">
              <div>
                <span className="text-[11px] font-bold uppercase text-[var(--color-harbor-600)] tracking-wider">
                  Live Public Preview
                </span>
                <h2 className="font-display text-lg font-bold text-[var(--color-ink-900)]">
                  Student Developer Showcase
                </h2>
              </div>
              <button
                onClick={() => setShowPublicPreviewModal(false)}
                className="text-xs px-3 py-1.5 border border-[var(--color-line)] rounded-[var(--radius-md)] hover:bg-[var(--color-surface)]"
              >
                ✕ Close Preview
              </button>
            </div>

            {/* Profile banner */}
            <div className="p-6 rounded-[var(--radius-lg)] bg-gradient-to-r from-[var(--color-surface)] to-[var(--color-harbor-50)] border border-[var(--color-line)] mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-[var(--color-harbor-500)] text-white font-display text-xl font-bold flex items-center justify-center shadow-md">
                {user?.name.slice(0, 2).toUpperCase() || 'ST'}
              </div>
              <div>
                <h3 className="font-display text-xl font-bold text-[var(--color-ink-900)]">
                  {user?.name || 'Fellow Graduate'}
                </h3>
                <p className="text-xs text-[var(--color-harbor-600)] font-semibold mt-0.5">
                  Frontend Software Engineering Fellow · Cohort Alpha
                </p>
                <p className="text-xs text-[var(--color-ink-500)] mt-1 max-w-lg">
                  Specializing in React, TypeScript, and accessible UI architectures. Verifiable credentials backed by the Ijesha Digital Skills Training Hub.
                </p>
              </div>
            </div>

            {/* Projects list in preview */}
            <div className="space-y-4">
              <h4 className="font-display text-sm font-bold text-[var(--color-ink-900)]">
                Featured Projects ({portfolioItems.filter(p => p.visibility === 'public').length})
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {portfolioItems
                  .filter(p => p.visibility === 'public')
                  .map(p => (
                    <div key={p.id} className="rounded-[var(--radius-md)] border border-[var(--color-line)] overflow-hidden bg-white shadow-xs flex flex-col justify-between">
                      <img src={p.cover_image} alt={p.title} className="h-32 w-full object-cover" />
                      <div className="p-4 space-y-2">
                        <h5 className="font-display text-sm font-bold text-[var(--color-ink-900)]">{p.title}</h5>
                        <p className="text-[11px] text-[var(--color-ink-600)] line-clamp-2">{p.summary_description}</p>
                        <div className="flex flex-wrap gap-1 pt-1">
                          {p.tech_stack.map((t, idx) => (
                            <span key={idx} className="text-[10px] px-2 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-ink-700)]">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="p-3 bg-[var(--color-surface)] border-t border-[var(--color-line)] flex items-center justify-between text-xs">
                        <a href={p.live_demo_url} target="_blank" rel="noreferrer" className="text-[var(--color-harbor-600)] font-semibold inline-flex items-center gap-1 hover:underline">
                          <ExternalLink size={12} /> Live App
                        </a>
                        <a href={p.repo_url} target="_blank" rel="noreferrer" className="text-[var(--color-ink-700)] font-medium inline-flex items-center gap-1 hover:underline">
                          <Code2 size={12} /> Source
                        </a>
                      </div>
                    </div>
                  ))}
              </div>
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
              {activeTab === 'portfolio' ? 'Clear Portfolio Items?' : 'Clear Projects Data?'}
            </h2>
            <p className="text-xs text-[var(--color-ink-500)] leading-relaxed">
              {activeTab === 'portfolio'
                ? 'This will permanently remove your curated portfolio projects and showcase items.'
                : 'This will wipe all active project work, submission drafts, and portfolio deliverables for a clean slate.'}
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
                onClick={handleClearAllProjects}
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
