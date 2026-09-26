// What should happen next, given the log and his age.

import { SHORT_NAP_MIN, wakeWindow } from './age.js'
import { HOUR, MIN, atTime, ms, startOfToday } from './time.js'

const WIND_DOWN_MIN = 15
const CATNAP_MIN = 40

export function nextUp({ sessions, last, band, nowMs }) {
  if (!last || !band) return null
  const awakeSince = ms(last.ended_at)

  // Naps so far today = naps since he got up for the day.
  const lastNight = [...sessions].reverse().find((s) => s.kind === 'night' && s.ended_at)
  const recentMorning = lastNight && nowMs - ms(lastNight.ended_at) < 18 * HOUR
  const dayStart = recentMorning ? ms(lastNight.ended_at) : startOfToday(nowMs)
  const napsToday = sessions.filter((s) => s.kind === 'nap' && ms(s.started_at) >= dayStart)
  const index = last.kind === 'night' ? 0 : napsToday.length

  // After a rough nap he'll be tired sooner — pull the next window in.
  let adjust = 0
  let reason = null
  if (last.kind === 'nap') {
    const slept = last.asleep_at ? ms(last.ended_at) - ms(last.asleep_at) : 0
    if (!last.asleep_at) (adjust = -20), (reason = 'noSleep')
    else if (slept < SHORT_NAP_MIN * MIN) (adjust = -15), (reason = 'short')
  }

  const wwFor = (i) => Math.max(45, wakeWindow(band, i) + adjust)
  const bedEarliest = atTime(band.bedtime[0], awakeSince)
  const bedLatest = atTime(band.bedtime[1], awakeSince)

  let kind = 'nap'
  let ww = wwFor(index)
  if (last.kind === 'nap') {
    const maxNaps = band.naps[1]
    // Would squeezing in one more (short) nap push bedtime too late?
    const napAt = awakeSince + ww * MIN
    const bedAfterCatnap = napAt + (CATNAP_MIN + wakeWindow(band, maxNaps)) * MIN
    const tooLate = index >= band.naps[0] && bedAfterCatnap > bedLatest + 30 * MIN
    // ...unless it's still mid-afternoon, in which case a bonus catnap beats
    // stretching him to bedtime.
    const bedAt = awakeSince + wwFor(maxNaps) * MIN
    if ((index >= maxNaps || tooLate) && bedAt >= bedEarliest - 45 * MIN) {
      kind = 'night'
      ww = wwFor(maxNaps)
    }
  }

  let target = awakeSince + ww * MIN
  // Never later than the latest age-appropriate bedtime — an early bedtime is
  // the fix for a rough day.
  if (kind === 'night') target = Math.min(target, bedLatest)

  return {
    kind,
    index,
    napNumber: index + 1,
    awakeSince,
    ww,
    target,
    windDownAt: target - WIND_DOWN_MIN * MIN,
    reason,
    windowId: last.id,
    isMorning: last.kind === 'night',
  }
}
