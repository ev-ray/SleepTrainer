import { computed } from '@preact/signals'
import { db, settings } from './store.js'
import { DAY, HOUR, ms, dayKey } from './time.js'

const byStart = (a, b) => ms(a.started_at) - ms(b.started_at)

export const sortedSessions = computed(() => [...db.sessions.value].sort(byStart))

export const wakesBySession = computed(() => {
  const m = new Map()
  for (const w of db.night_wakes.value) {
    if (!m.has(w.session_id)) m.set(w.session_id, [])
    m.get(w.session_id).push(w)
  }
  for (const list of m.values()) list.sort((a, b) => ms(a.woke_at) - ms(b.woke_at))
  return m
})

export const wakesOf = (s) => wakesBySession.value.get(s.id) || []

export const active = computed(() => {
  const open = sortedSessions.value.filter((s) => !s.ended_at)
  return open[open.length - 1] || null
})

export const openWake = computed(() => {
  const s = active.value
  if (!s || s.kind !== 'night') return null
  return wakesOf(s).find((w) => !w.asleep_at) || null
})

export const lastEnded = computed(() => {
  const ended = sortedSessions.value.filter((s) => s.ended_at)
  return ended.sort((a, b) => ms(a.ended_at) - ms(b.ended_at)).at(-1) || null
})

// Everything about one nap or night.
export function stats(s, wakes = [], nowMs = Date.now()) {
  const start = ms(s.started_at)
  const asleep = ms(s.asleep_at)
  const end = ms(s.ended_at) ?? nowMs
  let awake = 0
  let longest = 0
  let cursor = asleep
  for (const w of wakes) {
    const woke = ms(w.woke_at)
    const back = ms(w.asleep_at) ?? end
    awake += Math.max(0, back - woke)
    if (cursor) longest = Math.max(longest, woke - cursor)
    cursor = ms(w.asleep_at)
  }
  if (cursor && end > cursor) longest = Math.max(longest, end - cursor)
  return {
    start,
    asleep,
    end,
    latency: asleep ? asleep - start : null,
    sleep: asleep ? Math.max(0, end - asleep - awake) : 0,
    awake,
    longest,
    wakeCount: wakes.length,
    fedCount: wakes.filter((w) => w.fed).length,
    open: !s.ended_at,
    noSleep: !!s.ended_at && !asleep,
  }
}

// Sessions grouped by sleep day (4am→4am), newest last.
export const days = computed(() => {
  const map = new Map()
  for (const s of sortedSessions.value) {
    const k = dayKey(s.started_at)
    if (!map.has(k)) map.set(k, { key: k, naps: [], nights: [] })
    map.get(k)[s.kind === 'nap' ? 'naps' : 'nights'].push(s)
  }
  return map
})

export function daySummary(d, nowMs = Date.now()) {
  const naps = d.naps.map((s) => ({ s, st: stats(s, [], nowMs) }))
  const night = d.nights[0] ? { s: d.nights[0], st: stats(d.nights[0], wakesOf(d.nights[0]), nowMs) } : null
  const napSleep = naps.reduce((a, n) => a + n.st.sleep, 0)
  const napLatencies = naps.filter((n) => n.st.latency != null).map((n) => n.st.latency)
  return {
    key: d.key,
    naps,
    night,
    napSleep,
    napCount: naps.filter((n) => n.st.asleep).length,
    napLatency: napLatencies.length ? napLatencies.reduce((a, b) => a + b, 0) / napLatencies.length : null,
    total: napSleep + (night?.st.sleep || 0),
  }
}

// Night number since training began (1 = first night).
export const nightsInTraining = computed(() => {
  const start = settings.value?.training_start
  return sortedSessions.value.filter((s) => s.kind === 'night' && (!start || dayKey(s.started_at) >= start))
})

export function nightNumber(s) {
  const i = nightsInTraining.value.findIndex((n) => n.id === s.id)
  return i === -1 ? null : i + 1
}

// His actual average wake window over the past week (minutes).
export const recentWakeWindow = computed(() => {
  const list = sortedSessions.value
  const cutoff = Date.now() - 7 * DAY
  const samples = []
  for (let i = 1; i < list.length; i++) {
    const p = list[i - 1]
    const s = list[i]
    if (s.kind !== 'nap' || !p.ended_at || ms(s.started_at) < cutoff) continue
    const gap = ms(s.started_at) - ms(p.ended_at)
    if (gap > 0 && gap < 5 * HOUR) samples.push(gap)
  }
  if (samples.length < 3) return null
  return Math.round(samples.reduce((a, b) => a + b, 0) / samples.length / 60000)
})

// When he last ate overnight: the last fed wake, or bedtime (the routine feed).
export function lastFeed(s) {
  const fed = wakesOf(s).filter((w) => w.fed).at(-1)
  return fed ? ms(fed.woke_at) : ms(s.started_at)
}
