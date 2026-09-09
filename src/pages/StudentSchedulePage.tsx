import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/shell/PageHeader'
import { Card } from '@/components/ui/primitives'
import { cohortRequest } from '@/lib/cohorts'
export function StudentSchedulePage() {
  const [sessions,setSessions]=useState<{id:string;topic:string;starts_at:string;ends_at:string|null;status:string;week_number?:number}[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  useEffect(()=>{let active=true;cohortRequest<{sessions:typeof sessions}>('/api/student/cohort').then(r=>{if(active)setSessions(r.sessions)}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[])
  return <div className="space-y-4"><PageHeader title="My Schedule" subtitle="Training sessions for your assigned cohort."/>
    {error&&<p role="alert" className="text-[var(--color-danger-600)]">{error}</p>}
    {loading?<p>Loading schedule…</p>:sessions.length?sessions.map(s=><Card key={s.id} className="p-4"><h2 className="font-semibold">{s.topic}</h2><p>{s.week_number?'Week '+s.week_number+' · ':''}{new Date(s.starts_at).toLocaleString()}</p><p>{s.status}</p></Card>):<Card className="p-5">No sessions scheduled for your cohort yet.</Card>}
  </div>
}
