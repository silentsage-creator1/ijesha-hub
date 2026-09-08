import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { ImagePlus } from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import { Card } from '@/components/ui/primitives'
import { useAuth } from '@/app/auth'
import { supabase } from '@/lib/supabase'

type Details = {
  student_id: string
  first_name: string | null; middle_name: string | null; last_name: string | null
  date_of_birth: string | null; gender: string | null; phone_number: string | null
  home_address: string | null; state: string | null; lga: string | null; city_town: string | null
  photo_path: string | null; guardian_first_name: string | null; guardian_last_name: string | null
  guardian_relationship: string | null; guardian_phone: string | null; guardian_alt_phone: string | null
  guardian_email: string | null; guardian_address: string | null; certificate_name: string | null
  certificate_number: string | null; final_score: number | null; completion_status: string | null
  training_start_date: string | null; training_completion_date: string | null; certificate_issue_date: string | null; total_training_hours: number | null
}

const blank = { first_name: '', middle_name: '', last_name: '', date_of_birth: '', gender: '', phone_number: '', home_address: '', state: '', lga: '', city_town: '', guardian_first_name: '', guardian_last_name: '', guardian_relationship: '', guardian_phone: '', guardian_alt_phone: '', guardian_email: '', guardian_address: '', certificate_name: '' }

function fieldValue(value: string | null | undefined) { return value ?? '' }

export function ProfilePage() {
  const { profile, session } = useAuth()
  const [studentId, setStudentId] = useState<string | null>(null)
  const [form, setForm] = useState(blank)
  const [photoPath, setPhotoPath] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [photo, setPhoto] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [enrollment, setEnrollment] = useState<{ course: string; cohort: string; date: string } | null>(null)
  const [certificate, setCertificate] = useState<Pick<Details, 'certificate_number' | 'final_score' | 'completion_status' | 'training_start_date' | 'training_completion_date' | 'certificate_issue_date' | 'total_training_hours'> | null>(null)

  useEffect(() => {
    if (!profile || profile.role !== 'student') { setLoading(false); return }
    const studentProfile = profile
    let cancelled = false
    async function load() {
      const studentResult = await supabase.from('students').select('id').eq('profile_id', studentProfile.id).maybeSingle()
      if (studentResult.error || !studentResult.data) { if (!cancelled) { setError(studentResult.error?.message ?? 'Your student record is not ready yet.'); setLoading(false) }; return }
      const sid = studentResult.data.id
      const detailsResult = await supabase.from('student_profile_details').select('*').eq('student_id', sid).maybeSingle()
      const enrollmentResult = await supabase.from('enrollments').select('created_at, cohorts(name,courses(name))').eq('student_id', sid).limit(1).maybeSingle()
      if (cancelled) return
      setStudentId(sid)
      const cohort = enrollmentResult.data?.cohorts as unknown as { name?: string; courses?: { name?: string } } | null
      if (cohort?.name) setEnrollment({ course: cohort.courses?.name ?? '—', cohort: cohort.name, date: enrollmentResult.data?.created_at ?? '' })
      if (detailsResult.error) setError(detailsResult.error.message)
      if (detailsResult.data) {
        const d = detailsResult.data as Details
        setCertificate({ certificate_number: d.certificate_number, final_score: d.final_score, completion_status: d.completion_status, training_start_date: d.training_start_date, training_completion_date: d.training_completion_date, certificate_issue_date: d.certificate_issue_date, total_training_hours: d.total_training_hours })
        setPhotoPath(d.photo_path)
        setForm({ first_name: fieldValue(d.first_name), middle_name: fieldValue(d.middle_name), last_name: fieldValue(d.last_name), date_of_birth: fieldValue(d.date_of_birth), gender: fieldValue(d.gender), phone_number: fieldValue(d.phone_number), home_address: fieldValue(d.home_address), state: fieldValue(d.state), lga: fieldValue(d.lga), city_town: fieldValue(d.city_town), guardian_first_name: fieldValue(d.guardian_first_name), guardian_last_name: fieldValue(d.guardian_last_name), guardian_relationship: fieldValue(d.guardian_relationship), guardian_phone: fieldValue(d.guardian_phone), guardian_alt_phone: fieldValue(d.guardian_alt_phone), guardian_email: fieldValue(d.guardian_email), guardian_address: fieldValue(d.guardian_address), certificate_name: fieldValue(d.certificate_name) })
        if (d.photo_path) {
          const signed = await supabase.storage.from('student-photos').createSignedUrl(d.photo_path, 60 * 60)
          if (!signed.error && !cancelled) setPreview(signed.data.signedUrl)
        }
      }
      setLoading(false)
    }
    load(); return () => { cancelled = true }
  }, [profile])

  function update(key: keyof typeof blank, value: string) { setForm(current => ({ ...current, [key]: value })) }
  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Choose an image file for the student photo.'); return }
    setPhoto(file); setPreview(URL.createObjectURL(file)); setError(null)
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setError(null); setNotice(null)
    if (!studentId) return
    const required = [form.first_name, form.last_name, form.date_of_birth, form.gender, form.phone_number, form.home_address, form.state, form.lga, form.city_town]
    if (required.some(value => !value.trim())) { setError('Complete all required personal information fields.'); return }
    if (!photoPath && !photo) { setError('Student photo is required.'); return }
    setSaving(true)
    let nextPhotoPath = photoPath
    if (photo) {
      const extension = photo.name.split('.').pop() || 'jpg'
      const path = `${studentId}/${Date.now()}.${extension}`
      const upload = await supabase.storage.from('student-photos').upload(path, photo, { upsert: false, contentType: photo.type })
      if (upload.error) { setSaving(false); setError(upload.error.message); return }
      nextPhotoPath = upload.data.path
    }
    const result = await supabase.from('student_profile_details').upsert({ student_id: studentId, ...form, photo_path: nextPhotoPath })
    setSaving(false)
    if (result.error) { setError(result.error.message); return }
    setPhotoPath(nextPhotoPath); setPhoto(null); setNotice('Profile saved successfully.')
  }

  if (profile?.role !== 'student') return <RoleProfile />
  if (loading) return <p className="py-8 text-center text-sm text-[var(--color-ink-400)]">Loading profile…</p>
  return <div><PageHeader title="My Profile" subtitle="Keep your personal, enrollment and certificate details accurate." /><form onSubmit={save} className="max-w-4xl space-y-5"><Card className="p-5"><h2 className="font-display font-semibold text-[var(--color-ink-900)]">Sign-in and personal details</h2><p className="mt-1 text-sm text-[var(--color-ink-500)]">Fields marked * are required.</p><div className="mt-4 flex flex-wrap items-center gap-4"><div className="h-24 w-24 overflow-hidden rounded-full bg-[var(--color-ink-100)]">{preview ? <img src={preview} alt="Student profile preview" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-[var(--color-ink-400)]">No photo</div>}</div><label className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm font-medium"><ImagePlus size={16}/> {photoPath || photo ? 'Replace photo' : 'Upload photo *'}<input type="file" accept="image/*" className="sr-only" onChange={selectPhoto}/></label></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><Text label="First name *" value={form.first_name} onChange={v=>update('first_name',v)} /><Text label="Middle name" value={form.middle_name} onChange={v=>update('middle_name',v)} /><Text label="Last name *" value={form.last_name} onChange={v=>update('last_name',v)} /><Text label="Email address *" value={session?.user.email ?? ''} onChange={()=>{}} readOnly /><Text label="Date of birth *" type="date" value={form.date_of_birth} onChange={v=>update('date_of_birth',v)} /><label className="block text-sm font-medium text-[var(--color-ink-700)]">Gender *<select className="input mt-1" value={form.gender} onChange={e=>update('gender',e.target.value)}><option value="">Choose</option><option>Female</option><option>Male</option><option>Prefer not to say</option></select></label><Text label="Phone number *" value={form.phone_number} onChange={v=>update('phone_number',v)} /><Text label="Home address *" value={form.home_address} onChange={v=>update('home_address',v)} /><Text label="State *" value={form.state} onChange={v=>update('state',v)} /><Text label="Local Government Area (LGA) *" value={form.lga} onChange={v=>update('lga',v)} /><Text label="City/Town *" value={form.city_town} onChange={v=>update('city_town',v)} /></div></Card><Card className="p-5"><h2 className="font-display font-semibold text-[var(--color-ink-900)]">Enrollment information</h2><div className="mt-4 grid gap-4 text-sm sm:grid-cols-3"><ReadOnly label="Enrollment date" value={formatDate(enrollment?.date)} /><ReadOnly label="Course/program" value={enrollment?.course} /><ReadOnly label="Cohort" value={enrollment?.cohort} /></div></Card><Card className="p-5"><h2 className="font-display font-semibold text-[var(--color-ink-900)]">Parent or guardian</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><Text label="Parent/guardian first name" value={form.guardian_first_name} onChange={v=>update('guardian_first_name',v)} /><Text label="Parent/guardian last name" value={form.guardian_last_name} onChange={v=>update('guardian_last_name',v)} /><Text label="Relationship to student" value={form.guardian_relationship} onChange={v=>update('guardian_relationship',v)} /><Text label="Parent/guardian phone number" value={form.guardian_phone} onChange={v=>update('guardian_phone',v)} /><Text label="Alternative phone number (optional)" value={form.guardian_alt_phone} onChange={v=>update('guardian_alt_phone',v)} /><Text label="Parent/guardian email address" type="email" value={form.guardian_email} onChange={v=>update('guardian_email',v)} /><Text label="Parent/guardian address (optional)" value={form.guardian_address} onChange={v=>update('guardian_address',v)} /></div></Card><Card className="p-5"><h2 className="font-display font-semibold text-[var(--color-ink-900)]">Certificate information</h2><p className="mt-1 text-sm text-[var(--color-ink-500)]">Only the certificate name can be changed here. The remaining values come from training and administration records.</p><div className="mt-4 grid gap-3 sm:grid-cols-3"><Text label="Full legal name / name to appear on certificate" value={form.certificate_name} onChange={v=>update('certificate_name',v)} /><ReadOnly label="Course/program name" value={enrollment?.course} /><ReadOnly label="Cohort" value={enrollment?.cohort} /><ReadOnly label="Training start date" value={formatDate(certificate?.training_start_date)} /><ReadOnly label="Training completion date" value={formatDate(certificate?.training_completion_date)} /><ReadOnly label="Certificate issue date" value={formatDate(certificate?.certificate_issue_date)} /><ReadOnly label="Certificate number" value={certificate?.certificate_number} /><ReadOnly label="Final score/grade" value={certificate?.final_score?.toString()} /><ReadOnly label="Completion status" value={certificate?.completion_status} /><ReadOnly label="Total training hours" value={certificate?.total_training_hours?.toString()} /></div></Card>{error&&<p className="text-sm text-[var(--color-danger-600)]">{error}</p>}{notice&&<p className="text-sm text-[var(--color-success-600)]">{notice}</p>}<button disabled={saving} className="rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving?'Saving…':'Save profile'}</button></form></div>
}

function Text({ label, value, onChange, type = 'text', readOnly = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; readOnly?: boolean }) { return <label className="block text-sm font-medium text-[var(--color-ink-700)]">{label}<input type={type} readOnly={readOnly} className="input mt-1" value={value} onChange={e=>onChange(e.target.value)} /></label> }
function ReadOnly({ label, value }: { label: string; value?: string | null }) { return <div><p className="text-xs font-medium text-[var(--color-ink-400)]">{label}</p><p className="mt-1 text-sm text-[var(--color-ink-800)]">{value || 'Not available yet'}</p></div> }
function formatDate(value?: string | null) { return value ? new Date(value).toLocaleDateString() : undefined }

function RoleProfile() {
  const { profile, session } = useAuth()
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [organization, setOrganization] = useState('')
  const [department, setDepartment] = useState('')
  const [photoPath, setPhotoPath] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photo, setPhoto] = useState<File | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (!profile) return
    setFullName(profile.full_name); setPhone(profile.phone_number ?? ''); setOrganization(profile.organization ?? ''); setDepartment(profile.department ?? ''); setPhotoPath(profile.photo_path ?? null)
    if (profile.photo_path) supabase.storage.from('profile-photos').createSignedUrl(profile.photo_path, 60 * 60).then(result => { if (!result.error) setPhotoUrl(result.data.signedUrl) })
  }, [profile])
  function pickPhoto(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; if (!file.type.startsWith('image/')) { setError('Choose an image file.'); return }; setPhoto(file); setPhotoUrl(URL.createObjectURL(file)) }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!profile || !fullName.trim()) { setError('Full name is required.'); return }; setSaving(true); setError(null); let nextPhoto = photoPath
    if (photo) { const extension = photo.name.split('.').pop() || 'jpg'; const upload = await supabase.storage.from('profile-photos').upload(`${profile.id}/${Date.now()}.${extension}`, photo, { contentType: photo.type }); if (upload.error) { setSaving(false); setError(upload.error.message); return }; nextPhoto = upload.data.path }
    const result = await supabase.from('profiles').update({ full_name: fullName.trim(), phone_number: phone.trim() || null, organization: organization.trim() || null, department: department.trim() || null, photo_path: nextPhoto }).eq('id', profile.id)
    setSaving(false); if (result.error) setError(result.error.message); else { setPhotoPath(nextPhoto); setPhoto(null); setNotice('Profile updated successfully.') }
  }
  const roleName = profile?.role ? profile.role[0].toUpperCase() + profile.role.slice(1) : 'User'
  return <div><PageHeader title="My Profile" subtitle={`${roleName} account information.`} /><form onSubmit={save} className="max-w-3xl space-y-5"><Card className="p-5"><div className="flex flex-wrap items-center gap-4">{photoUrl ? <img src={photoUrl} alt="Profile" className="h-24 w-24 rounded-full object-cover" /> : <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--color-harbor-100)] text-2xl font-semibold text-[var(--color-harbor-700)]">{fullName.slice(0,1)}</div>}<label className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm font-medium"><ImagePlus size={16}/> {photoPath || photo ? 'Replace photo' : 'Upload photo'}<input className="sr-only" type="file" accept="image/*" onChange={pickPhoto}/></label></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><Text label="Full name *" value={fullName} onChange={setFullName}/><Text label="Email address" value={session?.user.email ?? ''} onChange={()=>{}} readOnly/><Text label="Phone number" value={phone} onChange={setPhone}/><Text label="Organization" value={organization} onChange={setOrganization}/>{profile?.role==='manager'&&<Text label="Assigned department/program" value={department} onChange={setDepartment}/>}<ReadOnly label="Role" value={roleName}/><ReadOnly label="Date joined" value={formatDate(profile?.created_at)}/></div></Card><Card className="p-5"><h2 className="font-display font-semibold text-[var(--color-ink-900)]">Role information</h2><p className="mt-2 text-sm text-[var(--color-ink-600)]">{profile?.role==='trainer'?'Your courses, cohorts and assigned students are available in the Training section.':profile?.role==='sponsor'?'Your assigned cohorts and student outcomes are available in Sponsored learning.':profile?.role==='parent'?'Your linked child’s learning information is available from your dashboard.':'Use the navigation to manage the information available to your role.'}</p></Card>{error&&<p className="text-sm text-[var(--color-danger-600)]">{error}</p>}{notice&&<p className="text-sm text-[var(--color-success-600)]">{notice}</p>}<button disabled={saving} className="rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving?'Saving…':'Save profile'}</button></form></div>
}
