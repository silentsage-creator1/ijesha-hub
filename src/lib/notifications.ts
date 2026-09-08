/**
 * Notifications Management & Dispatch Service
 * Handles system alerts, admin account verification requests, and student notifications.
 */

import { supabase } from '@/lib/supabase'
import {
  addPendingStudentVerification,
  logSystemActivity,
  getPendingStudentVerifications,
} from '@/lib/management'
import type { Role } from '@/types'

export interface AppNotification {
  id: string
  user_id?: string | null
  target_role?: Role | 'all' | null
  title: string
  body: string | null
  href: string | null
  read_at: string | null
  created_at: string
}

const NOTIFICATIONS_STORE_KEY = 'ijesha_hub_notifications_v3'

/**
 * Get all stored local notifications.
 */
export function getStoredNotifications(): AppNotification[] {
  try {
    if (typeof window === 'undefined') return []
    const raw = localStorage.getItem(NOTIFICATIONS_STORE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as AppNotification[]
  } catch (err) {
    console.warn('Failed to parse notifications store:', err)
    return []
  }
}

/**
 * Save notifications to local storage and broadcast update.
 */
export function saveStoredNotifications(items: AppNotification[]) {
  try {
    if (typeof window === 'undefined') return
    localStorage.setItem(NOTIFICATIONS_STORE_KEY, JSON.stringify(items))
    window.dispatchEvent(new CustomEvent('app-notifications-updated'))
  } catch (err) {
    console.warn('Failed to save notifications store:', err)
  }
}

/**
 * Send an in-app notification.
 */
export async function sendNotification(data: {
  title: string
  body: string
  href?: string | null
  user_id?: string | null
  target_role?: Role | 'all' | null
}): Promise<AppNotification> {
  const newNotification: AppNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: data.title,
    body: data.body,
    href: data.href ?? null,
    user_id: data.user_id ?? null,
    target_role: data.target_role ?? 'all',
    read_at: null,
    created_at: new Date().toISOString(),
  }

  const existing = getStoredNotifications()
  const updated = [newNotification, ...existing]
  saveStoredNotifications(updated)

  // Try inserting into Supabase notifications table if user_id is provided
  if (data.user_id) {
    try {
      await supabase.from('notifications').insert({
        user_id: data.user_id,
        title: data.title,
        body: data.body,
        href: data.href ?? null,
      })
    } catch {
      // Offline fallback
    }
  }

  return newNotification
}

/**
 * Send account verification notification to administrators when a user creates an account.
 */
export async function sendAdminVerificationAlert(student: {
  id?: string
  fullName: string
  email: string
  track?: string
  phone?: string
}) {
  // 1. Add to Admin Pending Verifications queue
  addPendingStudentVerification({
    fullName: student.fullName,
    email: student.email,
    track: student.track,
    phone: student.phone,
  })

  // 2. Dispatch notification specifically targeting administrators
  await sendNotification({
    target_role: 'admin',
    title: `New Student Verification: ${student.fullName}`,
    body: `${student.fullName} (${student.email}) created an account for ${student.track || 'Training Track'} and is awaiting administrator verification.`,
    href: '/users?tab=verifications',
  })

  // 3. Log to system audit trail
  try {
    logSystemActivity(
      student.fullName,
      'student',
      'Account Created & Verification Sent to Admin',
      student.fullName,
      'User',
      `New student account registered for ${student.fullName} (${student.email}) in ${student.track || 'Frontend Development'}. Verification request dispatched to administrators.`
    )
  } catch (err) {
    console.warn('Could not write audit log:', err)
  }
}

/**
 * Send welcome notice to student upon account creation.
 */
export async function sendStudentWelcomeVerificationNotice(student: {
  id?: string
  fullName: string
  email: string
}) {
  await sendNotification({
    user_id: student.id,
    target_role: 'student',
    title: 'Account Created — Verification Dispatched',
    body: 'Your account has been created! A verification request has been sent to the administrator. You will be notified once reviewed and approved.',
    href: '/notifications',
  })
}

/**
 * Send approval confirmation notification to student.
 */
export async function sendStudentApprovedNotification(student: {
  id?: string
  fullName: string
  email: string
  approverName?: string
}) {
  await sendNotification({
    user_id: student.id,
    target_role: 'student',
    title: 'Account Verified & Approved!',
    body: student.approverName
      ? `Great news! Your account has been approved by ${student.approverName}. You are now fully authorized.`
      : 'Great news! Your student account has been verified and approved by the administrator. Welcome to Ijesha Digital Hub.',
    href: '/',
  })
}

/**
 * Send notification when an assignment is published.
 */
export async function sendAssignmentPublishedNotification(data: {
  assignmentTitle: string
  courseName?: string
  cohortName?: string
  dueDate?: string
}) {
  await sendNotification({
    target_role: 'student',
    title: `New Assignment: ${data.assignmentTitle}`,
    body: `A new assignment has been published for ${data.cohortName || data.courseName || 'your track'}.${data.dueDate ? ` Due: ${data.dueDate}.` : ''}`,
    href: '/assignments',
  })
}

/**
 * Send notification when classwork is published.
 */
export async function sendClassworkPublishedNotification(data: {
  classworkTitle: string
  courseName?: string
  cohortName?: string
  dueDate?: string
}) {
  await sendNotification({
    target_role: 'student',
    title: `New Classwork: ${data.classworkTitle}`,
    body: `New coursework has been posted for ${data.cohortName || data.courseName || 'your course'}.${data.dueDate ? ` Due: ${data.dueDate}.` : ''}`,
    href: '/classwork',
  })
}

/**
 * Send notification when a student submits work.
 */
export async function sendStudentSubmittedNotification(data: {
  studentName: string
  itemTitle: string
  itemType: 'Assignment' | 'Classwork' | 'Project' | 'Assessment'
  cohortName?: string
}) {
  await sendNotification({
    target_role: 'trainer',
    title: `New Submission: ${data.itemTitle}`,
    body: `${data.studentName} submitted work for ${data.itemType} "${data.itemTitle}" (${data.cohortName || 'Active Cohort'}). Awaiting review.`,
    href: data.itemType === 'Assignment' ? '/assignments' : data.itemType === 'Classwork' ? '/classwork' : '/projects',
  })
}

/**
 * Send notification when trainer provides feedback / grades a submission.
 */
export async function sendTrainerFeedbackNotification(data: {
  studentId?: string
  studentName: string
  itemTitle: string
  score: number | null
  maxScore: number
  parentId?: string
}) {
  const scoreText = data.score !== null ? `Score: ${data.score}/${data.maxScore}` : 'Feedback available'
  // Notify student
  await sendNotification({
    user_id: data.studentId,
    target_role: 'student',
    title: `Grade & Feedback: ${data.itemTitle}`,
    body: `Your trainer evaluated "${data.itemTitle}". ${scoreText}. Check Grades & Feedback for detailed remarks.`,
    href: '/grades-feedback',
  })

  // Notify linked parent if specified
  if (data.parentId) {
    await sendNotification({
      user_id: data.parentId,
      target_role: 'parent',
      title: `Academic Update: ${data.studentName}`,
      body: `${data.studentName} received evaluation for "${data.itemTitle}". ${scoreText}.`,
      href: '/parent',
    })
  }
}

/**
 * Send notification for attendance status alerts (absent, late).
 */
export async function sendAttendanceAlertNotification(data: {
  studentId?: string
  studentName: string
  status: 'absent' | 'late' | 'excused'
  sessionTopic: string
  date: string
  parentId?: string
}) {
  const statusLabel = data.status === 'absent' ? 'Absent' : data.status === 'late' ? 'Late' : 'Excused'

  // Student alert
  await sendNotification({
    user_id: data.studentId,
    target_role: 'student',
    title: `Attendance Record: Marked ${statusLabel}`,
    body: `You were recorded as ${statusLabel} for session "${data.sessionTopic}" on ${data.date}. Keep attendance high for certificate eligibility.`,
    href: '/attendance',
  })

  // Parent alert
  if (data.parentId) {
    await sendNotification({
      user_id: data.parentId,
      target_role: 'parent',
      title: `Attendance Alert: ${data.studentName}`,
      body: `${data.studentName} was marked ${statusLabel} for training session "${data.sessionTopic}" on ${data.date}.`,
      href: '/parent',
    })
  }
}

/**
 * Send notification when an official progress report is published.
 */
export async function sendReportPublishedNotification(data: {
  studentId?: string
  studentName: string
  courseName: string
  reportId?: string
  parentId?: string
}) {
  // Student alert
  await sendNotification({
    user_id: data.studentId,
    target_role: 'student',
    title: 'Progress Report Published',
    body: `Your official progress report for ${data.courseName} has been published and is ready to view.`,
    href: '/reports',
  })

  // Parent alert
  await sendNotification({
    user_id: data.parentId,
    target_role: 'parent',
    title: `Progress Report: ${data.studentName}`,
    body: `An official evaluation report has been published for ${data.studentName} in ${data.courseName}.`,
    href: '/parent',
  })

  // Sponsor alert
  await sendNotification({
    target_role: 'sponsor',
    title: `Cohort Progress Report: ${data.studentName}`,
    body: `Official progress evaluation completed for sponsored student ${data.studentName}.`,
    href: '/sponsor',
  })
}

/**
 * Send notification when a user role changes.
 */
export async function sendRoleChangedNotification(data: {
  userId?: string
  userName?: string
  newRole: Role
}) {
  await sendNotification({
    user_id: data.userId,
    title: 'Account Role Updated',
    body: `Your platform role has been updated to ${data.newRole.toUpperCase()}. Your permissions and views have been updated.`,
    href: '/',
  })
}

/**
 * Retrieve notifications applicable to the current user (combines Supabase + Local).
 */
export async function getNotificationsForUser(
  userRole?: Role | null,
  userId?: string | null
): Promise<AppNotification[]> {
  const localItems = getStoredNotifications()

  // Filter local items by recipient role or user_id
  const filteredLocal = localItems.filter((item) => {
    if (userId && item.user_id && item.user_id === userId) return true
    if (item.target_role === 'all') return true
    if (userRole && item.target_role === userRole) return true
    if ((userRole === 'admin' || userRole === 'manager') && item.target_role === 'admin') return true
    return false
  })

  // Attempt reading Supabase notifications
  let dbItems: AppNotification[] = []
  try {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30)

    if (data && Array.isArray(data)) {
      dbItems = data.map((d) => ({
        id: d.id,
        user_id: d.user_id,
        title: d.title,
        body: d.body,
        href: d.href || d.link || null,
        read_at: d.read_at,
        created_at: d.created_at,
      }))
    }
  } catch {
    // Ignore Supabase fetch errors
  }

  // Combine and deduplicate
  const combined = [...filteredLocal]
  const knownKeys = new Set(filteredLocal.map((n) => `${n.title}_${n.created_at?.slice(0, 16)}`))

  for (const item of dbItems) {
    const key = `${item.title}_${item.created_at?.slice(0, 16)}`
    if (!knownKeys.has(key)) {
      combined.push(item)
      knownKeys.add(key)
    }
  }

  // Sort by date descending
  combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return combined
}

/**
 * Mark a notification as read.
 */
export async function markNotificationAsRead(id: string) {
  const items = getStoredNotifications()
  const now = new Date().toISOString()
  let changed = false

  const updated = items.map((item) => {
    if (item.id === id) {
      changed = true
      return { ...item, read_at: item.read_at || now }
    }
    return item
  })

  if (changed) {
    saveStoredNotifications(updated)
  }

  try {
    await supabase.from('notifications').update({ read_at: now }).eq('id', id)
  } catch {
    // Offline fallback
  }
}

/**
 * Mark all notifications as read for current user.
 */
export async function markAllNotificationsAsRead(
  userRole?: Role | null,
  userId?: string | null
) {
  const items = getStoredNotifications()
  const now = new Date().toISOString()

  const updated = items.map((item) => {
    const matchesUser =
      (userId && item.user_id === userId) ||
      item.target_role === 'all' ||
      (userRole && item.target_role === userRole) ||
      ((userRole === 'admin' || userRole === 'manager') && item.target_role === 'admin')

    if (matchesUser) {
      return { ...item, read_at: item.read_at || now }
    }
    return item
  })

  saveStoredNotifications(updated)

  try {
    await supabase.from('notifications').update({ read_at: now }).is('read_at', null)
  } catch {
    // Offline fallback
  }
}

/**
 * Get count of pending student verifications.
 */
export function getPendingVerificationsCount(): number {
  const items = getPendingStudentVerifications()
  return items.filter((v) => v.status === 'pending').length
}
