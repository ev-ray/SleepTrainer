// What should happen next, given the log and his age.

import { SHORT_NAP_MIN, wakeWindow } from './age.js'
import { DAY, HOUR, MIN, atTime, fmtClock, fmtDur, ms, startOfToday } from './time.js'
import { stats, wakesOf } from './metrics.js'

const WIND_DOWN_MIN = 15
const CATNAP_MIN = 40
const FIT_DAYS = 4

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x))

function weightedMedian(samples) {
  const sorted = [...samples].sort((a, b) => a.v - b.v)
  const half = sorted.reduce((a, x) => a + x.w, 0) / 2
  let acc = 0
  for (const x of sorted) if ((acc += x.w) >= half) return x.v
}

// How his real wake windows compare with the age band's.
//
// Every nap he actually slept in is a sample of a window that worked: the
// time since he last woke, plus any settling past 15 minutes (a long settle
// means he wasn't tired yet). Each sample is scaled by the band's window for
// that slot so a short morning window and a long evening one compare fairly.
// Today's naps count triple, so the plan follows how today is going. The
// median keeps one odd window from swinging it, and with few samples the
// result stays close to the band. `todayMax` is the longest window that has
// worked today, in minutes.
export function personalFit({ sessions, band, nowMs, dayStart }) {
  const cutoff = nowMs - FIT_DAYS * DAY
  const samples = []
  let todayMax = null
  let upAt = null
  let index = 0
  for (const s of sessions) {
    if (s.kind === 'night') {
      upAt = ms(s.ended_at)
      index = 0
      continue
    }
    if (!s.asleep_at) continue // a failed attempt: he's still awake since upAt
    const st = stats(s, wakesOf(s), nowMs)
    const gap = upAt != null ? ms(s.started_at) - upAt : null
    const i = index++
    if (s.ended_at) upAt = ms(s.ended_at)
    if (gap == null || gap < 20 * MIN || gap > 5 * HOUR || st.start < cutoff || st.sleep < 20 * MIN) continue
    const effective = gap + Math.max(0, st.latency - 15 * MIN)
    const today = st.start >= dayStart
    samples.push({ v: effective / MIN / wakeWindow(band, i), w: today ? 3 : 1 })
    if (today) todayMax = Math.max(todayMax || 0, Math.round(effective / MIN))
  }
  if (!samples.length) return { factor: 1, samples: 0, todayMax }
  const n = samples.length
  const factor = clamp(1 + (weightedMedian(samples) - 1) * (n / (n + 2)), 0.6, 1.3)
  return { factor, samples: n, todayMax }
}

export function nextUp({ sessions, last, band, nowMs }) {
  if (!last || !band) return null
  const awakeSince = ms(last.ended_at)

  // Naps so far today = naps since he got up for the day.
  const lastNight = [...sessions].reverse().find((s) => s.kind === 'night' && s.ended_at)
  const recentMorning = lastNight && nowMs - ms(lastNight.ended_at) < 18 * HOUR
  const dayStart = recentMorning ? ms(lastNight.ended_at) : startOfToday(nowMs)
  const napsToday = sessions.filter((s) => s.kind === 'nap' && ms(s.started_at) >= dayStart)
  const index = last.kind === 'night' ? 0 : napsToday.length

  const fit = personalFit({ sessions, band, nowMs, dayStart })

  // React to how the last sleep went: tired sooner after a rough one, a bit
  // more stamina after a long one.
  let adjust = 0
  let reason = null
  const slept = stats(last, wakesOf(last)).sleep
  if (last.kind === 'nap') {
    if (!last.asleep_at) (adjust = -20), (reason = 'noSleep')
    else if (slept < SHORT_NAP_MIN * MIN) (adjust = -15), (reason = 'short')
    else if (slept >= 60 * MIN) (adjust = 10), (reason = 'long')
  } else if (last.asleep_at && slept < (band.night[0] - 30) * MIN) {
    (adjust = -15), (reason = 'shortNight')
  }

  // Windows lengthen through the day, but not far past the longest one that
  // has worked for him today.
  const wwFor = (i, stretch = 20) => {
    let ww = Math.round(wakeWindow(band, i) * fit.factor) + adjust
    if (fit.todayMax) ww = Math.min(ww, fit.todayMax + stretch + Math.min(0, adjust))
    return Math.max(45, ww)
  }
  const bedEarliest = atTime(band.bedtime[0], awakeSince)
  const bedLatest = atTime(band.bedtime[1], awakeSince)

  // Nap or bedtime is decided by the clock, not a fixed nap count, so extra
  // naps on a short-window day don't throw the plan off.
  let kind = 'nap'
  let ww = wwFor(index)
  if (last.kind === 'nap') {
    const longest = wwFor(band.naps[1], 30)
    const bedAt = awakeSince + longest * MIN
    // Would one more (short) nap push bedtime too late? Then an early
    // bedtime beats a late catnap, unless it's still mid-afternoon.
    const napAt = awakeSince + ww * MIN
    const bedAfterCatnap = napAt + (CATNAP_MIN + longest) * MIN
    const noRoom = index >= band.naps[0] && bedAfterCatnap > bedLatest + 30 * MIN
    if (bedAt >= bedEarliest - 30 * MIN || (noRoom && bedAt >= bedEarliest - 90 * MIN)) {
      kind = 'night'
      ww = longest
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
    adjust,
    fit,
    windowId: last.id,
    isMorning: last.kind === 'night',
  }
}

// He woke near morning: start the day, or treat it as a night wake a bit longer?
//
// How much night sleep he needs depends on the day before: day and night sleep
// trade off, so a big nap day means a little less overnight and a light one a
// little more. Morning is when he's had about that much sleep since he fell
// asleep (not counting time awake in the night), but never before your morning
// time, never more than 12 hours after he went down, and never more than 45
// minutes of waiting once it's morning.
const MORNING_WAIT_MAX = 45

export function morningWakeAdvice({ s, wake, band, sessions, morningTime, nowMs }) {
  if (!band || !s.asleep_at) return null
  const woke = ms(wake.woke_at)
  const morning = atTime(morningTime, woke)
  if (woke < morning - 90 * MIN || new Date(woke).getHours() >= 12) return null

  const earlier = wakesOf(s).filter((w) => w.id !== wake.id && ms(w.woke_at) < woke)
  const st = stats({ ...s, ended_at: null }, earlier, woke)
  const down = ms(s.started_at)
  const asleep = ms(s.asleep_at)

  const naps = sessions.filter((x) => x.kind === 'nap' && x.ended_at && ms(x.started_at) < down && ms(x.started_at) > down - 14 * HOUR)
  const daySleep = naps.reduce((a, x) => a + stats(x, wakesOf(x)).sleep, 0)
  const dayMid = (band.daySleep[0] + band.daySleep[1]) / 2
  const nightMid = (band.night[0] + band.night[1]) / 2
  const shift = naps.length ? clamp((dayMid - daySleep / MIN) / 2, -30, 30) : 0
  const need = Math.round((nightMid + shift) / 5) * 5 * MIN

  let target = asleep + st.awake + need
  let cap = null
  if (target < morning) (target = morning), (cap = 'morning')
  if (target > down + 12 * HOUR) (target = down + 12 * HOUR), (cap = '12h')
  const waitLimit = woke + MORNING_WAIT_MAX * MIN
  if (target > Math.max(morning, waitLimit)) (target = Math.max(morning, waitLimit)), (cap = waitLimit > morning ? 'wait' : 'morning')
  target = Math.ceil(target / (5 * MIN)) * 5 * MIN

  const sleptLine = `He’s slept ${fmtDur(st.sleep)} since ${fmtClock(asleep)}${st.awake >= 5 * MIN ? `, not counting ${fmtDur(st.awake)} awake overnight` : ''}.`
  const dayLine = !naps.length
    ? ''
    : ` Yesterday’s naps added up to ${fmtDur(daySleep)}${shift <= -10 ? ', on the high side, so he needs a little less at night' : shift >= 10 ? ', on the light side, so he could use a little more tonight' : ''}.`
  const needLine = ` He needs about ${fmtDur(need)} overnight.`

  let verdict, title, body
  if (target - woke <= 10 * MIN) {
    verdict = 'up'
    title = 'Good morning — start the day'
    body = `${sleptLine}${dayLine}${needLine} Close enough: lights on, a cheerful hello and a feed.`
  } else {
    verdict = 'wait'
    const why =
      cap === 'morning' ? ` It’s still before your ${fmtClock(morning)} morning time.`
      : cap === '12h' ? ` That’s 12 hours after he went down.`
      : cap === 'wait' ? ` That’s as long as it’s worth waiting this morning.`
      : ''
    title = `Give him until ${fmtClock(target)}`
    body = `${sleptLine}${dayLine}${needLine}${why} Treat it like a night wake until then. If he’s still awake at ${fmtClock(target)}, get him up and start the day.`
  }
  const deadline = verdict === 'wait' ? target : null
  return { verdict, title, body, need, daySleep, slept: st.sleep, deadline, deadlineLabel: deadline && fmtClock(deadline), expired: deadline != null && nowMs >= deadline }
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
