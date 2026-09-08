import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import { Avatar, Badge, Card } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { Field } from '@/components/ui/Field'
import { supabase } from '@/lib/supabase'
import { useAuth, isPlatformAdminEmail } from '@/app/auth'
import type { Student } from '@/types'
import { officialCourses } from '@/lib/courses'
import { getAllCohorts, type Cohort } from '@/lib/cohorts'

type Course = { id: string; name: string }
type StudentForm = {
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
    try {
      const [s, p, c, h] = await Promise.all([
        supabase.from('students').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').eq('role', 'student').order('created_at', { ascending: false }),
        supabase.from('courses').select('id,name').order('name'),
        getAllCohorts(),
      ])

      const sData = (s.data ?? []) as Student[]
      const pData = (p.data ?? []) as Array<{ id: string; full_name: string; organization: string | null; created_at: string; email?: string }>
      const existingProfileIds = new Set(sData.map((st) => st.profile_id).filter(Boolean))
      const existingEmails = new Set(sData.map((st) => st.email?.toLowerCase()).filter(Boolean))
      const extraStudents: Student[] = []

      for (const prof of pData) {
        if (!existingProfileIds.has(prof.id)) {
          const studentEmail = prof.email || null
          const synthesized: Student = {
            id: prof.id,
            profile_id: prof.id,
            full_name: prof.full_name,
            email: studentEmail,
            cohort: null,
            track: 'Frontend Development',
            status: 'active',
            assigned_trainer_id: null,
            organization: prof.organization ?? null,
            created_by: null,
            created_at: prof.created_at,
            updated_at: prof.created_at,
          }
          extraStudents.push(synthesized)
          if (canManage) {
            supabase
              .from('students')
              .insert({
                profile_id: prof.id,
                full_name: prof.full_name,
                email: studentEmail,
                track: 'Frontend Development',
                status: 'active',
              })
              .then(() => {})
          }
        }
      }

      // Also check pending roster sync
      try {
        const raw = localStorage.getItem('ijesha_hub_pending_roster_sync')
        if (raw) {
          const pending = JSON.parse(raw) as Student[]
          for (const item of pending) {
            if (!existingProfileIds.has(item.profile_id) && !existingEmails.has(item.email?.toLowerCase())) {
              extraStudents.unshift(item)
              existingProfileIds.add(item.profile_id)
              if (item.email) existingEmails.add(item.email.toLowerCase())
            }
          }
        }
      } catch {
        // Ignore
      }

      const allStudents = [...sData, ...extraStudents].filter(
        (st) => !isPlatformAdminEmail(st.email)
      )
      setStudents(allStudents)
      setCourses(officialCourses((c.data ?? []) as Course[]))
      setCohorts(h)
    } catch (err: any) {
      setError(err?.message || 'Error loading students')
    }
  }

  useEffect(() => {
    load()
    const handleUpdate = () => load()
    window.addEventListener('cohorts-updated', handleUpdate)
    return () => window.removeEventListener('cohorts-updated', handleUpdate)
  }, [])
 const visible=useMemo(()=>students.filter(student=>{const q=query.toLowerCase();return (!q||student.full_name.toLowerCase().includes(q)||(student.email??'').toLowerCase().includes(q)||(student.cohort??'').toLowerCase().includes(q))&&(!statusFilter||student.status===statusFilter)&&(!courseFilter||student.track===courseFilter)}),[students,query,statusFilter,courseFilter]);  const selectedCourse = courses.find((c) => c.id === form.courseId)
  const matchedCohorts = cohorts.filter(
    (cohort) =>
      cohort.course_id === form.courseId ||
      (selectedCourse && cohort.course_name.toLowerCase().includes(selectedCourse.name.toLowerCase()))
  )
  const available = matchedCohorts.length > 0 ? matchedCohorts : cohorts
 const update=<K extends keyof StudentForm>(key:K,value:StudentForm[K])=>setForm(current=>({...current,[key]:value}));const close=()=>{setOpen(false);setReview(false);setForm(blank);setError(null)}
 const validate=(event:FormEvent)=>{event.preventDefault();setError(null);if(!form.firstName.trim()||!form.lastName.trim()||!form.dateOfBirth||!form.gender||!form.phone.trim()||!form.email.trim()||!form.password||!form.courseId||!form.cohortId||!form.enrollmentDate)return setError('Complete every required field.');if(form.password!==form.confirmPassword)return setError('Passwords do not match.');if(form.password.length<6)return setError('Password must be at least 6 characters.');setReview(true)}
 const create=async()=>{
  setSaving(true);
  setError(null);
  const courseName=courses.find(course=>course.id===form.courseId)?.name??'';
  const cohortName=cohorts.find(cohort=>cohort.id===form.cohortId)?.name??'';
  const fullName=[form.firstName,form.middleName,form.lastName].filter(Boolean).join(' ').trim();
  const email=form.email.trim().toLowerCase();

  try {
    let createdProfileId: string | null = null;
    try {
      const { data: authData } = await supabase.auth.signUp({
        email,
        password: form.password,
        options: {
          data: {
            full_name: fullName,
            role: 'student',
            track: courseName || 'Frontend Development',
          },
        },
      });
      if (authData?.user) {
        createdProfileId = authData.user.id;
      }
    } catch {
      // Continue to create roster entry
    }

    const { data: newStudent, error: insertError } = await supabase
      .from('students')
      .insert({
        profile_id: createdProfileId,
        full_name: fullName,
        email: email,
        track: courseName || 'Frontend Development',
        cohort: cohortName || null,
        status: 'new',
      })
      .select()
      .single();

    if (insertError) {
      const { data: edgeData, error: invokeError } = await supabase.functions.invoke('create-student', {
        body: { ...form, courseName },
      });
      if (invokeError || edgeData?.error) {
        setSaving(false);
        return setError(insertError.message || edgeData?.error || 'Student could not be created.');
      }
      setSaving(false);
      close();
      load();
      navigate(`/students/${edgeData.studentId}`);
      return;
    }

    if (newStudent) {
      await supabase.from('student_profile_details').upsert({
        student_id: newStudent.id,
        first_name: form.firstName.trim(),
        middle_name: form.middleName?.trim() || null,
        last_name: form.lastName.trim(),
        date_of_birth: form.dateOfBirth,
        gender: form.gender,
        phone_number: form.phone.trim(),
      });

      if (form.cohortId) {
        await supabase.from('enrollments').insert({
          student_id: newStudent.id,
          cohort_id: form.cohortId,
          completion_status: 'in_progress',
          created_at: form.enrollmentDate,
        });
      }

      setSaving(false);
      close();
      load();
      navigate(`/students/${newStudent.id}`);
      return;
    }
  } catch (err: any) {
    setSaving(false);
    setError(err?.message || 'Failed to create student account.');
  }
}
 return <div><PageHeader title="Students" subtitle={canManage?'Search the roster or create a new student account.':'Students assigned to you.'} actions={canManage?<button onClick={()=>setOpen(true)} className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-3.5 py-2 text-sm font-semibold text-white"><Plus size={16}/>Add Student</button>:undefined}/><div className="mb-4 flex flex-wrap gap-3"><div className="relative max-w-sm flex-1 min-w-[200px]"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]"/><input className="input pl-9" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search students"/></div><select className="input w-auto min-w-[130px]" value={statusFilter} onChange={event=>setStatusFilter(event.target.value)}><option value="">All statuses</option><option value="new">New</option><option value="active">Active</option><option value="paused">Paused</option><option value="graduated">Graduated</option><option value="withdrawn">Withdrawn</option></select><select className="input w-auto min-w-[130px]" value={courseFilter} onChange={event=>setCourseFilter(event.target.value)}><option value="">All tracks</option>{courses.map(course=><option key={course.id} value={course.name}>{course.name}</option>)}</select></div>{error&&!open&&<p className="mb-4 rounded-md bg-[var(--color-danger-100)] p-3 text-sm text-[var(--color-danger-600)]">{error}</p>}<Card className="overflow-hidden"><ul className="divide-y divide-[var(--color-line)]">{visible.length?visible.map(student=><li key={student.id} className="flex items-center gap-3 px-5 py-3.5"><Avatar initials={initials(student.full_name)} size={36}/><Link to={`/students/${student.id}`} className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[var(--color-ink-900)] hover:text-[var(--color-harbor-600)]">{student.full_name}</p><p className="truncate text-xs text-[var(--color-ink-400)]">{[student.track,student.cohort].filter(Boolean).join(' · ')||student.email||'—'}</p></Link><Badge tone={tones[student.status]}>{student.status==='new'?'New Student':student.status}</Badge></li>):<li className="p-8 text-center text-sm text-[var(--color-ink-400)]">No students found.</li>}</ul></Card>{open&&<Modal title={review?'Review Student Information':'Add Student'} onClose={close}>{review?<Review form={form} courses={courses} cohorts={cohorts} saving={saving} error={error} onBack={()=>setReview(false)} onCreate={create}/>:<form onSubmit={validate} className="space-y-4"><h3 className="text-sm font-semibold">Personal Information</h3><div className="grid gap-3 sm:grid-cols-2"><Field label="First Name *"><input required className="input" value={form.firstName} onChange={event=>update('firstName',event.target.value)}/></Field><Field label="Middle Name"><input className="input" value={form.middleName} onChange={event=>update('middleName',event.target.value)}/></Field><Field label="Last Name *"><input required className="input" value={form.lastName} onChange={event=>update('lastName',event.target.value)}/></Field><Field label="Date of Birth *"><input required type="date" className="input" value={form.dateOfBirth} onChange={event=>update('dateOfBirth',event.target.value)}/></Field><Field label="Gender *"><select required className="input" value={form.gender} onChange={event=>update('gender',event.target.value)}><option value="">Choose gender</option><option>Female</option><option>Male</option><option>Prefer not to say</option></select></Field></div><h3 className="text-sm font-semibold">Contact Information</h3><div className="grid gap-3 sm:grid-cols-2"><Field label="Phone Number *"><input required type="tel" className="input" value={form.phone} onChange={event=>update('phone',event.target.value)}/></Field><Field label="Email Address *"><input required type="email" className="input" value={form.email} onChange={event=>update('email',event.target.value)}/></Field></div><h3 className="text-sm font-semibold">Account Information</h3><div className="grid gap-3 sm:grid-cols-2"><Field label="Password *"><input required type="password" className="input" value={form.password} onChange={event=>update('password',event.target.value)}/></Field><Field label="Confirm Password *"><input required type="password" className="input" value={form.confirmPassword} onChange={event=>update('confirmPassword',event.target.value)}/></Field></div><h3 className="text-sm font-semibold">Enrollment Information</h3><div className="grid gap-3 sm:grid-cols-2"><Field label="Course *"><select required className="input" value={form.courseId} onChange={event=>{update('courseId',event.target.value);update('cohortId','')}}><option value="">Select course</option>{courses.map(course=><option key={course.id} value={course.id}>{course.name}</option>)}</select></Field><Field label="Cohort *"><select required disabled={!form.courseId} className="input" value={form.cohortId} onChange={event=>update('cohortId',event.target.value)}><option value="">{form.courseId?'Select cohort':'Select course first'}</option>{available.map(cohort=><option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}</select></Field><Field label="Enrollment Date *"><input required type="date" className="input" value={form.enrollmentDate} onChange={event=>update('enrollmentDate',event.target.value)}/></Field><Field label="Status"><input className="input" value="New Student" readOnly/></Field></div>{error&&<p className="text-sm text-[var(--color-danger-600)]">{error}</p>}<div className="flex justify-end"><button className="rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-4 py-2 text-sm font-semibold text-white">Review Student Information</button></div></form>}</Modal>}</div>
}
function Review({form,courses,cohorts,saving,error,onBack,onCreate}:{form:StudentForm;courses:Course[];cohorts:Cohort[];saving:boolean;error:string|null;onBack:()=>void;onCreate:()=>void}){const course=courses.find(item=>item.id===form.courseId)?.name??'—';const cohort=cohorts.find(item=>item.id===form.cohortId)?.name??'—';return <div className="space-y-4"><p className="text-sm text-[var(--color-ink-600)]">Check the details before creating the student account.</p><dl className="grid gap-3 text-sm sm:grid-cols-2"><Info label="Student" value={[form.firstName,form.middleName,form.lastName].filter(Boolean).join(' ')}/><Info label="Date of birth" value={form.dateOfBirth}/><Info label="Gender" value={form.gender}/><Info label="Phone" value={form.phone}/><Info label="Email" value={form.email}/><Info label="Course" value={course}/><Info label="Cohort" value={cohort}/><Info label="Enrollment date" value={form.enrollmentDate}/><Info label="Status" value="New Student"/></dl>{error&&<p className="text-sm text-[var(--color-danger-600)]">{error}</p>}<div className="flex justify-end gap-2"><button onClick={onBack} className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3.5 py-2 text-sm font-medium">Back / Edit</button><button disabled={saving} onClick={onCreate} className="rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-3.5 py-2 text-sm font-semibold text-white">{saving?'Creating…':'Create Student'}</button></div></div>}
function Info({label,value}:{label:string;value:string}){return <div><dt className="text-xs text-[var(--color-ink-400)]">{label}</dt><dd className="font-medium text-[var(--color-ink-800)]">{value}</dd></div>};function initials(name:string){const words=name.trim().split(/\s+/);return((words[0]?.[0]??'')+(words[1]?.[0]??'')).toUpperCase()||'S'}
