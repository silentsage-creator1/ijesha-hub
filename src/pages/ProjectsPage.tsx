import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Search, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import { Badge, Card } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { Field } from '@/components/ui/Field'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/auth'
import { clearProjectsData } from '@/lib/clearData'

type Course = { id: string; name: string }
type Cohort = { id: string; name: string; course_id: string }
type Project = { id: string; title: string; description: string | null; cohort_id: string; status: 'draft' | 'published' | 'closed'; due_at: string | null; maximum_score: number | null }

export function ProjectsPage() {
  const { role } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const canManage = ['admin', 'manager', 'trainer'].includes(role ?? '')
  const [courses, setCourses] = useState<Course[]>([])
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [query, setQuery] = useState('')
  const [courseId, setCourseId] = useState('')
  const [cohortId, setCohortId] = useState('')
  const [status, setStatus] = useState('')
  const [open, setOpen] = useState(() => searchParams.get('create') === '1')
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    const [courseResult, cohortResult, projectResult] = await Promise.all([
      supabase.from('courses').select('id,name').order('name'),
      supabase.from('cohorts').select('id,name,course_id').order('name'),
      supabase.from('projects').select('id,title,description,cohort_id,status,due_at,maximum_score').order('created_at', { ascending: false }),
    ])
    const loadError = courseResult.error ?? cohortResult.error ?? projectResult.error
    if (loadError) setError(loadError.message)
    else {
      setCourses((courseResult.data ?? []) as Course[])
      setCohorts((cohortResult.data ?? []) as Cohort[])
      setProjects((projectResult.data ?? []) as Project[])
    }
  }

  useEffect(() => {
    load()
    const handleSync = () => {
      load()
    }
    window.addEventListener('app-data-cleared', handleSync)
    window.addEventListener('student-projects-updated', handleSync)
    return () => {
      window.removeEventListener('app-data-cleared', handleSync)
      window.removeEventListener('student-projects-updated', handleSync)
    }
  }, [])

  const handleDeleteProject = async (projectId: string) => {
    try {
      await supabase.from('project_submissions').delete().eq('project_id', projectId)
      await supabase.from('projects').delete().eq('id', projectId)
    } catch (e) {
      console.warn('Database delete failed or offline:', e)
    }
    setProjects(prev => prev.filter(p => p.id !== projectId))
  }

  const handleClearAllProjects = async () => {
    setClearing(true)
    try {
      await supabase.from('project_submissions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('projects').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    } catch (e) {
      console.warn('Database clear failed or offline:', e)
    }
    clearProjectsData()
    setProjects([])
    setClearing(false)
    setShowClearConfirm(false)
  }

  const availableCohorts = cohorts.filter(item => !courseId || item.course_id === courseId)
  const visibleProjects = useMemo(() => projects.filter(project => {
    const cohort = cohorts.find(item => item.id === project.cohort_id)
    return (!query || project.title.toLowerCase().includes(query.toLowerCase()))
      && (!courseId || cohort?.course_id === courseId)
      && (!cohortId || project.cohort_id === cohortId)
      && (!status || project.status === status)
  }), [projects, cohorts, query, courseId, cohortId, status])
  const courseName = (id: string) => courses.find(course => course.id === id)?.name ?? 'Course'
  const cohortName = (id: string) => cohorts.find(cohort => cohort.id === id)?.name ?? 'Cohort'

  return <div>
    <PageHeader
      title="Projects"
      subtitle="Create, publish, submit, and review cohort project work."
      actions={
        canManage ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              disabled={projects.length === 0}
              className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-rose-200 bg-rose-50 hover:bg-rose-100 px-3 py-2 text-sm font-semibold text-rose-700 shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 size={15} />
              <span>Clear All Projects</span>
            </button>
            <button
              onClick={() => setOpen(true)}
              className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-harbor-600)] transition-colors shadow-xs"
            >
              <Plus size={16} />
              Add Project
            </button>
          </div>
        ) : undefined
      }
    />
    {error && <p className="mb-4 rounded-md bg-[var(--color-danger-100)] p-3 text-sm text-[var(--color-danger-600)]">{error}</p>}
    <Card className="mb-5 grid gap-3 p-4 md:grid-cols-4">
      <label className="relative"><Search className="absolute left-3 top-3 text-[var(--color-ink-400)]" size={16} /><input className="input pl-9" placeholder="Search projects" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <select className="input" value={courseId} onChange={event => { setCourseId(event.target.value); setCohortId('') }}><option value="">All courses</option>{courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}</select>
      <select className="input" value={cohortId} onChange={event => setCohortId(event.target.value)}><option value="">All cohorts</option>{availableCohorts.map(cohort => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}</select>
      <select className="input" value={status} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option><option value="draft">Draft</option><option value="published">Published</option><option value="closed">Closed</option></select>
    </Card>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {visibleProjects.map(project => (
        <Card key={project.id} className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex justify-between gap-3">
              <div>
                <p className="font-display text-lg font-semibold">{project.title}</p>
                <p className="mt-1 text-sm text-[var(--color-ink-500)]">
                  {courseName(cohorts.find(item => item.id === project.cohort_id)?.course_id ?? '')} · {cohortName(project.cohort_id)}
                </p>
              </div>
              <Badge tone={project.status === 'published' ? 'success' : project.status === 'draft' ? 'warning' : 'neutral'}>
                {project.status}
              </Badge>
            </div>
            <p className="mt-3 line-clamp-2 text-sm text-[var(--color-ink-600)]">
              {project.description || 'No project summary provided.'}
            </p>
            <p className="mt-3 text-xs text-[var(--color-ink-400)]">
              Due: {project.due_at ? new Date(project.due_at).toLocaleDateString() : 'No due date'} · {project.maximum_score ?? '—'} points
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[var(--color-line)] flex items-center justify-between">
            <Link to={`/projects/${project.id}`} className="text-sm font-semibold text-[var(--color-harbor-600)] hover:underline">
              Open project →
            </Link>
            {canManage && (
              <button
                type="button"
                onClick={() => handleDeleteProject(project.id)}
                className="p-1.5 text-[var(--color-danger-600)] hover:bg-rose-50 rounded-md transition-colors"
                title="Delete project"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </Card>
      ))}
      {!visibleProjects.length && <Card className="p-8 text-center text-sm text-[var(--color-ink-400)]">No projects match these filters.</Card>}
    </div>
    {open && <ProjectForm courses={courses} cohorts={cohorts} onClose={() => setOpen(false)} onSaved={id => { setOpen(false); navigate(`/projects/${id}`) }} />}

    {/* Clear Confirmation Modal */}
    {showClearConfirm && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl p-6 space-y-4 border border-[var(--color-line)] text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <Trash2 size={24} />
          </div>
          <h2 className="text-base font-bold text-[var(--color-ink-900)]">
            Clear All Projects?
          </h2>
          <p className="text-xs text-[var(--color-ink-500)] leading-relaxed">
            This will permanently remove all project assignments, student deliverables, and portfolio records. You will start with an empty project workspace.
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
              disabled={clearing}
              onClick={handleClearAllProjects}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-xs font-semibold rounded-lg text-white shadow-xs transition-colors disabled:opacity-50"
            >
              {clearing ? 'Clearing…' : 'Yes, Clear All'}
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
}

function ProjectForm({ courses, cohorts, onClose, onSaved }: { courses: Course[]; cohorts: Cohort[]; onClose: () => void; onSaved: (id: string) => void }) {
  const { profile } = useAuth()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [courseId, setCourseId] = useState('')
  const [cohortId, setCohortId] = useState('')
  const [instructions, setInstructions] = useState('')
  const [startAt, setStartAt] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [submissionType, setSubmissionType] = useState('text')
  const [maximumScore, setMaximumScore] = useState('100')
  const [allowResubmission, setAllowResubmission] = useState(true)
  const [resourceLinks, setResourceLinks] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const visibleCohorts = cohorts.filter(item => item.course_id === courseId)
  const save = async (event: FormEvent, publish: boolean) => {
    event.preventDefault()
    if (!title.trim()) return setError('Project title is required.')
    if (!cohortId) return setError('Choose the cohort receiving this project.')
    setSaving(true); setError(null)
    const result = await supabase.from('projects').insert({ title: title.trim(), description: description.trim() || null, cohort_id: cohortId, instructions: instructions.trim() || null, start_at: startAt || null, due_at: dueAt || null, submission_type: submissionType, maximum_score: maximumScore ? Number(maximumScore) : null, allow_resubmission: allowResubmission, resources: resourceLinks.split('\n').map(item => item.trim()).filter(Boolean), status: publish ? 'published' : 'draft', created_by: profile?.id ?? null }).select('id').single()
    setSaving(false)
    if (result.error) setError(result.error.message); else onSaved(result.data.id)
  }
  return <Modal title="Add Project" onClose={onClose}><form className="space-y-3" onSubmit={event => save(event, false)}>
    <Field label="Project title"><input required className="input" value={title} onChange={event => setTitle(event.target.value)} placeholder="Enter project title" /></Field>
    <Field label="Project summary"><textarea className="input min-h-20" value={description} onChange={event => setDescription(event.target.value)} placeholder="A short description for students" /></Field>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Course"><select required className="input" value={courseId} onChange={event => { setCourseId(event.target.value); setCohortId('') }}><option value="">Choose course</option>{courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}</select></Field><Field label="Cohort"><select required className="input" value={cohortId} onChange={event => setCohortId(event.target.value)}><option value="">Choose cohort</option>{visibleCohorts.map(cohort => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}</select></Field></div>
    <Field label="Instructions"><textarea className="input min-h-28" value={instructions} onChange={event => setInstructions(event.target.value)} placeholder="What students need to do" /></Field>
    <Field label="Resource links"><textarea className="input min-h-16" value={resourceLinks} onChange={event => setResourceLinks(event.target.value)} placeholder="One supporting link per line (optional)" /></Field>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Start date"><input type="datetime-local" className="input" value={startAt} onChange={event => setStartAt(event.target.value)} /></Field><Field label="Due date"><input type="datetime-local" className="input" value={dueAt} onChange={event => setDueAt(event.target.value)} /></Field></div>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Submission format"><select className="input" value={submissionType} onChange={event => setSubmissionType(event.target.value)}><option value="text">Written response</option><option value="link">Project link</option><option value="multiple_files">Files / links</option></select></Field><Field label="Maximum score"><input type="number" min="0" className="input" value={maximumScore} onChange={event => setMaximumScore(event.target.value)} /></Field></div>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allowResubmission} onChange={event => setAllowResubmission(event.target.checked)} />Allow resubmission when a revision is requested</label>
    {error && <p className="text-sm text-[var(--color-danger-600)]">{error}</p>}
    <div className="flex gap-2"><button disabled={saving} className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3.5 py-2 text-sm font-semibold">Save Draft</button><button type="button" disabled={saving} onClick={event => save(event as unknown as FormEvent, true)} className="rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-3.5 py-2 text-sm font-semibold text-white">Publish Project</button></div>
  </form></Modal>
}
