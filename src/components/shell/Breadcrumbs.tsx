import { Link, useLocation } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { NAVIGATION } from '@/data/navigation'

function findLabel(path: string): string | null {
  for (const section of NAVIGATION) {
    for (const item of section.items) {
      if (item.path === path) return item.label
    }
  }
  return null
}

export function Breadcrumbs() {
  const { pathname } = useLocation()

  if (pathname === '/') {
    return (
      <nav aria-label="Breadcrumb" className="text-sm text-[var(--color-ink-400)]">
        Overview
      </nav>
    )
  }

  const label = findLabel(pathname) ?? 'Page'

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-[var(--color-ink-400)]">
      <Link to="/" className="hover:text-[var(--color-ink-700)]">
        Dashboard
      </Link>
      <ChevronRight size={14} />
      <span className="font-medium text-[var(--color-ink-700)]" aria-current="page">
        {label}
      </span>
    </nav>
  )
}
