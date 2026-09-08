import type { TrainingSession, AttendanceRecord } from '@/types'

export interface SessionWithAttendance extends TrainingSession {
  recorded: boolean
  attendanceSummary: {
    totalStudents: number
    present: number
    absent: number
    late: number
    excused: number
    attendanceRate: number
  }
}

export interface TrainingWeekGroup {
  weekNumber: number
  weekLabel: string
  sessionCount: number
  studentCount: number
  sessions: SessionWithAttendance[]
}

export interface CohortAttendanceOverview {
  totalStudents: number
  present: number
  absent: number
  late: number
  excused: number
  attendanceRate: number
  weeks: TrainingWeekGroup[]
}

export const DEFAULT_STUDENT_NAMES: string[] = []

/**
 * Format a full session date e.g. "Monday, September 7"
 */
export function formatSessionDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

/**
 * Format short date e.g. "Sept 7"
 */
export function formatShortDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

/**
 * Format session time range e.g. "10:00 AM – 12:00 PM"
 */
export function formatSessionTime(startsAt: string, endsAt?: string | null): string {
  try {
    const s = new Date(startsAt)
    if (isNaN(s.getTime())) return '10:00 AM – 12:00 PM'
    const startStr = s.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    if (!endsAt) {
      // Default 2 hours after start
      const end = new Date(s.getTime() + 2 * 60 * 60 * 1000)
      const endStr = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      return `${startStr} – ${endStr}`
    }
    const e = new Date(endsAt)
    if (isNaN(e.getTime())) return startStr
    const endStr = e.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    return `${startStr} – ${endStr}`
  } catch {
    return '10:00 AM – 12:00 PM'
  }
}

/**
 * Calculate attendance rate: (present + late) / total or present / total
 * For IJESHA DIGITAL HUB: 21 Present + 1 Late / 25 = 88% or 21/25 = 84%
 * As specified in prompt: Total: 25, Present: 21, Absent: 3, Late: 1 => Attendance Rate: 84%
 */
export function calculateAttendanceRate(present: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((present / total) * 100)
}

export function generateDefaultSchedule(_cohortId: string, _courseName = 'Cyber Security', _trainerName = 'John Doe'): any[] {
  return []
}

export function generateDefaultSessionAttendance(_sessionId: string, _students: Array<{ id: string; full_name: string }>): AttendanceRecord[] {
  return []
}
