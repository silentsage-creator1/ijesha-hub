import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { X } from 'lucide-react'
import { navigationForRole } from '@/data/navigation'
import { useAuth } from '@/app/auth'
import { ICONS } from '@/lib/icons'
import { clsx } from '@/lib/clsx'
import { getPendingVerificationsCount } from '@/lib/notifications'

export function Sidebar({ onNavigate, onClose }: { onNavigate?: () => void; onClose?: () => void }) {
  const { role } = useAuth()
  const sections = role ? navigationForRole(role) : []
  const [pendingVerificationsCount, setPendingVerificationsCount] = useState(() => {
    return role === 'admin' || role === 'manager' ? getPendingVerificationsCount() : 0
  })

  useEffect(() => {
    if (role !== 'admin' && role !== 'manager') return
    const updateCount = () => {
      setPendingVerificationsCount(getPendingVerificationsCount())
    }
    updateCount()
    window.addEventListener('app-notifications-updated', updateCount)
    window.addEventListener('storage', updateCount)
    return () => {
      window.removeEventListener('app-notifications-updated', updateCount)
      window.removeEventListener('storage', updateCount)
    }
  }, [role])

  return (
    <div className="flex h-full w-full flex-col bg-[var(--color-ink-900)] text-[var(--color-ink-100)]">
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <img src="/ijesha-logo.jpeg" alt="Ijesha Digital Hub logo" className="h-12 w-12 shrink-0 rounded-full object-contain" />
          <div className="leading-tight">
            <p className="font-display text-sm font-semibold text-white">IJESHA DIGITAL HUB</p>
            <p className="text-[11px] text-[var(--color-ink-400)]">Digital Training Platform</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-md p-1.5 text-[var(--color-ink-300)] hover:bg-[var(--color-ink-800)] hover:text-white lg:hidden"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-4" aria-label="Primary">
        {sections.map((section) => (
          <div key={section.id} className="mb-5">
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = ICONS[item.icon]
                const itemBadge =
                  item.id === 'users' && pendingVerificationsCount > 0
                    ? `${pendingVerificationsCount}`
                    : item.badge

                return (
                  <li key={item.id}>
                    <NavLink
                      to={item.path}
                      end={item.path === '/'}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        clsx(
                          'flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-[var(--color-harbor-500)] text-white'
                            : 'text-[var(--color-ink-200)] hover:bg-[var(--color-ink-800)] hover:text-white',
                        )
                      }
                    >
                      {Icon && <Icon size={17} strokeWidth={2} className="shrink-0" />}
                      <span className="flex-1 truncate">{item.label}</span>
                      {itemBadge && (
                        <span className="rounded-full bg-[var(--color-ember-500)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          {itemBadge}
                        </span>
                      )}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--color-ink-800)] px-5 py-4 text-[11px] text-[var(--color-ink-400)]">
        Navigation shown reflects your role for wayfinding only — access is enforced by the server.
      </div>
    </div>
  )
}
