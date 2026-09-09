import { useEffect, useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import { Card } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { Field } from '@/components/ui/Field'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/auth'
import { cohortRequest, getAllCohorts } from '@/lib/cohorts'

interface Course { id:string; name:string }; interface Cohort { id:string; name:string; course_id:string }; interface Item { id:string; title?:string; topic?:string; cohort_id:string; trainer_id?:string|null; starts_at?:string; due_at?:string|null; status?:string }
export function CourseCohortPage({ kind }: { kind:'sessions'|'assignments'|'projects' }) {
  const {role,profile}=useAuth(); const canManage=['admin','manager','trainer'].includes(role??''); const table=kind==='sessions'?'training_sessions':kind==='assignments'?'assignments':'projects'; const label=kind==='sessions'?'Training Sessions':kind==='assignments'?'Assignments':'Projects'; const [courses,setCourses]=useState<Course[]>([]),[cohorts,setCohorts]=useState<Cohort[]>([]),[trainers,setTrainers]=useState<{id:string;full_name:string}[]>([]),[items,setItems]=useState<Item[]>([]),[open,setOpen]=useState(false),[courseName,setCourseName]=useState(''),[cohortId,setCohortId]=useState(''),[trainerId,setTrainerId]=useState(''),[title,setTitle]=useState(''),[details,setDetails]=useState(''),[date,setDate]=useState(''),[error,setError]=useState<string|null>(null)
  const load=async()=>{
    setError(null)
    try {
      const [c,h,t]=await Promise.all([
        cohortRequest<{courses:{id:string;title:string}[]}>('/api/courses'),
        getAllCohorts(),
        cohortRequest<{trainers:{id:string;full_name:string}[]}>('/api/session-trainers'),
      ])
      setCourses(c.courses.map(course=>({id:course.id,name:course.title})))
      setCohorts(h)
      setTrainers(t.trainers)
      if(kind==='sessions') {
        const result=await cohortRequest<{sessions:Item[]}>('/api/sessions')
        setItems(result.sessions)
      } else {
        const result=await supabase.from(table).select('*').order('created_at',{ascending:false})
        if(result.error) throw result.error
        setItems(result.data??[])
      }
    } catch(error) {setError(error instanceof Error?error.message:'Unable to load session options.')}
  };useEffect(()=>{load()},[table]); const selected=courses.find(c=>c.name.toLowerCase()===courseName.trim().toLowerCase());const available=cohorts.filter(c=>c.course_id===selected?.id);const cohort=(id:string)=>cohorts.find(c=>c.id===id);const close=()=>{setOpen(false);setCourseName('');setCohortId('');setTrainerId('');setTitle('');setDetails('');setDate('')};const save=async(e:FormEvent)=>{e.preventDefault();if(!cohortId)return;const result=kind==='sessions'?await cohortRequest('/api/sessions', {method:'POST',body:JSON.stringify({topic:title,cohort_id:cohortId,trainer_id:trainerId||null,starts_at:new Date(date).toISOString()})}).then(()=>({error:null})).catch((error:Error)=>({error})):kind==='assignments'?await supabase.from('assignments').insert({title,cohort_id:cohortId,instructions:details||null,due_at:date||null,created_by:profile?.id}):await supabase.from('projects').insert({title,cohort_id:cohortId,description:details||null,due_at:date||null,created_by:profile?.id});if(result.error)setError(result.error.message);else{close();load()}}
  return <div><PageHeader title={label} subtitle={`${kind==='sessions'?'Schedule teaching':'Create learning work'} by course and cohort.`} actions={canManage?<button onClick={()=>setOpen(true)} className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-3.5 py-2 text-sm font-semibold text-white"><Plus size={16}/> Add {kind==='sessions'?'session':'assignment'}</button>:undefined}/>{error&&<p className="mb-4 text-sm text-[var(--color-danger-600)]">{error}</p>}<Card><ul className="divide-y divide-[var(--color-line)]">{items.length?items.map(i=>{const h=cohort(i.cohort_id);return <li key={i.id} className="p-4"><p className="font-medium text-[var(--color-ink-900)]">{i.topic??i.title}</p><p className="text-sm text-[var(--color-ink-600)]">{h?`${courses.find(c=>c.id===h.course_id)?.name??'Course'} · ${h.name}`:'Cohort'}</p></li>}):<li className="p-8 text-center text-sm text-[var(--color-ink-400)]">No {label.toLowerCase()} found.</li>}</ul></Card>{open&&<Modal title={`Add ${kind==='sessions'?'training session':'assignment'}`} onClose={close}><form onSubmit={save} className="space-y-3">{error && <p role="alert" className="text-sm text-[var(--color-danger-600)]">{error}</p>}<Field label="Course"><select required className="input" value={courseName} onChange={e=>{setCourseName(e.target.value);setCohortId('')}}><option value="">Choose a course</option>{courses.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></Field><Field label="Cohort"><select required disabled={!selected||!available.length} className="input" value={cohortId} onChange={e=>setCohortId(e.target.value)}><option value="">{!selected?'Enter a listed course':available.length?'Choose a cohort':'No cohorts for this course'}</option>{available.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>{kind==='sessions'&&<Field label="Trainer"><select className="input" value={trainerId} onChange={e=>setTrainerId(e.target.value)}><option value="">Choose a trainer</option>{trainers.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}</select></Field>}<Field label={kind==='sessions'?'Topic':'Assignment title'}><input required className="input" value={title} onChange={e=>setTitle(e.target.value)}/></Field>{kind==='assignments'&&<Field label="Instructions"><textarea className="input min-h-24" value={details} onChange={e=>setDetails(e.target.value)}/></Field>}<Field label={kind==='sessions'?'Start time':'Due date'}><input required={kind==='sessions'} type="datetime-local" className="input" value={date} onChange={e=>setDate(e.target.value)}/></Field><button disabled={!cohortId} className="rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50">Save</button></form></Modal>}</div>
}
