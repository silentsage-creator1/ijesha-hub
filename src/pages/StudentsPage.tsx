import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import { Avatar, Badge, Card } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { Field } from '@/components/ui/Field'

import { useAuth } from '@/app/auth'
import type { Student } from '@/types'
import { safeText, searchText } from '@/lib/text'

import { cohortRequest, getAllCohorts, type Cohort } from '@/lib/cohorts'

type Course = { id: string; name: string }
type StudentForm = {
  pastStudent: boolean
  firstName: string
  middleName: string
  lastName: string
  dateOfBirth: string
  gender: string
  phone: string
  email: string
  password: string
  confirmPassword: string
  courseId: string
  cohortId: string
  enrollmentDate: string
}
const blank: StudentForm = {
  pastStudent: false,
  firstName: '',
  middleName: '',
  lastName: '',
  dateOfBirth: '',
  gender: '',
  phone: '',
  email: '',
  password: '',
  confirmPassword: '',
  courseId: '',
  cohortId: '',
  enrollmentDate: new Date().toISOString().slice(0, 10),
}
const tones: Record<Student['status'], 'success' | 'warning' | 'neutral' | 'danger'> = {
  new: 'warning',
  active: 'success',
  paused: 'warning',
  graduated: 'neutral',
  withdrawn: 'danger',
}

export function StudentsPage() {
  const { role } = useAuth()
  const navigate = useNavigate()
  const canManage = role === 'admin' || role === 'manager'
  const [students, setStudents] = useState<Student[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [courseFilter, setCourseFilter] = useState('')
  const [open, setOpen] = useState(false)
  const [review, setReview] = useState(false)
  const [form, setForm] = useState<StudentForm>(blank)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setError(null)
    try {
      const [s,c,h]=await Promise.all([cohortRequest<{students:Student[]}>('/api/students'),cohortRequest<{courses:{id:string;title:string}[]}>('/api/courses'),getAllCohorts()])
      setStudents(s.students);setCourses(c.courses.map(c=>({id:c.id,name:c.title})));setCohorts(h)
    } catch(e) {setError(e instanceof Error?e.message:'Unable to load students.')}
  }

  useEffect(() => {
    load()
    const handleUpdate = () => load()
    window.addEventListener('cohorts-updated', handleUpdate)
    return () => window.removeEventListener('cohorts-updated', handleUpdate)
  }, [])
 const visible=useMemo(()=>students.filter(student=>{const q=query.toLowerCase();return (!q||searchText(student.full_name).includes(q)||searchText(student.email).includes(q)||searchText(student.cohort).includes(q))&&(!statusFilter||student.status===statusFilter)&&(!courseFilter||student.track===courseFilter)}),[students,query,statusFilter,courseFilter]);
  const available = cohorts.filter(c=>c.app_course_id===form.courseId && (!form.pastStudent || (c.ends_on && c.ends_on<new Date().toISOString().slice(0,10))))
 const update=<K extends keyof StudentForm>(key:K,value:StudentForm[K])=>setForm(current=>({...current,[key]:value}));const close=()=>{setOpen(false);setReview(false);setForm(blank);setError(null)}
 const validate=(event:FormEvent)=>{event.preventDefault();setError(null);if(!form.firstName.trim()||!form.lastName.trim()||!form.dateOfBirth||!form.gender||!form.phone.trim()||!form.email.trim()||!form.password||!form.courseId||!form.cohortId||!form.enrollmentDate)return setError('Complete every required field.');if(form.password!==form.confirmPassword)return setError('Passwords do not match.');if(form.password.length<8)return setError('Password must be at least 8 characters.');setReview(true)}
 const create=async()=>{
  setSaving(true);setError(null)
  try {
    await cohortRequest<{studentId:string}>('/api/students',{method:'POST',body:JSON.stringify(form)})
    close();await load();navigate('/students')
  }catch(e){setError(e instanceof Error?e.message:'Unable to create student.')}
  finally{setSaving(false)}
 }

 return <div><PageHeader title="Students" subtitle={canManage?'Search the roster or create a new student account.':'Students assigned to you.'} actions={canManage?<button onClick={()=>setOpen(true)} className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-3.5 py-2 text-sm font-semibold text-white"><Plus size={16}/>Add Student</button>:undefined}/><div className="mb-4 flex flex-wrap gap-3"><div className="relative max-w-sm flex-1 min-w-[200px]"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]"/><input className="input pl-9" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search students"/></div><select className="input w-auto min-w-[130px]" value={statusFilter} onChange={event=>setStatusFilter(event.target.value)}><option value="">All statuses</option><option value="new">New</option><option value="active">Active</option><option value="paused">Paused</option><option value="graduated">Graduated</option><option value="withdrawn">Withdrawn</option></select><select className="input w-auto min-w-[130px]" value={courseFilter} onChange={event=>setCourseFilter(event.target.value)}><option value="">All tracks</option>{courses.map(course=><option key={course.id} value={course.name}>{course.name}</option>)}</select></div>{error&&!open&&<p className="mb-4 rounded-md bg-[var(--color-danger-100)] p-3 text-sm text-[var(--color-danger-600)]">{error}</p>}<Card className="overflow-hidden"><ul className="divide-y divide-[var(--color-line)]">{visible.length?visible.map(student=><li key={student.id} className="flex items-center gap-3 px-5 py-3.5"><Avatar initials={initials(student.full_name)} size={36}/><Link to={`/students/${student.id}`} className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[var(--color-ink-900)] hover:text-[var(--color-harbor-600)]">{student.full_name}</p><p className="truncate text-xs text-[var(--color-ink-400)]">{[student.track,student.cohort].filter(Boolean).join(' · ')||student.email||'—'}</p></Link><Badge tone={tones[student.status]}>{student.status==='new'?'New Student':student.status}</Badge></li>):<li className="p-8 text-center text-sm text-[var(--color-ink-400)]">No students found.</li>}</ul></Card>{open&&<Modal title={review?'Review Student Information':'Add Student'} onClose={close}>{review?<Review form={form} courses={courses} cohorts={cohorts} saving={saving} error={error} onBack={()=>setReview(false)} onCreate={create}/>:<form onSubmit={validate} className="space-y-4"><h3 className="text-sm font-semibold">Personal Information</h3><div className="grid gap-3 sm:grid-cols-2"><Field label="First Name *"><input required className="input" value={form.firstName} onChange={event=>update('firstName',event.target.value)}/></Field><Field label="Middle Name"><input className="input" value={form.middleName} onChange={event=>update('middleName',event.target.value)}/></Field><Field label="Last Name *"><input required className="input" value={form.lastName} onChange={event=>update('lastName',event.target.value)}/></Field><Field label="Date of Birth *"><input required type="date" className="input" value={form.dateOfBirth} onChange={event=>update('dateOfBirth',event.target.value)}/></Field><Field label="Gender *"><select required className="input" value={form.gender} onChange={event=>update('gender',event.target.value)}><option value="">Choose gender</option><option>Female</option><option>Male</option><option>Prefer not to say</option></select></Field></div><h3 className="text-sm font-semibold">Contact Information</h3><div className="grid gap-3 sm:grid-cols-2"><Field label="Phone Number *"><input required type="tel" className="input" value={form.phone} onChange={event=>update('phone',event.target.value)}/></Field><Field label="Email Address *"><input required type="email" className="input" value={form.email} onChange={event=>update('email',event.target.value)}/></Field></div><h3 className="text-sm font-semibold">Account Information</h3><div className="grid gap-3 sm:grid-cols-2"><Field label="Password *"><input required type="password" className="input" value={form.password} onChange={event=>update('password',event.target.value)}/></Field><Field label="Confirm Password *"><input required type="password" className="input" value={form.confirmPassword} onChange={event=>update('confirmPassword',event.target.value)}/></Field></div><h3 className="text-sm font-semibold">Enrollment Information</h3>{role==='admin'&&<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.pastStudent} onChange={event=>{update('pastStudent',event.target.checked);update('cohortId','');update('enrollmentDate',event.target.checked?'':new Date().toISOString().slice(0,10))}}/>Past student — completed training</label>}{form.pastStudent&&<p className="text-sm">Select a completed cohort and the original enrollment date. This student will be recorded as Graduated with a completed enrollment; grades, attendance and certificates are not created automatically.</p>}<div className="grid gap-3 sm:grid-cols-2"><Field label="Course *"><select required className="input" value={form.courseId} onChange={event=>{update('courseId',event.target.value);update('cohortId','')}}><option value="">Select course</option>{courses.map(course=><option key={course.id} value={course.id}>{course.name}</option>)}</select></Field><Field label="Cohort *"><select required disabled={!form.courseId} className="input" value={form.cohortId} onChange={event=>{update('cohortId',event.target.value);if(form.pastStudent){const c=cohorts.find(c=>c.id===event.target.value);update('enrollmentDate',c?.starts_on||c?.ends_on||'')}}}><option value="">{form.courseId?'Select cohort':'Select course first'}</option>{available.map(cohort=><option key={cohort.id} value={cohort.id}>{cohort.name} · {cohort.status}</option>)}</select></Field><Field label={form.pastStudent?"Original Enrollment Date *":"Enrollment Date *"}><input required type="date" className="input" value={form.enrollmentDate} onChange={event=>update('enrollmentDate',event.target.value)}/></Field><Field label="Status"><input className="input" value={form.pastStudent?'Graduated — completed enrollment':'Active student'} readOnly/></Field></div>{error&&<p className="text-sm text-[var(--color-danger-600)]">{error}</p>}<div className="flex justify-end"><button className="rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-4 py-2 text-sm font-semibold text-white">Review Student Information</button></div></form>}</Modal>}</div>
}
function Review({form,courses,cohorts,saving,error,onBack,onCreate}:{form:StudentForm;courses:Course[];cohorts:Cohort[];saving:boolean;error:string|null;onBack:()=>void;onCreate:()=>void}){const course=courses.find(item=>item.id===form.courseId)?.name??'—';const cohort=cohorts.find(item=>item.id===form.cohortId)?.name??'—';return <div className="space-y-4"><p className="text-sm text-[var(--color-ink-600)]">Check the details before creating the student account.</p><dl className="grid gap-3 text-sm sm:grid-cols-2"><Info label="Student" value={[form.firstName,form.middleName,form.lastName].filter(Boolean).join(' ')}/><Info label="Date of birth" value={form.dateOfBirth}/><Info label="Gender" value={form.gender}/><Info label="Phone" value={form.phone}/><Info label="Email" value={form.email}/><Info label="Course" value={course}/><Info label="Cohort" value={cohort}/><Info label="Enrollment date" value={form.enrollmentDate}/><Info label="Status" value="New Student"/></dl>{error&&<p className="text-sm text-[var(--color-danger-600)]">{error}</p>}<div className="flex justify-end gap-2"><button onClick={onBack} className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3.5 py-2 text-sm font-medium">Back / Edit</button><button disabled={saving} onClick={onCreate} className="rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-3.5 py-2 text-sm font-semibold text-white">{saving?'Creating…':'Create Student'}</button></div></div>}
function Info({label,value}:{label:string;value:string}){return <div><dt className="text-xs text-[var(--color-ink-400)]">{label}</dt><dd className="font-medium text-[var(--color-ink-800)]">{value}</dd></div>};function initials(name:string){const words=safeText(name).trim().split(/\s+/);return((words[0]?.[0]??'')+(words[1]?.[0]??'')).toUpperCase()||'S'}
