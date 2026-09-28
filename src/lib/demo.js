// Sample data for demo mode: ~12 days of a 3½-month-old improving with
// sleep training, generated up to the current moment (so something may be
// "in progress" when you open it).

import { DAY, HOUR, MIN, iso, localDateStr, startOfToday } from './time.js'

function seeded(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

export function makeDemoData() {
  const nowMs = Date.now()
  const rnd = seeded(7)
  const who = () => {
    const r = rnd()
    return r < 0.45 ? 'demo-evan' : r < 0.9 ? 'demo-mom' : 'demo-grandma'
  }
  const sessions = []
  const wakes = []
  const DAYS = 11
  const today0 = startOfToday(nowMs)
  let id = 0
  const nextId = () => `00000000-0000-4000-8000-${String(++id).padStart(12, '0')}`
  let done = false

  // Add a session, trimming anything that hasn't happened yet.
  function add(kind, down, asleep, end) {
    if (down > nowMs) return (done = true), null
    const s = {
      id: nextId(), kind,
      started_at: iso(down),
      asleep_at: asleep && asleep <= nowMs ? iso(asleep) : null,
      ended_at: end <= nowMs ? iso(end) : null,
      started_by: who(), asleep_by: who(), ended_by: who(), notes: null, updated_at: iso(down),
    }
    sessions.push(s)
    if (!s.ended_at) done = true
    return s
  }

  let t = today0 - DAYS * DAY + 6.7 * HOUR
  for (let d = 0; d <= DAYS && !done; d++) {
    const day0 = today0 - (DAYS - d) * DAY
    const progress = Math.min(1, d / 8)

    for (let n = 0; n < 4 && !done; n++) {
      const down = t + ([75, 86, 98, 109][n] + (rnd() * 20 - 10)) * MIN
      if (down > day0 + 17.25 * HOUR) break
      const fail = rnd() < 0.15 * (1 - progress)
      const asleep = fail ? null : down + (16 - 10 * progress + rnd() * 8) * MIN
      const len = n === 3 ? 30 + rnd() * 15 : rnd() < 0.3 ? 28 + rnd() * 14 : 55 + rnd() * 50
      const end = fail ? down + 60 * MIN : asleep + len * MIN
      add('nap', down, asleep, end)
      t = end
    }
    if (done) break

    const bed = Math.min(Math.max(t + (110 + rnd() * 15) * MIN, day0 + 18.5 * HOUR), day0 + 20 * HOUR)
    const asleep = bed + (52 - 42 * progress + rnd() * 10) * MIN
    const morning = day0 + DAY + (6.4 + rnd() * 0.5) * HOUR
    const night = add('night', bed, asleep, morning)
    if (!night) break

    const count = Math.max(1, Math.round(4 - 3 * progress + rnd() * 1.2 - 0.4))
    const span = morning - asleep
    for (let w = 0; w < count; w++) {
      const woke = asleep + (span * (w + 0.6 + rnd() * 0.3)) / (count + 0.6)
      if (woke > nowMs) break
      const fed = count === 1 ? rnd() < 0.7 : w === Math.floor(count / 2)
      const back = woke + (fed ? 22 : 24 - 16 * progress + rnd() * 10) * MIN
      wakes.push({
        id: nextId(), session_id: night.id, woke_at: iso(woke),
        asleep_at: back <= nowMs ? iso(back) : null, fed, logged_by: who(), notes: null, updated_at: iso(woke),
      })
    }
    t = morning
  }

  return {
    sessions,
    night_wakes: wakes,
    checks: [],
    profiles: [
      { id: 'demo-evan', display_name: 'Evan', email: 'demo@example.com', family_id: 'demo', role: 'owner' },
      { id: 'demo-mom', display_name: 'Mom', email: 'mom@example.com', family_id: 'demo', role: 'member' },
      { id: 'demo-grandma', display_name: 'Grandma', email: 'grandma@example.com', family_id: 'demo', role: 'member' },
    ],
    settings: [
      {
        id: 'demo',
        baby_name: 'Baby',
        birth_date: localDateStr(new Date(today0 - 108 * DAY)),
        due_date: null,
        training_start: localDateStr(new Date(today0 - DAYS * DAY)),
        feed_interval_hours: 4,
        nap_limit_min: 60,
        morning_time: '06:00',
        why_note: 'We’re doing this so he can learn to sleep well — and so we can be the rested, patient parents he deserves.',
      },
    ],
  }
}
