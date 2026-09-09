import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/primitives'
import { PageHeader } from '@/components/shell/PageHeader'
import { cohortRequest } from '@/lib/cohorts'
type Summary = {
  cohort:{name:string;course_name:string}|null
  attendance:{status:string}[]
  courses:{id:string;title:string;description:string}[]
  items:{id:string;title:string;maximum_score:number}[]
  submissions:{id:string;item_id:string;submitted_at:string|null;score:number|null;feedback:string|null}[]
}
export function StudentLearningSummary({view='Dashboard'}:{view?:string}) {
  const [data,setData]=useState<Summary|null>(null)
  const [error,setError]=useState('')
  useEffect(()=>{let active=true;cohortRequest<Summary>('/api/student/summary').then(d=>{if(active)setData(d)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[])
  if(error)return <p role="alert" className="text-[var(--color-danger-600)]">{error}</p>
  if(!data)return <p>Loading…</p>
  const submitted=data.submissions.filter(s=>s.submitted_at)
  const graded=submitted.filter(s=>s.score!=null)
  const percent=data.items.length?Math.round(submitted.length/data.items.length*100):0
  return <div className="space-y-5"><PageHeader title={view} subtitle={data.cohort?data.cohort.course_name+' · '+data.cohort.name:'Your account has no cohort assignment yet.'}/>
    {view==='My Courses'?data.courses.length?data.courses.map(c=><Card key={c.id} className="p-5"><h2 className="font-semibold">{c.title}</h2><p>{c.description}</p><Link to="/classwork" className="text-[var(--color-harbor-600)]">Open learning work →</Link></Card>):<Card className="p-5">No published course assigned yet.</Card>:
    view==='Results'||view==='Grades & Feedback'?graded.length?graded.map(s=><Card key={s.id} className="p-5"><h2 className="font-semibold">{data.items.find(i=>i.id===s.item_id)?.title}</h2><p>Score: {s.score} / {data.items.find(i=>i.id===s.item_id)?.maximum_score}</p><p className="whitespace-pre-wrap">{s.feedback||'No feedback added.'}</p></Card>):<Card className="p-5">No graded submissions yet.</Card>:
    <><Card className="p-5"><h2 className="font-semibold">Learning work submitted</h2><p>{percent}% · {submitted.length} of {data.items.length} published tasks</p><p>{graded.length} graded submissions</p></Card><Card className="p-5"><h2 className="font-semibold">Recorded attendance</h2><p>{data.attendance.filter(a=>a.status==='present'||a.status==='late').length} attended of {data.attendance.length} recorded sessions</p></Card><div className="flex flex-wrap gap-4"><Link to="/my-schedule">My Schedule</Link><Link to="/classwork">Classwork</Link><Link to="/assignments">Assignments</Link><Link to="/results">Results</Link></div></>}
  </div>
}
