import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/primitives'
import { cohortRequest } from '@/lib/cohorts'

const personal = ['first_name','middle_name','last_name','date_of_birth','gender','phone_number','home_address','state','lga','city_town']
const guardian = ['guardian_first_name','guardian_last_name','guardian_relationship','guardian_phone','guardian_alt_phone','guardian_email','guardian_address']
const certificate = ['certificate_name','certificate_number','final_score','completion_status','training_start_date','training_completion_date','certificate_issue_date','total_training_hours']
type RecordData = {student:{full_name:string;email:string;organization?:string;track?:string;cohort?:string};details:Record<string,string|number|null>|null;photo:string|null}
export function StudentProfileRecord({accountId}:{accountId:string}) {
  const [data,setData] = useState<RecordData|null>(null)
  const [error,setError] = useState('')
  useEffect(()=>{
    let active=true
    setData(null);setError('')
    const load=()=>cohortRequest<RecordData>(`/api/students/${encodeURIComponent(accountId)}`).then(value=>{if(active){setData(value);setError('')}}).catch(err=>{if(active)setError(err.message)})
    void load()
    const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void load()},30000)
    window.addEventListener('focus',load)
    return()=>{active=false;window.clearInterval(timer);window.removeEventListener('focus',load)}
  },[accountId])
  if(!data)return <Card className="mt-6 p-5"><h2>Student Profile</h2><p>{error||'Loading student profile…'}</p></Card>
  const details=data.details??{}
  const required=personal.filter(key=>key!=='middle_name')
  const completion=Math.round((required.filter(key=>String(details[key]??'').trim()).length+(data.photo?1:0))/(required.length+1)*100)
  const section=(title:string,keys:string[]) => <Card className="p-5"><h3 className="font-semibold">{title}</h3><dl className="mt-3 grid gap-3 sm:grid-cols-2">{keys.map(key=><div key={key}><dt className="text-xs text-[var(--color-ink-500)]">{key.split('_').join(' ')}</dt><dd className="text-sm">{details[key]===null||details[key]===undefined||details[key]===''?'Not available yet':String(details[key])}</dd></div>)}</dl></Card>
  return <section className="mt-6 space-y-4"><h2 className="font-display text-xl font-semibold">Student Profile</h2>{error&&<p role="alert">{error}</p>}<Card className="p-5 space-y-2">{data.photo&&<img src={data.photo} alt="Student profile" className="h-24 w-24 rounded-full object-cover"/>}<p className="font-semibold">{data.student.full_name}</p><p>{data.student.email}</p><p>Role: Student</p><p>Organization: {data.student.organization||'Ijesha Digital Hub'}</p><p>Profile Completion: {completion}%</p>{completion<100&&<p>Complete all required personal details and add a profile photo to finish setting up your profile.</p>}</Card>{section('Personal Details',personal)}<Card className="p-5"><h3 className="font-semibold">Enrollment</h3><p>Course: {data.student.track||'Not assigned'}</p><p>Cohort: {data.student.cohort||'Not assigned'}</p></Card>{section('Parent or Guardian',guardian)}{section('Certificate Information — managed by staff',certificate)}</section>
}
