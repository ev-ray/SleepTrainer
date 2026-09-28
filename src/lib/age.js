import { DAY, parseDay } from './time.js'

// Age-banded sleep targets. Total-sleep ranges follow the AASM consensus
// (Paruthi 2016: 12–16 h for 4–12 months) and the National Sleep Foundation
// (Hirshkowitz 2015: 14–17 h for 0–3 months). Wake windows and nap counts
// aren't set by trials — they're the ranges pediatric sleep clinicians
// commonly use — so treat them as a starting point and let his cues and
// your log fine-tune them.
//
// Minutes throughout. `naps` = [fewest, most] typical per day.
export const BENCHMARKS = [
  {
    upToWeeks: 6, label: '0–6 weeks',
    ww: [45, 60], naps: [4, 6], napCap: 120, daySleep: [360, 480], night: [480, 540], total: [840, 1020],
    bedtime: ['21:00', '23:00'], nightFeeds: 'Every 2–3 hours — newborns need to eat overnight.',
  },
  {
    upToWeeks: 12, label: '6–12 weeks',
    ww: [60, 90], naps: [4, 5], napCap: 120, daySleep: [270, 360], night: [540, 660], total: [840, 1020],
    bedtime: ['19:30', '21:30'], nightFeeds: '2–3 feeds a night is typical.',
  },
  {
    upToWeeks: 17, label: '3–4 months',
    ww: [75, 120], naps: [3, 4], napCap: 120, daySleep: [180, 300], night: [600, 720], total: [720, 960],
    bedtime: ['18:30', '20:00'], nightFeeds: '1–2 feeds a night is still common and fine. Agree the plan with your pediatrician.',
    notes: 'The “4-month sleep regression” lands here: sleep cycles mature and night waking often jumps for a week or two. It’s a good time to build independent sleep, and a bad time to judge progress night-to-night.',
  },
  {
    upToWeeks: 22, label: '4–5 months',
    ww: [105, 135], naps: [3, 4], napCap: 120, daySleep: [180, 240], night: [630, 720], total: [720, 960],
    bedtime: ['18:30', '19:30'], nightFeeds: '0–2 feeds; many babies drop to one around now.',
    notes: 'Most babies move from 4 naps to 3 somewhere in this range.',
  },
  {
    upToWeeks: 30, label: '5–7 months',
    ww: [120, 180], naps: [3, 3], napCap: 120, daySleep: [150, 210], night: [660, 720], total: [720, 960],
    bedtime: ['18:30', '19:30'], nightFeeds: '0–1 feeds. Many babies can sleep through without feeding by 6 months — confirm with your pediatrician.',
  },
  {
    upToWeeks: 39, label: '7–9 months',
    ww: [150, 210], naps: [2, 3], napCap: 120, daySleep: [120, 180], night: [660, 720], total: [720, 960],
    bedtime: ['18:30', '19:30'], nightFeeds: 'Usually none needed.',
    notes: 'The 3→2 nap transition usually happens here.',
  },
  {
    upToWeeks: 52, label: '9–12 months',
    ww: [180, 240], naps: [2, 2], napCap: 120, daySleep: [120, 180], night: [660, 720], total: [720, 960],
    bedtime: ['18:30', '19:30'], nightFeeds: 'None needed.',
  },
  {
    upToWeeks: 78, label: '12–18 months',
    ww: [240, 330], naps: [1, 2], napCap: 150, daySleep: [90, 180], night: [660, 720], total: [660, 840],
    bedtime: ['18:30', '19:30'], nightFeeds: 'None needed.',
  },
  {
    upToWeeks: Infinity, label: '18 months +',
    ww: [300, 360], naps: [1, 1], napCap: 150, daySleep: [90, 150], night: [660, 720], total: [660, 840],
    bedtime: ['19:00', '20:00'], nightFeeds: 'None needed.',
  },
]

export const SHORT_NAP_MIN = 45

export function ageInfo(settings, t = Date.now()) {
  if (!settings?.birth_date) return null
  const birth = parseDay(settings.birth_date)
  const today = new Date(t)
  today.setHours(0, 0, 0, 0)
  const days = Math.max(0, Math.round((today - birth) / DAY))

  // Preemies: go by adjusted age (from due date) for sleep expectations.
  let early = 0
  if (settings.due_date) {
    const diff = Math.round((parseDay(settings.due_date) - birth) / DAY)
    if (diff >= 14) early = diff
  }
  // Before the due date a preemie's adjusted age is still 0 (newborn targets).
  const adjDays = Math.max(0, days - early)
  const weeksF = adjDays / 7
  const idx = BENCHMARKS.findIndex((b) => weeksF < b.upToWeeks)
  const band = BENCHMARKS[idx]
  const next = BENCHMARKS[idx + 1] || null
  let nextDate = null
  if (next) {
    nextDate = new Date(birth)
    nextDate.setDate(nextDate.getDate() + band.upToWeeks * 7 + early) // calendar days, so DST can't shift it
  }

  return {
    days,
    adjDays,
    preterm: early > 0,
    weeks: Math.floor(adjDays / 7),
    extraDays: adjDays % 7,
    months: Math.floor(adjDays / 30.44),
    band,
    next,
    nextDate,
  }
}

// Wake window (minutes) before nap #index (0 = first window of the morning).
// Windows lengthen through the day, so spread the band from shortest to longest.
export function wakeWindow(band, index) {
  const n = band.naps[1]
  const [a, b] = band.ww
  return Math.round(a + ((b - a) * Math.min(index, n)) / n)
}
