import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Card } from '@/components/ui/primitives'

export function NotFoundPage() {
  return (
    <div className="flex min-h-[55vh] items-center justify-center">
      <Card className="max-w-md p-8 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-harbor-100)] text-[var(--color-harbor-600)]">
          <Compass size={22} />
        </span>
        <h1 className="mt-4 font-display text-xl font-semibold text-[var(--color-ink-900)]">Page not found</h1>
        <p className="mt-2 text-sm text-[var(--color-ink-500)]">This page does not exist or is not available for your account.</p>
        <Link to="/" className="mt-5 inline-flex rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-harbor-600)]">Go to dashboard</Link>
      </Card>
    </div>
  )
}
