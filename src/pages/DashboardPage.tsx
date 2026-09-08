import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Award, Bell, BookOpen, CalendarDays, ClipboardCheck, FolderKanban, RefreshCw, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/shell/PageHeader'
import { Badge, Card, ProgressRing, SectionHeading } from '@/components/ui/primitives'
import { StatCard } from '@/components/dashboard/blocks'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { useAuth } from '@/app/auth'
import { officialCourses } from '@/lib/courses'
import { AdminDashboard } from '@/pages/dashboards/AdminDashboard'
import { ManagerDashboard } from '@/pages/dashboards/ManagerDashboard'
import { TrainerDashboard } from '@/pages/dashboards/TrainerDashboard'
import { ParentDashboard } from '@/pages/dashboards/ParentDashboard'
import { SponsorDashboard } from '@/pages/dashboards/SponsorDashboard'

type StudentView={name:string;photo:string|null;course:string;cohort:string;enrolled:string;progress:number;attendance:number;score:number;certificateName:string;certificateNumber:string|null;completion:string|null;complete:boolean}
const blank:StudentView={name:'',photo:null,course:'Not enrolled yet',cohort:'Not assigned yet',enrolled:'',progress:0,attendance:0,score:0,certificateName:'',certificateNumber:null,completion:null,complete:false}

export function DashboardPage(){
  const {profile,role}=useAuth()
  switch (role) {
    case 'admin': return <AdminDashboard />
    case 'manager': return <ManagerDashboard />
    case 'trainer': return <TrainerDashboard />
    case 'parent': return <ParentDashboard />
    case 'sponsor': return <SponsorDashboard />
    case 'student': return profile ? <StudentDashboard/> : <GeneralDashboard/>
    default: return <GeneralDashboard />
  }
}

function StudentDashboard(){
  const { profile, session } = useAuth();
  const [view, setView] = useState<StudentView>(blank);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);

    if (!supabaseConfigured) {
      setView({
        name: profile.full_name || 'Student',
        photo: null,
        course: '—',
        cohort: '—',
        enrolled: profile.created_at || '',
        progress: 0,
        attendance: 0,
        score: 0,
        certificateName: profile.full_name || '',
        certificateNumber: null,
        completion: null,
        complete: false,
      });
      setLoading(false);
      return;
    }

    try {
      const student = await supabase.from('students').select('id,full_name').eq('profile_id', profile.id).maybeSingle();
      let studentData = student.data;
      if (!studentData) {
        try {
          const { data: created } = await supabase.from('students').upsert({
            profile_id: profile.id,
            full_name: profile.full_name,
            email: (session?.user?.email ?? '').toLowerCase(),
            track: (session?.user?.user_metadata?.track as string) || null,
            status: 'active',
          }, { onConflict: 'profile_id' }).select('id,full_name').maybeSingle();
          studentData = created || { id: profile.id, full_name: profile.full_name };
        } catch {
          studentData = { id: profile.id, full_name: profile.full_name };
        }
      }
      const sid = studentData.id;
      const [details, enrollment, progress, attendance, results] = await Promise.all([
        supabase.from('student_profile_details').select('*').eq('student_id', sid).maybeSingle(),
        supabase.from('enrollments').select('created_at,completion_status,cohorts(name,courses(name))').eq('student_id', sid).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('student_progress').select('progress_percent').eq('student_id', sid).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('attendance').select('status').eq('student_id', sid),
        supabase.from('assessment_results').select('score,assessments(maximum_score)').eq('student_id', sid),
      ]);
      const d = details.data as Record<string, string | null> | null;
      const e = enrollment.data as unknown as { created_at: string; completion_status: string; cohorts: { name?: string; courses?: { name?: string } } | null } | null;
      const att = attendance.data ?? [];
      const attendancePercent = att.length ? Math.round(100 * att.filter(x => x.status === 'present' || x.status === 'late').length / att.length) : 0;
      const rows = results.data as unknown as { score: number | null; assessments: { maximum_score: number } | null }[] ?? [];
      const graded = rows.filter(x => x.score !== null && x.assessments?.maximum_score);
      const score = graded.length ? Math.round(graded.reduce((sum, x) => sum + Number(x.score) / Number(x.assessments!.maximum_score) * 100, 0) / graded.length) : 0;
      let photo: string | null = null;
      if (d?.photo_path) {
        const signed = await supabase.storage.from('student-photos').createSignedUrl(d.photo_path, 3600);
        if (!signed.error) photo = signed.data.signedUrl;
      }
      const needed = [d?.first_name, d?.last_name, d?.date_of_birth, d?.gender, d?.phone_number, d?.home_address, d?.state, d?.lga, d?.city_town, d?.photo_path];
      setView({
        name: studentData.full_name,
        photo,
        course: e?.cohorts?.courses?.name ?? '—',
        cohort: e?.cohorts?.name ?? '—',
        enrolled: e?.created_at ?? profile.created_at,
        progress: Number(progress.data?.progress_percent ?? 0),
        attendance: attendancePercent,
        score,
        certificateName: d?.certificate_name ?? '',
        certificateNumber: d?.certificate_number ?? null,
        completion: d?.completion_status ?? e?.completion_status ?? null,
        complete: needed.every(Boolean),
      });
    } catch (err: any) {
      console.warn('StudentDashboard fetch fallback:', err);
      setView({
        name: profile.full_name || 'Student',
        photo: null,
        course: '—',
        cohort: '—',
        enrolled: profile.created_at || '',
        progress: 0,
        attendance: 0,
        score: 0,
        certificateName: profile.full_name || '',
        certificateNumber: null,
        completion: null,
        complete: false,
      });
    } finally {
      setLoading(false);
    }
  }, [profile, session]);

  useEffect(() => { load() }, [load]);
  if (loading) return <p className="py-8 text-center text-sm text-[var(--color-ink-400)]">Loading your dashboard…</p>;
  return <div><PageHeader title="Student Dashboard" subtitle="Track your training progress and certificate readiness." actions={<button onClick={load} className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm font-medium"><RefreshCw size={15}/>Refresh</button>}/>{error&&<Card className="mb-5 border-[var(--color-danger-100)] p-4 text-sm text-[var(--color-danger-600)]">{error}</Card>}{!view.complete&&<Card className="mb-5 flex gap-3 border-[var(--color-warning-100)] p-4"><AlertTriangle className="shrink-0 text-[var(--color-warning-600)]"/><div><p className="font-medium">Your profile is incomplete</p><p className="mt-1 text-sm text-[var(--color-ink-500)]">Add your personal information and student photo so the training team can complete your record.</p><Link to="/profile" className="mt-2 inline-block text-sm font-semibold text-[var(--color-harbor-600)]">Complete my profile</Link></div></Card>}<div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]"><Card className="p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className="h-28 w-28 shrink-0 overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-ink-100)]">{view.photo?<img src={view.photo} alt="Student profile" className="h-full w-full object-cover"/>:<div className="flex h-full items-center justify-center text-2xl font-semibold text-[var(--color-harbor-600)]">{view.name.slice(0,1)}</div>}</div><div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-harbor-600)]">Student name</p><h2 className="mt-1 font-display text-2xl font-semibold">{view.name}</h2><p className="mt-1 text-sm text-[var(--color-ink-600)]">{view.course} · {view.cohort}</p><Badge tone={view.completion==='completed'?'success':'harbor'}>{view.completion??'In progress'}</Badge></div><div className="border-l border-[var(--color-line)] pl-4 text-sm"><p className="flex items-center gap-2 text-[var(--color-ink-500)]"><CalendarDays size={16}/>Enrollment date</p><p className="mt-1 font-medium">{date(view.enrolled)}</p><p className="mt-3 flex items-center gap-2 text-[var(--color-ink-500)]"><Award size={16}/>Certificate</p><p className="mt-1 font-medium">{view.certificateNumber??'Not issued yet'}</p></div></div></Card><Card className="p-5"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-harbor-600)]">Training overview</p><p className="mt-2 font-display text-3xl font-semibold">{Math.round(view.progress)}%</p><p className="text-sm text-[var(--color-ink-500)]">Overall course progress</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-ink-100)]"><div className="h-full rounded-full bg-[var(--color-harbor-500)]" style={{width:`${view.progress}%`}}/></div></Card></div><Card className="mt-5 p-5"><SectionHeading eyebrow="Performance overview" title="Your current results"/><div className="grid gap-4 md:grid-cols-3"><Metric icon={ClipboardCheck} label="Attendance" value={`${view.attendance}%`} tone="success"/><Metric icon={BookOpen} label="Assessment score" value={`${view.score}%`} tone="harbor"/><Metric icon={FolderKanban} label="Projects & assignments" value="View learning" tone="ember"/></div></Card><div className="mt-5 grid gap-5 lg:grid-cols-2"><Card className="p-5"><SectionHeading eyebrow="Course details" title="Your enrollment"/><dl className="space-y-3 text-sm"><Row label="Course/program" value={view.course}/><Row label="Cohort" value={view.cohort}/><Row label="Enrollment date" value={date(view.enrolled)}/><Row label="Progress" value={`${Math.round(view.progress)}%`}/></dl></Card><Card className="p-5"><SectionHeading eyebrow="Certification status" title={view.completion==='completed'?'Ready for review':'In progress'}/><div className="flex items-center gap-5"><ProgressRing value={view.completion==='completed'?100:view.progress} tone={view.completion==='completed'?'success':'harbor'}/><div className="text-sm"><p className="font-medium">{view.certificateName||'Certificate name not confirmed'}</p><p className="mt-1 text-[var(--color-ink-500)]">{view.certificateNumber?`Certificate number: ${view.certificateNumber}`:'Certificate is issued by the administration after completion.'}</p><Link to="/profile" className="mt-3 inline-block font-medium text-[var(--color-harbor-600)]">View certificate details</Link></div></div></Card></div></div>
}

function Metric({icon:Icon,label,value,tone}:{icon:typeof Users;label:string;value:string;tone:'success'|'harbor'|'ember'}){const color=tone==='success'?'text-[var(--color-success-600)]':tone==='ember'?'text-[var(--color-ember-600)]':'text-[var(--color-harbor-600)]';return <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-4"><Icon size={19} className={color}/><p className="mt-3 text-xs text-[var(--color-ink-500)]">{label}</p><p className={`mt-1 font-display text-2xl font-semibold ${color}`}>{value}</p></div>};function Row({label,value}:{label:string;value:string}){return <div className="flex items-center justify-between gap-4 border-b border-[var(--color-line)] pb-3 last:border-0"><dt className="text-[var(--color-ink-500)]">{label}</dt><dd className="font-medium text-right">{value}</dd></div>};function date(value:string){return value?new Date(value).toLocaleDateString():'—'}

function GeneralDashboard(){
  const { user, role } = useAuth();
  const [counts, setCounts] = useState({ students: 0, courses: 0, attendance: 0, notifications: 0 });

  const refresh = useCallback(async () => {
    if (!supabaseConfigured) {
      setCounts({ students: 0, courses: 0, attendance: 0, notifications: 0 });
      return;
    }
    try {
      const [a, b, c, d] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }),
        supabase.from('courses').select('id,name'),
        supabase.from('attendance').select('*', { count: 'exact', head: true }),
        supabase.from('notifications').select('*', { count: 'exact', head: true }).is('read_at', null),
      ]);
      setCounts({
        students: a.count ?? 0,
        courses: officialCourses(b.data ?? []).length,
        attendance: c.count ?? 0,
        notifications: d.count ?? 0,
      });
    } catch {
      setCounts({ students: 0, courses: 0, attendance: 0, notifications: 0 });
    }
  }, []);

  useEffect(() => { refresh() }, [refresh]);
  return <div><PageHeader title={`Welcome, ${user?.name.split(' ')[0] ?? ''}`} subtitle={`A live view of ${role ?? 'your'} workspace.`} actions={<button onClick={refresh} className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm font-medium"><RefreshCw size={15}/>Refresh</button>}/><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Authorized students" value={String(counts.students)} icon={Users}/><StatCard label="Available courses" value={String(counts.courses)} icon={BookOpen}/><StatCard label="Attendance records" value={String(counts.attendance)} icon={ClipboardCheck}/><StatCard label="Unread notifications" value={String(counts.notifications)} icon={Bell}/></div></div>
}
