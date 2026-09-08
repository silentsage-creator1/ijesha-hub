export interface NotificationItem {
  id: string
  title: string
  detail: string
  time: string
  unread: boolean
  kind: 'celebration' | 'alert' | 'info'
}

export const NOTIFICATIONS: NotificationItem[] = []
