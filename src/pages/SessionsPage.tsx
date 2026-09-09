import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/shell/PageHeader'
import { Card } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { Field } from '@/components/ui/Field'
import { SessionRelated } from '@/components/SessionRelated'
import { cohortRequest, getAllCohorts, type Cohort } from '@/lib/cohorts'

type Course = { id: string; title: string; trainer_id: string | null }
type Trainer = { id: string; full_name: string }
type Session = { id: string; topic: string; week_number?: number | null; cohort_id: string; app_trainer_id: string | null; starts_at: string; ends_at: string | null; description?: string; session_type?: string; location?: string; meeting_link?: string; status: string }
const empty = { topic: '', week_number: '', course: '', cohort_id: '', trainer_id: '', date: '', start: '', end: '', description: '', session_type: 'physical', location: '', meeting_link: '', status: 'scheduled' }
const button = 'rounded-lg bg-[var(--color-harbor-600)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50'
const localParts = (value: string) => {
  const date = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return { date: date.getFullYear() + '-' + pad(date.getMonth()+1) + '-' + pad(date.getDate()), time: pad(date.getHours()) + ':' + pad(date.getMinutes()) }
}
export function SessionsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [sessions, setSessions] = useState<Session[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [form, setForm] = useState(empty)
  const selected = sessions.find(s => s.id === id)
  const selectedCourse = courses.find(c => c.id === form.course)
  const availableCohorts = cohorts.filter(c => c.app_course_id === form.course)
  const availableTrainers = trainers.filter(t => t.id === selectedCourse?.trainer_id)
  const schedule = cohorts.find(c => c.id === form.cohort_id)
  const weekCount = schedule?.starts_on && schedule.ends_on
    ? Math.max(1, Math.ceil((Date.parse(schedule.ends_on) - Date.parse(schedule.starts_on) + 86400000) / 604800000)) : 52
  function dateForWeek(week: number) {
    if(!schedule?.starts_on) return ''
    return new Date(Date.parse(schedule.starts_on) + (week - 1) * 604800000).toISOString().slice(0,10)
  }
  const weeks = [...new Set(sessions.map(s => s.week_number ?? 0))].sort((a,b)=>a-b)

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([
      cohortRequest<{ sessions: Session[] }>('/api/sessions'),
      cohortRequest<{ courses: Course[] }>('/api/courses'),
      getAllCohorts(),
      cohortRequest<{ trainers: Trainer[] }>('/api/session-trainers'),
    ]).then(([s,c,h,t]) => { if(active) {
      setSessions(s.sessions); setCourses(c.courses); setCohorts(h); setTrainers(t.trainers)
      if(searchParams.get('create') === '1') {
        const cohort = h.find(row=>row.id===searchParams.get('cohort'))
        setForm({...empty,cohort_id:cohort?.id??'',course:cohort?.app_course_id??''})
        setOpen(true)
      }
    } })
      .catch(e => { if(active) setError(e.message) })
      .finally(() => { if(active) setLoading(false) })
    return () => { active = false }
  }, [])

  function begin(session?: Session) {
    setError(''); setEditing(session?.id ?? null)
    if(session) {
      const start = localParts(session.starts_at)
      setForm({ topic: session.topic, week_number: String(session.week_number ?? ''), course: cohorts.find(c => c.id === session.cohort_id)?.app_course_id ?? '', cohort_id: session.cohort_id,
        trainer_id: session.app_trainer_id ?? '', date: start.date, start: start.time,
        end: session.ends_at ? localParts(session.ends_at).time : '', description: session.description ?? '', session_type: session.session_type ?? 'physical',
        location: session.location ?? '', meeting_link: session.meeting_link ?? '', status: session.status })
    } else setForm(empty)
    setOpen(true)
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if(saving) return
    const start = new Date(form.date + 'T' + form.start)
    const end = new Date(form.date + 'T' + form.end)
    if(!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) { setError('End time must be after start time.'); return }
    if(!availableTrainers.some(t => t.id === form.trainer_id) || !availableCohorts.some(c => c.id === form.cohort_id)) { setError('Choose a cohort and trainer assigned to this course.'); return }
    setSaving(true); setError('')
    try {
      const result = await cohortRequest<{session:Session}>('/api/sessions' + (editing ? '/' + editing : ''), {
        method: editing ? 'PATCH' : 'POST', body: JSON.stringify({ ...form, schedule_date: form.date, starts_at: start.toISOString(), ends_at: end.toISOString() }),
      })
      setSessions(current => [result.session, ...current.filter(s => s.id !== result.session.id)])
      setOpen(false); setNotice(editing ? 'Session updated successfully.' : 'Session created successfully.')
      navigate('/sessions/' + result.session.id)
    } catch(e) { setError(e instanceof Error ? e.message : 'Unable to save session.') }
    finally { setSaving(false) }
  }
  async function cancelSession() {
    if(!selected || saving) return
    setSaving(true); setError('')
    try {
      const result = await cohortRequest<{session:Session}>('/api/sessions/' + selected.id, {method:'PATCH',body:JSON.stringify({status:'cancelled'})})
      setSessions(current => current.map(s => s.id === result.session.id ? result.session : s))
      setCancelOpen(false); setNotice('Session cancelled.')
    } catch(e) { setError(e instanceof Error ? e.message : 'Unable to cancel session.') }
    finally { setSaving(false) }
  }

  return <div className="space-y-5">
    {id && <Link to="/sessions" className="text-[var(--color-harbor-600)]">← Training Sessions</Link>}
    <PageHeader title={id ? selected?.topic ?? 'Session Details' : 'Training Sessions'} subtitle="Schedule and manage course sessions." actions={!id && !loading ? <button className={button} onClick={() => begin()}>+ Add Session</button> : undefined}/>
    {notice && <p role="status" className="text-[var(--color-success-600)]">{notice}</p>}
    {error && !open && <p role="alert" className="text-[var(--color-danger-600)]">{error}</p>}
    {loading ? <Card className="p-6">Loading sessions…</Card> : id ? selected ? <>
      <Card className="p-5"><dl className="grid gap-4 sm:grid-cols-2">
        {Object.entries({
          Course: courses.find(c => c.id === cohorts.find(h => h.id === selected.cohort_id)?.app_course_id)?.title ?? 'Unassigned',
          Cohort: cohorts.find(c => c.id === selected.cohort_id)?.name ?? 'Unassigned',
          Trainer: trainers.find(t => t.id === selected.app_trainer_id)?.full_name ?? 'Unassigned',
          Date: new Date(selected.starts_at).toLocaleDateString(),
          Week: selected.week_number ? 'Week ' + selected.week_number : 'Not assigned',
          'Start time': new Date(selected.starts_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}),
          'End time': selected.ends_at ? new Date(selected.ends_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : 'Not set',
          'Session type': selected.session_type ?? 'physical', Location: selected.location || '—',
          Description: selected.description || '—', Status: selected.status,
        }).map(([label,value]) => <div key={label}><dt className="text-sm text-[var(--color-ink-500)]">{label}</dt><dd className="whitespace-pre-wrap">{value}</dd></div>)}
        {selected.meeting_link && /^https?:\/\//i.test(selected.meeting_link) && <div><dt>Meeting link</dt><dd><a className="text-[var(--color-harbor-600)]" href={selected.meeting_link} target="_blank" rel="noreferrer">Open meeting</a></dd></div>}
      </dl></Card>
      <div className="flex gap-3"><button className={button} onClick={() => begin(selected)}>Edit Session</button><button className="rounded-lg border p-2" disabled={selected.status === 'cancelled'} onClick={() => setCancelOpen(true)}>Cancel Session</button></div>
      <SessionRelated key={selected.id} sessionId={selected.id}/>
    </> : <Card className="p-6">Session not found or unavailable to your account.</Card> :
      <div className="space-y-4">{sessions.length ? weeks.map(week => <details key={week} open className="rounded-lg border border-[var(--color-line)] p-4"><summary className="cursor-pointer font-semibold">{week ? 'Week ' + week : 'Week not assigned'}</summary><div className="mt-4 grid gap-3 md:grid-cols-2">{sessions.filter(s => (s.week_number ?? 0) === week).sort((a,b)=>a.starts_at.localeCompare(b.starts_at)).map(s => <Link key={s.id} to={'/sessions/' + s.id} className="rounded-lg focus:ring-2"><Card className="h-full p-5"><h2 className="font-semibold">{s.topic}</h2><p>{cohorts.find(c => c.id === s.cohort_id)?.name ?? 'Unassigned cohort'}</p><p className="text-sm">{new Date(s.starts_at).toLocaleString()} {s.ends_at ? '– ' + new Date(s.ends_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : ''}</p><p className="text-sm">{trainers.find(t=>t.id===s.app_trainer_id)?.full_name ?? 'Unassigned trainer'} · {s.session_type ?? 'physical'}</p><p className="mt-2 text-sm capitalize">{s.status}</p></Card></Link>)}</div></details>) : <Card className="p-6">No sessions yet.</Card>}</div>}
    {open && <Modal title={editing ? 'Edit Session' : 'Add Session'} onClose={() => { if(!saving) setOpen(false) }}><form className="space-y-4" onSubmit={save}>
      {error && <p role="alert" className="text-[var(--color-danger-600)]">{error}</p>}
      <Field label="Session Title *"><input className="input" required value={form.topic} onChange={e=>setForm({...form,topic:e.target.value})}/></Field>
      <Field label="Course *"><select className="input" required value={form.course} onChange={e=>setForm({...form,course:e.target.value,cohort_id:'',trainer_id:''})}><option value="">Choose course</option>{courses.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></Field>
      <Field label="Cohort *"><select className="input" required disabled={!form.course} value={form.cohort_id} onChange={e=>setForm({...form,cohort_id:e.target.value})}><option value="">{availableCohorts.length ? 'Choose cohort' : 'No cohorts assigned'}</option>{availableCohorts.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <Field label="Trainer *"><select className="input" required disabled={!form.course} value={form.trainer_id} onChange={e=>setForm({...form,trainer_id:e.target.value})}><option value="">{availableTrainers.length ? 'Choose trainer' : 'No trainer assigned to this course'}</option>{availableTrainers.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}</select></Field>
      <Field label="Week *"><select className="input" required disabled={!form.cohort_id} value={form.week_number} onChange={e=>setForm({...form,week_number:e.target.value,date:dateForWeek(Number(e.target.value))})}><option value="">Choose training week</option>{Array.from({length:Math.min(520,weekCount)},(_,i)=><option key={i+1} value={i+1}>Week {i+1}</option>)}</select></Field>
      {!schedule?.starts_on && form.cohort_id && <p className="text-sm">This cohort has no start date. Select the week and date manually.</p>}
      <Field label="Date *"><input className="input" required type="date" min={schedule?.starts_on ?? undefined} max={schedule?.ends_on ?? undefined} value={form.date} onChange={e=>{const value=e.target.value; setForm({...form,date:value,week_number:schedule?.starts_on && value ? String(Math.floor((Date.parse(value)-Date.parse(schedule.starts_on))/604800000)+1) : form.week_number})}}/></Field>
      <div className="grid grid-cols-2 gap-3"><Field label="Start Time *"><input className="input" required type="time" value={form.start} onChange={e=>setForm({...form,start:e.target.value})}/></Field><Field label="End Time *"><input className="input" required type="time" value={form.end} onChange={e=>setForm({...form,end:e.target.value})}/></Field></div>
      <Field label="Session Description"><textarea className="input min-h-28" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></Field>
      <Field label="Session Type"><select className="input" value={form.session_type} onChange={e=>setForm({...form,session_type:e.target.value})}>{['physical','online','hybrid'].map(t=><option key={t} value={t}>{t[0].toUpperCase()+t.slice(1)}</option>)}</select></Field>
      {form.session_type !== 'online' && <Field label="Location *"><input className="input" required value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></Field>}
      {form.session_type !== 'physical' && <Field label="Meeting link *"><input className="input" type="url" required value={form.meeting_link} onChange={e=>setForm({...form,meeting_link:e.target.value})}/></Field>}
      <Field label="Session Status"><select className="input" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{['scheduled','completed','cancelled'].map(s=><option key={s} value={s}>{s[0].toUpperCase()+s.slice(1)}</option>)}</select></Field>
      <div className="flex justify-end gap-3"><button type="button" disabled={saving} onClick={()=>setOpen(false)}>Cancel</button><button className={button} disabled={saving || !availableTrainers.length || !availableCohorts.length}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Session'}</button></div>
    </form></Modal>}
    {cancelOpen && <Modal title="Cancel Session" onClose={()=>{if(!saving)setCancelOpen(false)}}><p>Cancel this session? Its records will be kept.</p><div className="mt-4 flex gap-3"><button disabled={saving} onClick={()=>setCancelOpen(false)}>Keep Session</button><button className={button} disabled={saving} onClick={()=>void cancelSession()}>Confirm Cancellation</button></div></Modal>}
  </div>
}
