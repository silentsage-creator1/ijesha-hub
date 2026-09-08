import { useRef, useState } from 'react'
import { ChevronDown, LogOut, Settings, UserCircle } from 'lucide-react'
import { useAuth } from '@/app/auth'
import { supabaseConfigured } from '@/lib/supabase'
import { useClickOutside } from '@/hooks/useClickOutside'
import { Avatar } from '@/components/ui/primitives'
import { ROLES } from '@/data/navigation'
import { Link } from 'react-router-dom'

export function UserMenu() {
  const { user, role, signOut, quickSignIn } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false), open)

  if (!user) return null

  const roleLabel = ROLES.find((r) => r.id === role)?.label ?? role

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Open account menu"
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-[var(--color-ink-50)]"
      >
        <Avatar initials={user.initials} size={32} />
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-sm font-medium text-[var(--color-ink-900)]">{user.name}</span>
          <span className="block text-xs text-[var(--color-ink-400)]">{roleLabel}</span>
        </span>
        <ChevronDown size={16} className="hidden text-[var(--color-ink-400)] sm:block" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-64 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white shadow-[var(--shadow-pop)]"
        >
          <div className="border-b border-[var(--color-line)] px-4 py-3">
            <p className="text-sm font-medium text-[var(--color-ink-900)]">{user.name}</p>
            <p className="text-xs text-[var(--color-ink-400)]">{roleLabel}{user.org ? ` · ${user.org}` : ''}</p>
          </div>

          <div className="p-1.5">
            <MenuLink icon={UserCircle} label="My profile" to="/profile" />
            <MenuLink icon={Settings} label="Settings" to="/settings" />

            {!supabaseConfigured && (
              <div className="border-t border-[var(--color-line)] my-1.5 pt-2 px-2">
                <p className="px-1 mb-1.5 text-[10px] font-bold text-[var(--color-ink-400)] uppercase tracking-wider">
                  Switch Demo Role
                </p>
                <div className="grid grid-cols-2 gap-1 pb-1">
                  {(['admin', 'trainer', 'student', 'manager', 'parent', 'sponsor'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        setOpen(false)
                        quickSignIn(r)
                      }}
                      className={`rounded px-2 py-1 text-left text-xs capitalize transition-colors ${
                        role === r
                          ? 'bg-[var(--color-harbor-100)] font-semibold text-[var(--color-harbor-700)]'
                          : 'text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => signOut()}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-[var(--color-danger-600)] hover:bg-[var(--color-danger-100)]"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function MenuLink({ icon: Icon, label, to }: { icon: typeof UserCircle; label: string; to: string }) {
  return (
    <Link to={to} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]">
      <Icon size={16} className="text-[var(--color-ink-400)]" />
      {label}
    </Link>
  )
}
