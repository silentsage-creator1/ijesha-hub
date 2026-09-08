import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/shell/PageHeader'
import { Card } from '@/components/ui/primitives'
import { useAuth } from '@/app/auth'
import {
  getNotificationsForUser,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  type AppNotification,
} from '@/lib/notifications'

export function NotificationsPage() {
  const { role, profile } = useAuth()
  const navigate = useNavigate()
  const [rows, setRows] = useState<AppNotification[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      const items = await getNotificationsForUser(role, profile?.id)
      setRows(items)
    } catch (err: any) {
      setError(err?.message || 'Failed to load notifications')
    }
  }

  useEffect(() => {
    load()
    window.addEventListener('app-notifications-updated', load)
    return () => {
      window.removeEventListener('app-notifications-updated', load)
    }
  }, [role, profile?.id])

  const mark = async (item?: AppNotification) => {
    if (!item) {
      await markAllNotificationsAsRead(role, profile?.id)
      const now = new Date().toISOString()
      setRows((current) => current.map((row) => ({ ...row, read_at: row.read_at ?? now })))
    } else {
      await markNotificationAsRead(item.id)
      const now = new Date().toISOString()
      setRows((current) =>
        current.map((row) => (row.id === item.id ? { ...row, read_at: now } : row))
      )
      if (item.href) {
        navigate(item.href)
      }
    }
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Your saved account and learning updates."
        actions={
          <button
            onClick={() => mark()}
            className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm font-medium hover:bg-white transition-colors"
          >
            Mark all read
          </button>
        }
      />
      {error && <p className="mb-4 text-sm text-[var(--color-danger-600)]">{error}</p>}
      <Card>
        <ul className="divide-y divide-[var(--color-line)]">
          {rows.length ? (
            rows.map((row) => (
              <li
                key={row.id}
                className={`p-4 transition-colors hover:bg-[var(--color-paper)]/50 ${
                  !row.read_at ? 'bg-[var(--color-harbor-100)]/30' : ''
                }`}
              >
                <button onClick={() => mark(row)} className="w-full text-left">
                  <p className="font-medium text-[var(--color-ink-900)]">{row.title}</p>
                  {row.body && (
                    <p className="mt-1 text-sm text-[var(--color-ink-600)]">{row.body}</p>
                  )}
                  <p className="mt-1 text-xs text-[var(--color-ink-400)]">
                    {new Date(row.created_at).toLocaleString()}
                  </p>
                </button>
              </li>
            ))
          ) : (
            <li className="p-8 text-center text-sm text-[var(--color-ink-400)]">
              No notifications yet.
            </li>
          )}
        </ul>
      </Card>
    </div>
  )
}
