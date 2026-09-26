export const SEC = 1000
export const MIN = 60 * SEC
export const HOUR = 60 * MIN
export const DAY = 24 * HOUR

// A "sleep day" runs 4am→4am, so a 7pm bedtime and the 2am wake that follows
// belong to the same day as that afternoon's naps.
const DAY_SHIFT = 4 * HOUR

export const ms = (iso) => (iso ? new Date(iso).getTime() : null)
export const iso = (t = Date.now()) => new Date(t).toISOString()
export const uuid = () => crypto.randomUUID()

const pad = (n) => String(n).padStart(2, '0')

export function fmtClock(t) {
  return new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function fmtDur(d) {
  if (d == null || Number.isNaN(d)) return '—'
  d = Math.max(0, d)
  const h = Math.floor(d / HOUR)
  const m = Math.floor((d % HOUR) / MIN)
  if (h) return m ? `${h}h ${pad(m)}m` : `${h}h`
  return `${m}m`
}

export const fmtMins = (mins) => fmtDur(mins * MIN)

export function localDateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseDay(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function dayKey(t) {
  return localDateStr(new Date((typeof t === 'string' ? ms(t) : t) - DAY_SHIFT))
}

export function addDays(key, n) {
  const d = parseDay(key)
  d.setDate(d.getDate() + n)
  return localDateStr(d)
}

export function fmtDay(key, today = dayKey(Date.now())) {
  if (key === today) return 'Today'
  if (key === addDays(today, -1)) return 'Yesterday'
  return parseDay(key).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

export function fmtShortDay(key) {
  return parseDay(key).toLocaleDateString([], { weekday: 'narrow' })
}

export function startOfToday(t = Date.now()) {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// "18:30" → today at 6:30pm (ms)
export function atTime(hm, t = Date.now()) {
  const [h, m] = hm.split(':').map(Number)
  const d = new Date(t)
  d.setHours(h, m, 0, 0)
  return d.getTime()
}

// <input type="datetime-local"> round-trips
export function toInput(t) {
  if (t == null) return ''
  const d = new Date(typeof t === 'string' ? ms(t) : t)
  return `${localDateStr(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export const fromInput = (v) => (v ? new Date(v).toISOString() : null)
