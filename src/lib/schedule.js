// What should happen next, given the log and his age.

import { SHORT_NAP_MIN, wakeWindow } from './age.js'
import { HOUR, MIN, atTime, fmtClock, fmtDur, ms, startOfToday } from './time.js'
import { stats, wakesOf } from './metrics.js'

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
    const slept = stats(last, wakesOf(last)).sleep
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

// He woke during a nap: wait for him to resettle, or call it?
//
// Infant sleep cycles run roughly 30–50 minutes, so waking around the
// 30–45 minute mark is usually a cycle transition, not the end of his need for
// sleep — left alone, many babies link into a second cycle. The longer he's
// already slept, the less there is to gain by waiting. Late in the day, a long
// wait would push him into bedtime, so protect bedtime instead.
export function napWakeAdvice({ s, wake, band, nowMs }) {
  const woke = ms(wake.woke_at)
  const earlier = wakesOf(s).filter((w) => w.id !== wake.id && ms(w.woke_at) < woke)
  const slept = stats({ ...s, ended_at: null }, earlier, woke).sleep
  const sleptMin = slept / MIN
  const capMin = band?.napCap || 120
  const bedLatest = band ? atTime(band.bedtime[1], woke) : Infinity
  const wwMax = (band?.ww[1] || 120) * MIN
  const late = (wait) => woke + wait * MIN + wwMax > bedLatest

  let verdict, waitMin, title, body
  if (sleptMin >= Math.min(75, capMin - 10) || (earlier.length > 0 && sleptMin >= 45)) {
    verdict = 'up'
    title = 'That’s a full nap — get him up'
    body = `${fmtDur(slept)} is a solid nap. Start the next wake window.`
  } else if (sleptMin < 45) {
    waitMin = earlier.length ? 10 : 20
    if (late(waitMin) && sleptMin >= 20) {
      verdict = 'up'
      title = 'Late in the day — get him up'
      body = `Waiting would push into bedtime. ${fmtDur(slept)} will do; bedtime can come a little early.`
    } else {
      verdict = 'wait'
      title = 'Give him a chance to resettle'
      body = `He slept ${fmtDur(slept)} — about one sleep cycle, so he’s probably still tired. Leave him up to ${waitMin} minutes, chatting or crying.`
    }
  } else {
    waitMin = 10
    verdict = late(waitMin) ? 'up' : 'maybe'
    title = verdict === 'up' ? 'Good nap — get him up' : 'Decent nap — a short wait is optional'
    body =
      verdict === 'up'
        ? `${fmtDur(slept)} is plenty this late in the day.`
        : `He slept ${fmtDur(slept)}. Give him up to 10 minutes; if he’s still awake, call it.`
  }
  const deadline = waitMin && verdict !== 'up' ? woke + waitMin * MIN : null
  return { verdict, title, body, slept, deadline, deadlineLabel: deadline && fmtClock(deadline), expired: deadline != null && nowMs >= deadline }
}
