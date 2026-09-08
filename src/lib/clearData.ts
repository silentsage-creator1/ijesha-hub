/**
 * App Data Reset and Cleanup Utility
 * Ensures all sample/demo local records are thoroughly purged for publishing.
 */
import { supabase, supabaseConfigured } from '@/lib/supabase'

export const APP_STORAGE_KEYS = [
  'training_student_reports_v2',
  'training_student_reports',
  'ijesha_hub_student_projects_v2',
  'ijesha_hub_student_projects',
  'ijesha_hub_portfolio_items_v2',
  'ijesha_hub_portfolio_items',
  'ijesha_hub_student_portfolio_v2',
  'ijesha_hub_classwork_items_v2',
  'ijesha_hub_classwork_items',
  'ijesha_hub_classwork_submissions_v2',
  'ijesha_hub_classwork_submissions',
  'ijesha_hub_cohorts_v2',
  'ijesha_hub_cohorts',
  'ijesha_hub_cohorts_deleted',
  'ijesha_hub_deleted_cohorts_v2',
  'ijesha_hub_trainers_v2',
  'ijesha_hub_trainers',
  'ijesha_hub_managers_v2',
  'ijesha_hub_managers',
  'ijesha_hub_sponsors_v2',
  'ijesha_hub_sponsors',
  'ijesha_hub_parents_v2',
  'ijesha_hub_parents',
  'ijesha_hub_users_v2',
  'ijesha_hub_managed_users_v2',
  'ijesha_hub_users',
  'ijesha_hub_audit_logs_v3',
  'ijesha_hub_audit_logs_v2',
  'ijesha_hub_audit_logs',
  'ijesha_hub_pending_verifications_v2',
  'ijesha_hub_pending_verifications',
  'ijesha_hub_notifications_v3',
  'ijesha_hub_notifications',
  'ijesha_hub_assessments_v2',
  'ijesha_hub_assessments',
  'ijesha_hub_assignments_v2',
  'ijesha_hub_assignments',
  'ijesha_hub_attendance_v2',
  'ijesha_hub_attendance',
  'ijesha_hub_certificates_v2',
  'ijesha_hub_certificates',
  'ijesha_hub_certificate_calibration_v2',
  'ijesha_hub_certificate_template_v2',
  'ijesha_hub_progress_reports_v2',
  'ijesha_hub_progress_reports',
  'ijesha_hub_weekly_progress_v2',
  'ijesha_hub_pending_roster_sync',
  'ijesha_hub_course_results_v2',
  'ijesha_hub_roles_permissions_v2',
  'ijesha_hub_courses_v2',
  'ijesha_hub_courses',
  'ijesha_hub_organization_settings_v2',
]

const PURGE_FLAG_KEY = 'ijesha_hub_data_purged_for_publish_v2'

/**
 * Purge all local sample/cached data from browser storage
 */
export async function clearAllAppData(
  preserveSession = true,
  options?: { clearDatabaseRecords?: boolean }
): Promise<{ clearedKeysCount: number; dbCleaned: boolean }> {
  let clearedCount = 0
  let dbCleaned = false

  if (typeof window !== 'undefined') {
    try {
      // 1. Explicit keys
      for (const key of APP_STORAGE_KEYS) {
        if (localStorage.getItem(key) !== null) {
          localStorage.removeItem(key)
          clearedCount++
        }
      }

      // 2. Comprehensive sweep for any dynamic or prefixed keys
      const allKeys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k) allKeys.push(k)
      }

      for (const k of allKeys) {
        if (
          (k.startsWith('ijesha_hub_') || k.startsWith('training_')) &&
          k !== PURGE_FLAG_KEY
        ) {
          if (preserveSession && (k.includes('local_session') || k.includes('session'))) {
            continue
          }
          localStorage.removeItem(k)
          clearedCount++
        }
      }

      if (!preserveSession) {
        localStorage.removeItem('ijesha_hub_local_session_v3')
        localStorage.removeItem('ijesha_hub_local_session')
      }

      localStorage.setItem(PURGE_FLAG_KEY, 'true')

      // Broadcast update events across all open components
      window.dispatchEvent(new CustomEvent('app-data-cleared'))
      window.dispatchEvent(new CustomEvent('cohorts-updated', { detail: [] }))
      window.dispatchEvent(new CustomEvent('student-projects-updated', { detail: [] }))
      window.dispatchEvent(new CustomEvent('portfolio-items-updated', { detail: [] }))
      window.dispatchEvent(new CustomEvent('audit-logs-cleared'))
      window.dispatchEvent(new CustomEvent('app-notifications-updated'))
      window.dispatchEvent(new CustomEvent('classwork-updated'))
      window.dispatchEvent(new CustomEvent('assignments-updated'))
    } catch (err) {
      console.warn('Failed to clear local app data:', err)
    }
  }

  // 3. Optional Supabase database cleanup for test records
  if (options?.clearDatabaseRecords && supabaseConfigured) {
    try {
      await Promise.allSettled([
        supabase.from('project_submissions').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        supabase.from('projects').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        supabase.from('attendance').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        supabase.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      ])
      dbCleaned = true
    } catch (dbErr) {
      console.warn('Database test cleanup error (non-fatal):', dbErr)
    }
  }

  return { clearedKeysCount: clearedCount, dbCleaned }
}

/**
 * Clear projects and portfolio submissions
 */
export function clearProjectsData(): void {
  if (typeof window === 'undefined') return
  try {
    const keys = [
      'ijesha_hub_student_projects_v2',
      'ijesha_hub_student_projects',
      'ijesha_hub_portfolio_items_v2',
      'ijesha_hub_portfolio_items',
      'ijesha_hub_student_portfolio_v2',
    ]
    for (const key of keys) {
      localStorage.removeItem(key)
    }
    window.dispatchEvent(new CustomEvent('student-projects-updated', { detail: [] }))
    window.dispatchEvent(new CustomEvent('portfolio-items-updated', { detail: [] }))
    window.dispatchEvent(new CustomEvent('app-data-cleared'))
  } catch (err) {
    console.warn('Failed to clear projects data:', err)
  }
}

/**
 * Clear audit and security logs
 */
export function clearAuditLogsData(): void {
  if (typeof window === 'undefined') return
  try {
    const keys = [
      'ijesha_hub_audit_logs_v3',
      'ijesha_hub_audit_logs_v2',
      'ijesha_hub_audit_logs',
    ]
    for (const key of keys) {
      localStorage.removeItem(key)
    }
    window.dispatchEvent(new CustomEvent('audit-logs-cleared'))
    window.dispatchEvent(new CustomEvent('app-data-cleared'))
  } catch (err) {
    console.warn('Failed to clear audit logs data:', err)
  }
}

/**
 * Automatically runs once on application boot to ensure the initial published state is completely clean.
 */
export function ensureCleanPublishState(): void {
  if (typeof window === 'undefined') return

  try {
    const alreadyPurged = localStorage.getItem(PURGE_FLAG_KEY)
    if (!alreadyPurged) {
      clearAllAppData(true)
    }
  } catch (err) {
    console.warn('Failed to verify clean publish state:', err)
  }
}
