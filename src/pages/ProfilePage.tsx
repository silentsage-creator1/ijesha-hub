import { useEffect, useState, type FormEvent } from 'react'
import { PageHeader } from '@/components/shell/PageHeader'
import { Card } from '@/components/ui/primitives'
import { useAuth } from '@/app/auth'
import { cohortRequest } from '@/lib/cohorts'

const personal = ['first_name','middle_name','last_name','date_of_birth','gender','phone_number','home_address','state','lga','city_town']
const guardian = ['guardian_first_name','guardian_last_name','guardian_relationship','guardian_phone','guardian_alt_phone','guardian_email','guardian_address']
const certificate = ['certificate_number','final_score','completion_status','training_start_date','training_completion_date','certificate_issue_date','total_training_hours']
type Data = { user: { full_name:string; email:string; role:string; organization:string }; details:Record<string,string | number | null>; photo:string|null; cohort:{name:string;course_name:string}|null }
const label = (key:string) => key.split('_').map(word=>word[0].toUpperCase()+word.slice(1)).join(' ')

export function ProfilePage() {
  const { profile, refreshProfile } = useAuth()
  const [data,setData] = useState<Data|null>(null)
  const [name,setName] = useState('')
  const [details,setDetails] = useState<Record<string,string | number | null>>({})
  const [photo,setPhoto] = useState<string>()
  const [error,setError] = useState('')
  const [notice,setNotice] = useState('')
  const [saving,setSaving] = useState(false)
  useEffect(()=>{
    let active=true
    setData(null)
    cohortRequest<Data>('/api/profile').then(result=>{
      if(active){setData(result);setName(result.user.full_name);setDetails(result.details);setPhoto(undefined)}
    }).catch(err=>{if(active)setError(err.message)})
    return ()=>{active=false}
  },[profile?.id,profile?.role])
  async function save(event:FormEvent) {
    event.preventDefault();setSaving(true);setError('');setNotice('')
    try {
      await cohortRequest('/api/profile',{method:'PATCH',body:JSON.stringify({fullName:name,details,photo})})
      await refreshProfile()
      setNotice('Profile saved successfully.')
    } catch(err){setError(err instanceof Error?err.message:'Unable to save profile.')}
    finally{setSaving(false)}
  }
  const fields=(keys:string[])=> <div className="grid gap-3 sm:grid-cols-2">{keys.map(key=><label key={key} className="text-sm">{label(key)}<input className="input mt-1" type={key==='date_of_birth'?'date':key.includes('email')?'email':'text'} value={details[key]??''} onChange={event=>setDetails(current=>({...current,[key]:event.target.value}))}/></label>)}</div>
  return <div className="space-y-5"><PageHeader title="My Profile" subtitle="Your account and enrollment information."/>
    {error&&<p role="alert" className="text-[var(--color-danger-600)]">{error}</p>}
    {!data ? <p>{error?'Profile could not be loaded. Refresh to retry.':'Loading profile…'}</p> :
    <form onSubmit={save} className="max-w-4xl space-y-5">
      <Card className="space-y-4 p-5">
        {(photo||data.photo)&&<img src={photo||data.photo||''} alt="Profile" className="h-24 w-24 rounded-full object-cover"/>}
        <label className="block text-sm">Profile photo (optional, PNG/JPEG/WebP under 1 MB)<input className="input mt-1" type="file" accept="image/png,image/jpeg,image/webp" onChange={event=>{
          const file=event.target.files?.[0];if(!file)return
          if(file.size>1000000||!['image/png','image/jpeg','image/webp'].includes(file.type)){setError('Choose a PNG, JPEG or WebP under 1 MB.');return}
          const reader=new FileReader();reader.onload=()=>setPhoto(String(reader.result));reader.onerror=()=>setError('Unable to read photo.');reader.readAsDataURL(file)
        }}/></label>
        <label className="block text-sm">Full name<input required maxLength={200} className="input mt-1" value={name} onChange={event=>setName(event.target.value)}/></label>
        <p>Email: {data.user.email}</p><p>Role: {data.user.role}</p><p>Organization: {data.user.organization||'Not assigned'}</p>
      </Card>
      <Card className="space-y-4 p-5"><h2>Personal details</h2>{fields(data.user.role==='student'?personal:['phone_number','department'])}</Card>
      {data.user.role==='student'&&<>
        <Card className="space-y-3 p-5"><h2>Enrollment</h2><p>Course: {data.cohort?.course_name||'Not assigned'}</p><p>Cohort: {data.cohort?.name||'Not assigned'}</p></Card>
        <Card className="space-y-4 p-5"><h2>Parent or guardian</h2>{fields(guardian)}</Card>
        <Card className="space-y-4 p-5"><h2>Certificate information</h2>{fields(['certificate_name'])}<p className="text-sm">The following records are managed by staff.</p>{certificate.map(key=><p key={key} className="text-sm">{label(key)}: {details[key]??'Not available yet'}</p>)}</Card>
      </>}
      {notice&&<p role="status">{notice}</p>}
      <button disabled={saving} className="rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-4 py-2 text-white disabled:opacity-50">{saving?'Saving…':'Save profile'}</button>
    </form>}
  </div>
}
