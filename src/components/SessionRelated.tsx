import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/primitives'
import { cohortRequest } from '@/lib/cohorts'

type Related = { resources: {id:string;kind:string;title:string;content:string}[]; work:{id:string;item_type:string;title:string;instructions:string}[]; attendance:{id:string;status?:string;students?:{full_name:string}}[] }
const tabs = ['Attendance','Classwork','Assignments','Materials','Notes'] as const
export function SessionRelated({sessionId}:{sessionId:string}) {
  const [tab,setTab]=useState<string>('Attendance')
  const [data,setData]=useState<Related>({resources:[],work:[],attendance:[]})
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(true)
  const [title,setTitle]=useState('')
  const [content,setContent]=useState('')
  const [saving,setSaving]=useState(false)
  async function load() {
    setLoading(true);setError('')
    try{setData(await cohortRequest<Related>('/api/sessions/'+sessionId+'/related'))}
    catch(e){setError(e instanceof Error?e.message:'Unable to load session records.')}
    finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[sessionId])
  async function save() {
    if(!title.trim() || saving)return
    setSaving(true);setError('')
    try{
      const kind=tab==='Classwork'?'classwork':tab==='Assignments'?'assignment':tab==='Materials'?'material':'note'
      await cohortRequest('/api/sessions/'+sessionId+'/related',{method:'POST',body:JSON.stringify({kind,title,content})})
      setTitle('');setContent('');await load()
    }catch(e){setError(e instanceof Error?e.message:'Unable to save.')}
    finally{setSaving(false)}
  }
  const rows=tab==='Classwork'||tab==='Assignments'
    ?data.work.filter(w=>w.item_type===(tab==='Classwork'?'classwork':'assignment')).map(w=>({id:w.id,title:w.title,content:w.instructions}))
    :data.resources.filter(r=>r.kind===(tab==='Materials'?'material':'note'))
  return <Card className="p-5 space-y-4">
    <nav aria-label="Session sections" className="flex flex-wrap gap-3">{tabs.map(t=><button type="button" key={t} aria-pressed={tab===t} className={tab===t?'font-bold text-[var(--color-harbor-600)]':'text-[var(--color-ink-600)]'} onClick={()=>{setTab(t);setTitle('');setContent('')}}>{t}</button>)}</nav>
    {error&&<p role="alert" className="text-[var(--color-danger-600)]">{error}</p>}
    {loading?<p>Loading…</p>:tab==='Attendance'?data.attendance.length?<ul>{data.attendance.map(a=><li key={a.id}>{a.students?.full_name??'Student'} — {a.status??'Recorded'}</li>)}</ul>:<p>No attendance recorded for this session.</p>:<><ul className="space-y-3">{rows.map(r=><li key={r.id}><h3 className="font-semibold">{r.title}</h3><p className="whitespace-pre-wrap">{r.content}</p></li>)}</ul>{!rows.length&&<p>No {tab.toLowerCase()} for this session yet.</p>}
    <form className="space-y-3" onSubmit={e=>{e.preventDefault();void save()}}><label className="block">Title<input required className="input" value={title} onChange={e=>setTitle(e.target.value)}/></label><label className="block">{tab==='Materials'?'Material details / link':'Content'}<textarea className="input min-h-24" value={content} onChange={e=>setContent(e.target.value)}/></label><button disabled={saving} className="rounded-lg bg-[var(--color-harbor-600)] px-4 py-2 text-white">{saving?'Saving…':'Add '+tab}</button></form></>}
  </Card>
}
