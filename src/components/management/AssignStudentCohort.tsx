import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Field } from '@/components/ui/Field'
import { cohortRequest, getAllCohorts, type Cohort } from '@/lib/cohorts'

export function AssignStudentCohort({accountId}:{accountId:string}) {
  const [open,setOpen]=useState(false)
  const [cohorts,setCohorts]=useState<Cohort[]>([])
  const [course,setCourse]=useState('')
  const [cohort,setCohort]=useState('')
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [loading,setLoading]=useState(false)
  const [saving,setSaving]=useState(false)
  async function begin() {
    setOpen(true);setLoading(true);setError('');setNotice('');setCourse('');setCohort('')
    try{setCohorts((await getAllCohorts()).filter(c=>c.app_course_id))}
    catch(e){setError(e instanceof Error?e.message:'Unable to load cohorts.')}
    finally{setLoading(false)}
  }
  async function save() {
    setSaving(true);setError('')
    try{
      await cohortRequest('/api/admin/accounts/'+accountId+'/cohort',{method:'PATCH',body:JSON.stringify({cohortId:cohort})})
      setNotice('Student assigned successfully. Refresh the student account to see its cohort and learning work.')
      setOpen(false)
    }catch(e){setError(e instanceof Error?e.message:'Unable to assign cohort.')}
    finally{setSaving(false)}
  }
  const courses=[...new Map(cohorts.map(c=>[c.app_course_id!,c.course_name])).entries()]
  return <div><button className="rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm" onClick={()=>void begin()}>Assign Cohort</button>
    {notice&&<p role="status" className="mt-2 text-sm text-[var(--color-success-600)]">{notice}</p>}
    {open&&<Modal title="Assign Student to Cohort" onClose={()=>{if(!saving)setOpen(false)}}>
      <form className="space-y-4" onSubmit={e=>{e.preventDefault();void save()}}>
        {error&&<p role="alert" className="text-[var(--color-danger-600)]">{error}</p>}
        {loading?<p>Loading cohorts…</p>:<>
          <Field label="Course"><select required className="input" value={course} onChange={e=>{setCourse(e.target.value);setCohort('')}}><option value="">Choose course</option>{courses.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></Field>
          <Field label="Cohort"><select required disabled={!course} className="input" value={cohort} onChange={e=>setCohort(e.target.value)}><option value="">Choose cohort</option>{cohorts.filter(c=>c.app_course_id===course).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          {!cohorts.length&&<p>Create a cohort linked to a course first.</p>}
          <p className="text-sm">This becomes the student's active cohort. Existing enrollment history is kept.</p>
        </>}
        <div className="flex justify-end gap-3"><button type="button" disabled={saving} onClick={()=>setOpen(false)}>Cancel</button><button disabled={saving||loading||!cohort} className="rounded-lg bg-[var(--color-harbor-600)] px-4 py-2 text-white disabled:opacity-50">{saving?'Assigning…':'Assign Cohort'}</button></div>
      </form>
    </Modal>}
  </div>
}
