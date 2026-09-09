import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, BookOpen } from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import { Badge, Card } from '@/components/ui/primitives'
import { apiUrl } from '@/app/auth'

type Course = { id: string; title: string; description: string; level: string | null; status: 'Draft' | 'Published'; content?: unknown[]; cohort_id: string | null; trainer_id: string | null }

export function AppCourseDetailPage() {
  const { id } = useParams()
  const [course, setCourse] = useState<Course | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { void (async () => { try { const response = await fetch(apiUrl('/api/courses'), { credentials: 'include' }); const payload = await response.json() as { courses?: Course[]; error?: string }; if (!response.ok) throw new Error(payload.error || 'Unable to load course.'); setCourse((payload.courses ?? []).find((item) => item.id === id) ?? null) } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Unable to load course.') } })() }, [id])
  if (error) return <p className="text-sm text-[var(--color-danger-700)]">{error}</p>
  if (!course) return <Card className="p-6 text-sm text-[var(--color-ink-500)]">Loading course…</Card>
  const modules = Array.isArray(course.content) ? course.content : []
  return <div className="space-y-6"><Link to="/courses" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-harbor-700)]"><ArrowLeft size={16} /> Back to courses</Link><PageHeader title={course.title} subtitle={course.description || 'No course description provided.'} /><Card className="p-5"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm text-[var(--color-ink-600)]"><BookOpen size={17} /> {course.level || 'Level not set'} · {course.cohort_id ? 'Cohort assigned' : 'No cohort assigned'}</div><Badge tone={course.status === 'Published' ? 'success' : 'neutral'}>{course.status}</Badge></div></Card><Card className="p-5"><h2 className="font-display font-bold text-[var(--color-ink-900)]">Course content</h2>{modules.length ? <ol className="mt-4 space-y-2">{modules.map((module, index) => <li key={index} className="rounded-lg border border-[var(--color-line)] p-3 text-sm text-[var(--color-ink-700)]">{typeof module === 'object' && module && 'title' in module ? String(module.title) : `Module ${index + 1}`}</li>)}</ol> : <p className="mt-2 text-sm text-[var(--color-ink-500)]">No learning content has been added yet.</p>}</Card></div>
}
