export function validateSession(input) {
  const topic = String(input.topic ?? '').trim()
  const week = Number(input.week_number)
  if (!Number.isInteger(week) || week < 1 || week > 520) throw new Error('Choose a valid training week.')
  const start = Date.parse(input.starts_at)
  const end = Date.parse(input.ends_at)
  if (!topic || !input.cohort_id || !input.trainer_id) throw new Error('Session title, cohort and trainer are required.')
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error('End time must be after start time.')
  const type = input.session_type ?? 'physical'
  const status = input.status ?? 'scheduled'
  if (!['physical', 'online', 'hybrid'].includes(type)) throw new Error('Choose a valid session type.')
  if (!['scheduled', 'completed', 'cancelled'].includes(status)) throw new Error('Choose a valid session status.')
  const location = type === 'online' ? '' : String(input.location ?? '').trim()
  const meeting = type === 'physical' ? '' : String(input.meeting_link ?? '').trim()
  if (type !== 'online' && !location) throw new Error('Enter the session location.')
  if (type !== 'physical') {
    let url
    try { url = new URL(meeting) } catch { throw new Error('Enter a valid meeting link.') }
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Meeting links must use HTTP or HTTPS.')
  }
  return { topic, week_number: week, cohort_id: input.cohort_id, app_trainer_id: input.trainer_id,
    starts_at: new Date(start).toISOString(), ends_at: new Date(end).toISOString(),
    description: String(input.description ?? '').trim(), session_type: type,
    location, meeting_link: meeting, status }
}
