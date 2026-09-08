/**
 * Comprehensive Organization Settings
 * Supports General, Branding, Training, Communication, and Reports configuration.
 */

export interface OrganizationSettings {
  // General
  name: string
  description: string
  email: string
  phone: string
  website: string
  address: string

  // Branding
  logoUrl: string
  tagline: string
  brandInformation: string
  accentColor: string
  reportBranding: string

  // Training
  trainingWeeks: number
  defaultTrainingSettings: {
    sessionsPerWeek: number
    hoursPerSession: number
    maxCohortCapacity: number
  }
  attendanceSettings: {
    minimumAttendancePercent: number
    lateGracePeriodMinutes: number
    autoFlagAbsenceThreshold: number
  }
  gradingSettings: {
    passingScorePercent: number
    distinctionScorePercent: number
    gradingScale: string
  }

  // Communication
  emailSettings: {
    senderName: string
    replyToEmail: string
    smtpStatus: 'Configured' | 'Default Relay'
  }
  notificationSettings: {
    emailAlertsEnabled: boolean
    parentWeeklyDigest: boolean
    attendanceAlerts: boolean
  }
  announcementSettings: {
    allowTrainersBroadcast: boolean
    requireAdminApproval: boolean
  }

  // Reports
  reportHeader: {
    primaryTitle: string
    secondaryTitle: string
    displayCrest: boolean
  }
  reportFooter: {
    disclaimer: string
    signatureLineTitle: string
    showVerificationHash: boolean
  }
  defaultReportSettings: {
    includeAttendanceGraph: boolean
    includeEvaluations: boolean
    watermarkDrafts: boolean
  }
}

const ORG_SETTINGS_KEY = 'ijesha_hub_org_settings_v2'

export const DEFAULT_ORG_SETTINGS: OrganizationSettings = {
  // General
  name: 'Ijesha Digital Hub',
  description: 'Centre of excellence for digital skills, innovation, software engineering, and community-driven technology advancement.',
  email: 'info@ijeshadigitalhub.org',
  phone: '+234 (0) 800 453 7421',
  website: 'https://ijeshadigitalhub.org',
  address: 'Ijesha Hub Complex, Osun State, Nigeria',

  // Branding
  logoUrl: '',
  tagline: 'Centre for Digital Skills, Innovation & Technology Training',
  brandInformation: 'Official digital training platform empowering Nigerian youth with high-demand tech skills.',
  accentColor: '#1d4ed8',
  reportBranding: 'Official Academic Progress Verification',

  // Training
  trainingWeeks: 12,
  defaultTrainingSettings: {
    sessionsPerWeek: 3,
    hoursPerSession: 3,
    maxCohortCapacity: 30,
  },
  attendanceSettings: {
    minimumAttendancePercent: 80,
    lateGracePeriodMinutes: 15,
    autoFlagAbsenceThreshold: 3,
  },
  gradingSettings: {
    passingScorePercent: 60,
    distinctionScorePercent: 85,
    gradingScale: 'Percentage (0–100%) with Letter Equivalence (A/B/C/F)',
  },

  // Communication
  emailSettings: {
    senderName: 'Ijesha Digital Hub Academic Registry',
    replyToEmail: 'academic@ijeshadigitalhub.org',
    smtpStatus: 'Configured',
  },
  notificationSettings: {
    emailAlertsEnabled: true,
    parentWeeklyDigest: true,
    attendanceAlerts: true,
  },
  announcementSettings: {
    allowTrainersBroadcast: true,
    requireAdminApproval: false,
  },

  // Reports
  reportHeader: {
    primaryTitle: 'IJESHA DIGITAL HUB',
    secondaryTitle: 'STUDENT PROGRESS REPORT',
    displayCrest: true,
  },
  reportFooter: {
    disclaimer: 'This official academic progress report is issued under the authority of Ijesha Digital Hub Academic Board.',
    signatureLineTitle: 'Director of Academic Affairs & Training Certification',
    showVerificationHash: true,
  },
  defaultReportSettings: {
    includeAttendanceGraph: true,
    includeEvaluations: true,
    watermarkDrafts: true,
  },
}

export function getOrganizationSettings(): OrganizationSettings {
  if (typeof window === 'undefined') return DEFAULT_ORG_SETTINGS
  try {
    const raw = localStorage.getItem(ORG_SETTINGS_KEY)
    if (!raw) {
      saveOrganizationSettings(DEFAULT_ORG_SETTINGS)
      return DEFAULT_ORG_SETTINGS
    }
    return { ...DEFAULT_ORG_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_ORG_SETTINGS
  }
}

export function saveOrganizationSettings(settings: Partial<OrganizationSettings>): OrganizationSettings {
  const current = getOrganizationSettings()
  const updated: OrganizationSettings = { ...current, ...settings }
  try {
    localStorage.setItem(ORG_SETTINGS_KEY, JSON.stringify(updated))
  } catch (err) {
    console.warn('Failed to save organization settings:', err)
  }
  return updated
}

export function resetOrganizationSettings(): OrganizationSettings {
  try {
    localStorage.setItem(ORG_SETTINGS_KEY, JSON.stringify(DEFAULT_ORG_SETTINGS))
  } catch (err) {
    console.warn('Failed to reset organization settings:', err)
  }
  return DEFAULT_ORG_SETTINGS
}
