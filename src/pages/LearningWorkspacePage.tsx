import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import { Badge, Card } from '@/components/ui/primitives'
import { Field } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/app/auth'
import { apiUrl } from '@/app/auth'

type Kind = 'classwork' | 'assignment' | 'assessment' | 'project'
type Item = { id: string; item_type: Kind; title: string; instructions: string; due_at: string | null; maximum_score: number; status: string; cohorts?: { name?: string; courses?: { name?: string } } }
type Cohort = { id: string; name: string; courseName: string }
type Submission = { id: string; response: string; submitted_at: string | null; score: number | null; feedback: string | null; students?: { full_name?: string; email?: string } }
const label = (kind: Kind) => kind === 'classwork' ? 'Classwork' : kind === 'assignment' ? 'Assignment' : kind === 'assessment' ? 'Assessment' : 'Project'

export function LearningWorkspacePage({ kind }: { kind: Kind | 'grading' | 'results' }) {
  const { role } = useAuth()
  const staff = ['admin', 'manager', 'trainer'].includes(role ?? '')
  const [items, setItems] = useState<Item[]>([])
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [error, setError] = useState('')
  const [busy,setBusy] = useState(false)
  const run = async (task:()=>Promise<void>) => { setBusy(true);setError('');try{await task()}catch(err){setError(err instanceof Error?err.message:'Unable to connect to the learning service.')}finally{setBusy(false)} }
  const [createOpen, setCreateOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [instructions, setInstructions] = useState('')
  const [cohortId, setCohortId] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [maximumScore, setMaximumScore] = useState('100')
  const [selected, setSelected] = useState<Item | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [response, setResponse] = useState('')
    const [grades, setGrades] = useState<Record<string, { score: string; feedback: string }>>({})

  const load = async () => {
    const result = await fetch(apiUrl('/api/learning/items'), { credentials: 'include' })
    const data = await result.json().catch(() => ({}))
    if (!result.ok) { setError(data.error || 'Unable to load learning work.'); return }
    setItems(data.items ?? [])
    if (staff) {
      const cohortResult = await fetch(apiUrl('/api/learning/cohorts'), { credentials: 'include' })
      const cohortData = await cohortResult.json().catch(() => ({}))
      if (cohortResult.ok) setCohorts(cohortData.cohorts ?? [])
    }
  }
  useEffect(() => { void run(load) }, [role])
  const visible = useMemo(() => kind === 'grading' || kind === 'results' ? items : items.filter((item) => item.item_type === kind), [items, kind])
  const heading = kind === 'grading' ? 'Grading Queue' : kind === 'results' ? 'Results' : label(kind)
  const create = async () => {
    if (!title.trim() || !cohortId || !staff || kind === 'grading' || kind === 'results') return
    const result = await fetch(apiUrl('/api/learning/items'), { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ itemType: kind, title, instructions, cohortId, dueAt, maximumScore }) })
    const data = await result.json().catch(() => ({}))
    if (!result.ok) { setError(data.error || 'Unable to create work.'); return }
    setCreateOpen(false); setTitle(''); setInstructions(''); setCohortId(''); setDueAt(''); setMaximumScore('100'); await load()
  }
  const openItem = async (item: Item) => {
    setSelected(item); setResponse(''); setGrades({}); setSubmissions([])
    if (staff) { const result = await fetch(apiUrl(`/api/learning/items/${item.id}/submissions`), { credentials: 'include' }); const data = await result.json().catch(() => ({})); if (result.ok) setSubmissions(data.submissions ?? []); else setError(data.error || 'Unable to load submissions.') }
  }
  const submit = async () => {
    if (!selected || !response.trim()) return
    const result = await fetch(apiUrl(`/api/learning/items/${selected.id}/submissions`), { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ response }) })
    const data = await result.json().catch(() => ({})); if (!result.ok) setError(data.error || 'Unable to submit work.'); else { setResponse(''); setSelected(null); await load() }
  }
  const grade = async (submission: Submission) => {
    const result = await fetch(apiUrl(`/api/learning/submissions/${submission.id}/grade`), { method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ score: grades[submission.id]?.score ?? String(submission.score ?? ''), feedback: grades[submission.id]?.feedback ?? submission.feedback ?? '' }) })
    const data = await result.json().catch(() => ({})); if (!result.ok) setError(data.error || 'Unable to save grade.'); else await openItem(selected!)
  }
  return <div className="space-y-6"><PageHeader title={heading} subtitle={kind === 'results' ? 'Grades are created from evaluated student submissions.' : staff ? 'Create work, review submissions, and keep learning records shared across accounts.' : 'View your assigned learning work and submit your response.'} actions={staff && !['grading', 'results'].includes(kind) ? <button onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-4 py-2 text-sm font-semibold text-white"><Plus size={16}/>Add {label(kind as Kind)}</button> : undefined}/>{error && <p className="text-sm text-[var(--color-danger-600)]">{error}</p>}<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.map((item) => <Card key={item.id} className="p-5"><div className="flex items-start justify-between gap-3"><div><Badge tone={item.status === 'published' ? 'success' : 'warning'}>{label(item.item_type)}</Badge><h2 className="mt-3 font-display text-lg font-bold">{item.title}</h2></div><span className="text-sm font-semibold">{item.maximum_score} pts</span></div><p className="mt-2 text-sm text-[var(--color-ink-600)]">{item.instructions || 'No instructions provided.'}</p><p className="mt-3 text-xs text-[var(--color-ink-500)]">{item.cohorts?.name || '—'} · Due {item.due_at ? new Date(item.due_at).toLocaleDateString() : 'Not set'}</p><button onClick={() => void run(()=>openItem(item))} className="mt-4 text-sm font-semibold text-[var(--color-harbor-700)]">{staff ? 'View submissions' : 'Open & submit'} →</button></Card>)}</div>{visible.length === 0 && <Card className="p-10 text-center text-sm text-[var(--color-ink-500)]">No {kind === 'results' ? 'graded results' : 'learning work'} yet.</Card>}{createOpen && <Modal title={`Add ${label(kind as Kind)}`} onClose={() => setCreateOpen(false)}><div className="space-y-4">{error&&<p role="alert" className="text-[var(--color-danger-600)]">{error}</p>}<Field label="Title"><input className="input" value={title} onChange={(event) => setTitle(event.target.value)} /></Field><Field label="Cohort"><select className="input" value={cohortId} onChange={(event) => setCohortId(event.target.value)}><option value="">Select a cohort</option>{cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.name} ({cohort.courseName})</option>)}</select></Field><Field label="Instructions"><textarea className="input min-h-24" value={instructions} onChange={(event) => setInstructions(event.target.value)} /></Field><div className="grid grid-cols-2 gap-3"><Field label="Due date"><input className="input" type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></Field><Field label="Maximum score"><input className="input" type="number" min="1" value={maximumScore} onChange={(event) => setMaximumScore(event.target.value)} /></Field></div><button disabled={busy || !title.trim() || !cohortId} onClick={() => void run(create)} className="rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Publish</button></div></Modal>}{selected && <Modal title={selected.title} onClose={() => setSelected(null)}>{error&&<p role="alert" className="mb-3 text-[var(--color-danger-600)]">{error}</p>}{staff ? <div className="space-y-4">{submissions.length ? submissions.map((submission) => <Card key={submission.id} className="p-4"><p className="font-semibold">{submission.students?.full_name || 'Student'}</p><p className="mt-2 text-sm text-[var(--color-ink-600)]">{submission.response}</p><p className="mt-2 text-xs text-[var(--color-ink-500)]">{submission.submitted_at ? `Submitted ${new Date(submission.submitted_at).toLocaleString()}` : 'Draft'}</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><input className="input" type="number" placeholder={`Score / ${selected.maximum_score}`} min="0" max={selected.maximum_score} aria-label="Score" value={grades[submission.id]?.score ?? String(submission.score ?? '')} onChange={(event) => setGrades(current => ({ ...current, [submission.id]: { feedback: current[submission.id]?.feedback ?? submission.feedback ?? '', score: event.target.value } }))} /><input className="input" placeholder="Feedback" aria-label="Feedback" value={grades[submission.id]?.feedback ?? submission.feedback ?? ''} onChange={(event) => setGrades(current => ({ ...current, [submission.id]: { score: current[submission.id]?.score ?? String(submission.score ?? ''), feedback: event.target.value } }))} /></div><button disabled={busy} onClick={() => void run(()=>grade(submission))} className="mt-2 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-3 py-1.5 text-xs font-semibold text-white">Save grade</button></Card>) : <p className="text-sm text-[var(--color-ink-500)]">No student submissions yet.</p>}</div> : <div className="space-y-4"><p className="text-sm text-[var(--color-ink-600)]">{selected.instructions}</p><Field label="Your response"><textarea className="input min-h-32" value={response} onChange={(event) => setResponse(event.target.value)} /></Field><button disabled={busy || !response.trim()} onClick={() => void run(submit)} className="rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Submit work</button></div>}</Modal>}</div>
}
