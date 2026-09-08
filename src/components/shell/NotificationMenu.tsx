import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useClickOutside } from '@/hooks/useClickOutside'
import { clsx } from '@/lib/clsx'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/auth'
import {
  getNotificationsForUser,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  type AppNotification,
} from '@/lib/notifications'

export function NotificationMenu() {
  const { role, profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AppNotification[]>([])
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  useClickOutside(ref, () => setOpen(false), open)
  const unreadCount = items.filter((n) => !n.read_at).length

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const notifs = await getNotificationsForUser(role, profile?.id)
      if (!cancelled) setItems(notifs)
    }

    load()

    // Listen for custom app notification dispatch events and cross-tab storage changes
    window.addEventListener('app-notifications-updated', load)
    window.addEventListener('storage', load)

    const channel = supabase
      .channel('own-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, load)
      .subscribe()

    return () => {
      cancelled = true
      window.removeEventListener('app-notifications-updated', load)
      window.removeEventListener('storage', load)
      supabase.removeChannel(channel)
    }
  }, [role, profile?.id])

  async function openNotification(notification: AppNotification) {
    if (!notification.read_at) {
      await markNotificationAsRead(notification.id)
      setItems((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item
        )
      )
    }
    setOpen(false)
    if (notification.href) navigate(notification.href)
  }

  async function markAllRead() {
    await markAllNotificationsAsRead(role, profile?.id)
    const now = new Date().toISOString()
    setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? now })))
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications, ${unreadCount} unread`}
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-ink-600)] hover:bg-[var(--color-ink-50)]"
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--color-ember-500)] ring-2 ring-white" />
        )}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-80 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white shadow-[var(--shadow-pop)]"
        >
          <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3">
            <p className="font-display text-sm font-semibold text-[var(--color-ink-900)]">
              Notifications
            </p>
            <button
              onClick={markAllRead}
              disabled={!unreadCount}
              className="text-xs font-medium text-[var(--color-harbor-500)] disabled:text-[var(--color-ink-300)]"
            >
              Mark all read
            </button>
          </div>
          <ul className="scrollbar-thin max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-[var(--color-ink-400)]">
                You’re all caught up.
              </li>
            ) : (
              items.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => openNotification(n)}
                    className={clsx(
                      'w-full border-b border-[var(--color-line)] px-4 py-3 text-left last:border-0 hover:bg-[var(--color-ink-50)]',
                      !n.read_at && 'bg-[var(--color-harbor-100)]/30'
                    )}
                  >
                    <p className="text-sm font-medium text-[var(--color-ink-900)]">{n.title}</p>
                    {n.body && <p className="text-xs text-[var(--color-ink-500)] mt-0.5">{n.body}</p>}
                    <p className="mt-1 text-[11px] text-[var(--color-ink-400)]">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
