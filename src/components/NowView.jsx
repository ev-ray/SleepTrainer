import { db, nameOf, now, settings } from '../lib/store.js'
import { active, lastEnded, lastFeed, nightNumber, openWake, sortedSessions, stats, wakesOf, days, daySummary } from '../lib/metrics.js'
import { ageInfo, SHORT_NAP_MIN } from '../lib/age.js'
import { morningWakeAdvice, napWakeAdvice, nextUp } from '../lib/schedule.js'
import { backAsleep, endSession, markAsleep, nightWake, startSession, toggleCheck, toggleFed } from '../lib/actions.js'
import { HOUR, MIN, atTime, dayKey, fmtClock, fmtDur, fmtMins, ms } from '../lib/time.js'
import { CHECKLISTS, whatsNormal } from '../content/guide.js'
import { Alert, Bottle, Check, Eye, Info, Leaf, Moon, Pencil, Stop, Sun, Zzz } from './icons.jsx'

export function NowView({ onPlaybook, onTab, onEdit }) {
  const s = active.value
  const t = now.value
  let body
  if (!s) body = <Awake t={t} onPlaybook={onPlaybook} onEdit={onEdit} />
  else if (!s.asleep_at) body = <Settling s={s} t={t} onPlaybook={onPlaybook} onEdit={onEdit} />
  else if (s.kind === 'nap' && openWake.value) body = <NapStirring s={s} w={openWake.value} t={t} onEdit={onEdit} />
  else if (s.kind === 'nap') body = <NapAsleep s={s} t={t} onPlaybook={onPlaybook} onEdit={onEdit} />
  else if (openWake.value) body = <NightAwake s={s} w={openWake.value} t={t} onPlaybook={onPlaybook} onEdit={onEdit} />
  else body = <NightAsleep s={s} t={t} onEdit={onEdit} />
  return (
    <>
      {body}
      <TodaySummary t={t} onTab={onTab} />
    </>
  )
}

// ─── Shared bits ─────────────────────────────────────────────────────────────
function Timer({ from, t }) {
  const d = Math.max(0, t - from)
  const h = Math.floor(d / HOUR)
  const m = Math.floor((d % HOUR) / MIN)
  const sec = Math.floor((d % MIN) / 1000)
  return (
    <div class="timer" aria-live="off">
      {h > 0 ? (
        <>
          {h}<small>h</small> {String(m).padStart(2, '0')}<small>m</small>
        </>
      ) : (
        <>
          {m}<small>m</small> <span class="sec">{String(sec).padStart(2, '0')}<small>s</small></span>
        </>
      )}
    </div>
  )
}

// The big status card. Tapping anywhere on it (other than its buttons) opens
// the full editor, so a late start can be fixed without leaving the screen.
function Hero({ kind, onEdit, children }) {
  const open = (e) => onEdit && !e.target.closest('button') && onEdit()
  return (
    <section class={`hero ${kind}${onEdit ? ' tappable' : ''}`} onClick={open}>
      {onEdit && (
        <button class="edit-pill" onClick={onEdit} aria-label="Edit times">
          <Pencil /> Edit
        </button>
      )}
      {children}
    </section>
  )
}

function MoonDeco() {
  return (
    <svg class="moon-deco" viewBox="0 0 100 100" aria-hidden="true">
      <path d="M62 14a38 38 0 1 0 24 58A32 32 0 1 1 62 14z" fill="currentColor" />
    </svg>
  )
}

function SunDeco() {
  return (
    <svg class="moon-deco" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="55" cy="45" r="30" fill="currentColor" />
    </svg>
  )
}

function Banner({ tone = 'calm', icon, title, children, link, onLink }) {
  const Icon = icon || (tone === 'warn' ? Alert : Info)
  return (
    <div class={`banner ${tone}`}>
      <Icon />
      <div>
        {title && <b>{title}</b>}
        <span class="small">{children}</span>
        {link && (
          <>
            <br />
            <button class="link" onClick={onLink}>{link}</button>
          </>
        )}
      </div>
    </div>
  )
}

function recentLatency(kind, excludeId) {
  const done = sortedSessions.value
    .filter((x) => x.kind === kind && x.asleep_at && x.id !== excludeId)
    .slice(-3)
  if (!done.length) return null
  return done.reduce((a, x) => a + (ms(x.asleep_at) - ms(x.started_at)), 0) / done.length
}

function napIndex(s) {
  const k = dayKey(s.started_at)
  return sortedSessions.value.filter((x) => x.kind === 'nap' && dayKey(x.started_at) === k && ms(x.started_at) <= ms(s.started_at)).length
}

function title(s) {
  if (s.kind === 'nap') return `Nap ${napIndex(s)}`
  const n = nightNumber(s)
  return n ? `Night ${n}` : 'Night'
}

// ─── States ──────────────────────────────────────────────────────────────────
function Settling({ s, t, onPlaybook, onEdit }) {
  const start = ms(s.started_at)
  const limit = (settings.value?.nap_limit_min || 60) * MIN
  const overLimit = s.kind === 'nap' && t - start > limit
  const avg = recentLatency(s.kind, s.id)
  const n = s.kind === 'night' ? nightNumber(s) : null
  return (
    <>
      <Hero kind={s.kind} onEdit={() => onEdit(s.id)}>
        {s.kind === 'night' ? <MoonDeco /> : <SunDeco />}
        <div class="eyebrow">{s.kind === 'night' ? <Moon /> : <Sun />} {title(s)}</div>
        <div class="status">{s.kind === 'night' ? 'Bedtime — settling' : 'Settling for a nap'}</div>
        <Timer from={start} t={t} />
        <div class="sub">
          Down at {fmtClock(start)} · {nameOf(s.started_by)}
          {avg != null && <> · lately takes ~{fmtDur(avg)}</>}
        </div>
        <div class="actions">
          <button class="btn primary" onClick={() => markAsleep(s)}>
            <Zzz /> He’s asleep
          </button>
          {s.kind === 'nap' ? (
            <button class="btn secondary" onClick={() => endSession(s)}>
              <Stop /> Didn’t fall asleep — end attempt
            </button>
          ) : (
            <button class="btn ghost" onClick={() => endSession(s)}>End night</button>
          )}
        </div>
      </Hero>
      {overLimit && (
        <Banner tone="warn" title="It’s been over an hour" link="What to do" onLink={() => onPlaybook('noSleep')}>
          Time to end this attempt. Get him up calmly — the next window will be shortened.
        </Banner>
      )}
      {s.kind === 'night' && n && <Banner icon={Moon}>{whatsNormal(n)}</Banner>}
    </>
  )
}

function NapAsleep({ s, t, onPlaybook, onEdit }) {
  const asleep = ms(s.asleep_at)
  const wakes = wakesOf(s)
  const stretchFrom = wakes.length ? ms(wakes.at(-1).asleep_at) : asleep
  const st = stats(s, wakes, t)
  const age = ageInfo(settings.value, t)
  const cap = (age?.band.napCap || 120) * MIN
  const long = st.sleep > cap
  return (
    <>
      <Hero kind="nap" onEdit={() => onEdit(s.id)}>
        <SunDeco />
        <div class="eyebrow"><Sun /> {title(s)}</div>
        <div class="status">{wakes.length ? 'Back asleep' : 'Napping'}</div>
        <Timer from={stretchFrom} t={t} />
        <div class="sub">
          {wakes.length
            ? `Resettled at ${fmtClock(stretchFrom)} · ${fmtDur(st.sleep)} asleep in total`
            : `Asleep at ${fmtClock(asleep)} · took ${fmtDur(asleep - ms(s.started_at))}`}
          {' · '}wake by {fmtClock(t + Math.max(0, cap - st.sleep))}
        </div>
        <div class="actions">
          <button class="btn primary" onClick={() => nightWake(s)}>
            <Eye /> He woke up
          </button>
          <button class="btn ghost" onClick={() => endSession(s)}>Nap’s over — get him up</button>
        </div>
      </Hero>
      {long ? (
        <Banner tone="warn" title="Nap is running long" link="Why cap naps?" onLink={() => onPlaybook('long')}>
          Past {fmtMins(cap / MIN)}. Wake him gently to protect tonight’s sleep.
        </Banner>
      ) : !wakes.length && t - asleep < SHORT_NAP_MIN * MIN ? (
        <Banner icon={Leaf}>
          If he wakes early, tap “He woke up” — the app will tell you whether to wait for him to resettle.
        </Banner>
      ) : null}
    </>
  )
}

// Woke mid-nap: the nap isn't over until we decide it is.
function NapStirring({ s, w, t, onEdit }) {
  const woke = ms(w.woke_at)
  const age = ageInfo(settings.value, t)
  const a = napWakeAdvice({ s, wake: w, band: age?.band, nowMs: t })
  const callIt = a.verdict === 'up' || a.expired
  const left = a.deadline ? a.deadline - t : 0
  const upBtn = (
    <button class={`btn ${callIt ? 'primary' : 'secondary'}`} onClick={() => endSession(s)}>
      <Sun /> Nap’s over
    </button>
  )
  const backBtn = (
    <button class={`btn ${callIt ? 'secondary' : 'primary'}`} onClick={() => backAsleep(w)}>
      <Zzz /> Back asleep
    </button>
  )
  return (
    <>
      <Hero kind="nap" onEdit={() => onEdit(s.id)}>
        <SunDeco />
        <div class="eyebrow"><Sun /> {title(s)} · stirring</div>
        <div class="status">Awake in the crib</div>
        <Timer from={woke} t={t} />
        <div class="sub">
          Woke at {fmtClock(woke)} after {fmtDur(a.slept)} asleep
          {a.deadline && !a.expired && ` · wait until ${a.deadlineLabel} (${Math.ceil(left / MIN)}m left)`}
        </div>
        <div class="actions">
          {callIt ? upBtn : backBtn}
          {callIt ? backBtn : upBtn}
        </div>
      </Hero>
      {a.expired ? (
        <Banner tone="warn" title="Time’s up — the nap is over">
          He’s had {fmtDur(t - woke)} to resettle. Get him up{a.slept < SHORT_NAP_MIN * MIN ? ' — the next wake window will be shortened for the short nap.' : ' and start the next wake window.'}
        </Banner>
      ) : (
        <Banner tone="calm" icon={a.verdict === 'up' ? Sun : Leaf} title={a.title}>
          {a.body}
        </Banner>
      )}
    </>
  )
}

function NightAsleep({ s, t, onEdit }) {
  const wakes = wakesOf(s)
  const lastBack = wakes.length ? ms(wakes.at(-1).asleep_at) : ms(s.asleep_at)
  const morning = atTime(settings.value?.morning_time?.slice(0, 5) || '06:00', t)
  const isMorning = t >= morning && new Date(t).getHours() < 12
  const wakeBtn = (
    <button class={`btn ${isMorning ? 'secondary' : 'primary'}`} onClick={() => nightWake(s)}>
      <Eye /> He woke up
    </button>
  )
  const upBtn = (
    <button class={`btn ${isMorning ? 'primary' : 'secondary'}`} onClick={() => endSession(s)}>
      <Sun /> Up for the day
    </button>
  )
  return (
    <Hero kind="night" onEdit={() => onEdit(s.id)}>
      <MoonDeco />
      <div class="eyebrow"><Moon /> {title(s)}</div>
      <div class="status">Asleep</div>
      <Timer from={lastBack} t={t} />
      <div class="sub">
        {wakes.length ? `This stretch since ${fmtClock(lastBack)}` : `Asleep since ${fmtClock(lastBack)}`}
        {' · '}
        {wakes.length === 0 ? 'no wakes yet' : `${wakes.length} wake${wakes.length > 1 ? 's' : ''} so far`}
      </div>
      <div class="actions">
        {isMorning ? upBtn : wakeBtn}
        {isMorning ? wakeBtn : upBtn}
      </div>
    </Hero>
  )
}

function NightAwake({ s, w, t, onPlaybook, onEdit }) {
  const woke = ms(w.woke_at)
  const wakes = wakesOf(s)
  const idx = wakes.findIndex((x) => x.id === w.id) + 1
  const interval = Number(settings.value?.feed_interval_hours) || null
  const fedAt = lastFeed(s)
  const sinceFeed = woke - fedAt
  const feedDue = interval ? sinceFeed >= interval * HOUR : null
  const morningStr = settings.value?.morning_time?.slice(0, 5) || '06:00'
  const morning = atTime(morningStr, t)
  const nearMorning = t < morning && morning - t < 2 * HOUR
  const age = ageInfo(settings.value, t)
  const m = morningWakeAdvice({ s, wake: w, band: age?.band, sessions: sortedSessions.value, morningTime: morningStr, nowMs: t })
  const callIt = m && (m.verdict === 'up' || m.expired)
  const left = m?.deadline ? m.deadline - t : 0

  // A long wake since the last logged feed that isn't marked as one was
  // probably a feed someone forgot to log — it would restart the feed clock.
  const missed = wakes
    .filter((x) => x.id !== w.id && !x.fed && ms(x.woke_at) > fedAt && ms(x.woke_at) < woke && x.asleep_at)
    .filter((x) => ms(x.asleep_at) - ms(x.woke_at) >= 15 * MIN)
    .at(-1)

  let feedNote
  if (w.fed) feedNote = <Banner tone="calm" icon={Bottle} title="Feeding">Keep it dark and boring. Burp, then back down awake.</Banner>
  else if (callIt) feedNote = null
  else if (interval) {
    feedNote = feedDue ? (
      <Banner tone="calm" icon={Bottle} title="This can be a feed">
        Last fed {fmtDur(sinceFeed)} before this wake. Your plan is every {interval}h or more.
      </Banner>
    ) : (
      <Banner icon={Moon} title="Not a feed — stay out" link="Night-wake plan" onLink={() => onPlaybook('nightWake')}>
        Last fed {fmtDur(sinceFeed)} before this wake. Next feed from {fmtClock(fedAt + interval * HOUR)}.
      </Banner>
    )
  } else {
    feedNote = (
      <Banner icon={Bottle}>
        Last fed {fmtDur(sinceFeed)} ago. Set a night-feed plan in Guide → Settings and this card will tell you whether it’s a feed.
      </Banner>
    )
  }

  // When a feed is on the table, going back down asks whether he ate, so the
  // feed clock is always right the next time he wakes.
  const askFed = !w.fed && !callIt && feedDue !== false
  const upBtn = (
    <button class={`btn ${callIt ? 'primary' : 'secondary'}`} onClick={() => endSession(s)}>
      <Sun /> Up for {callIt ? 'the day' : 'day'}
    </button>
  )
  const feedBtn = (
    <button class="btn secondary" onClick={() => toggleFed(w)} aria-pressed={w.fed}>
      {w.fed ? <Check /> : <Bottle />} {w.fed ? 'Fed · undo' : 'Log a feed'}
    </button>
  )

  return (
    <>
      <Hero kind="night" onEdit={() => onEdit(s.id)}>
        <MoonDeco />
        <div class="eyebrow"><Moon /> {title(s)} · {m ? 'early morning' : `wake ${idx}`}</div>
        <div class="status">Awake</div>
        <Timer from={woke} t={t} />
        <div class="sub">
          Woke at {fmtClock(woke)} · {nameOf(w.logged_by)}
          {m?.deadline && !m.expired && ` · wait until ${m.deadlineLabel} (${Math.ceil(left / MIN)}m left)`}
        </div>
        <div class="actions">
          {callIt ? (
            <>
              {upBtn}
              <button class="btn secondary" onClick={() => backAsleep(w)}><Zzz /> Back asleep</button>
            </>
          ) : askFed ? (
            <>
              <div class="actions two" style="margin-top:0">
                <button class="btn primary" onClick={() => backAsleep(w, true)}><Bottle /> Fed, back asleep</button>
                <button class="btn primary" onClick={() => backAsleep(w, false)}><Zzz /> Back asleep, no feed</button>
              </div>
              <button class="btn ghost" onClick={() => endSession(s)}>Up for the day</button>
            </>
          ) : (
            <>
              <button class="btn primary" onClick={() => backAsleep(w)}><Zzz /> Back asleep</button>
              <div class="actions two" style="margin-top:0">
                {feedBtn}
                {upBtn}
              </div>
            </>
          )}
        </div>
      </Hero>
      {m &&
        (m.expired ? (
          <Banner tone="warn" icon={Sun} title="Time to start the day">
            It’s {m.deadlineLabel}. Get him up with lights on and a cheerful hello, even if he’s crying.
          </Banner>
        ) : (
          <Banner tone="calm" icon={m.verdict === 'up' ? Sun : Leaf} title={m.title} link={m.verdict === 'wait' ? 'Early waking' : null} onLink={() => onPlaybook('early')}>
            {m.body}
          </Banner>
        ))}
      {missed && !callIt && (
        <Banner icon={Bottle} title={`Did he feed at ${fmtClock(ms(missed.woke_at))}?`} link="Yes, mark it as a feed" onLink={() => toggleFed(missed)}>
          That wake lasted {fmtDur(ms(missed.asleep_at) - ms(missed.woke_at))} but isn’t logged as a feed, so the feed clock still counts from {fmtClock(fedAt)}.
        </Banner>
      )}
      {feedNote}
      {nearMorning && !w.fed && !m && (
        <Banner icon={Info} link="Early waking" onLink={() => onPlaybook('early')}>
          Before {fmtClock(morning)} is still night — respond the same way.
        </Banner>
      )}
    </>
  )
}

function Awake({ t, onPlaybook, onEdit }) {
  const last = lastEnded.value
  const age = ageInfo(settings.value, t)
  const stale = last && t - ms(last.ended_at) > 8 * HOUR
  const plan = !stale && age ? nextUp({ sessions: sortedSessions.value, last, band: age.band, nowMs: t }) : null

  if (!plan) {
    return (
      <Hero kind="nap" onEdit={last && (() => onEdit(last.id))}>
        <SunDeco />
        <div class="eyebrow"><Sun /> Awake</div>
        <div class="status">{last ? 'Ready when he is' : 'Welcome'}</div>
        <p class="sub" style="margin-top:8px">
          {!age
            ? 'Add his birthday in Guide → Settings so the schedule can follow his age.'
            : last
              ? `Last logged ${fmtClock(ms(last.ended_at))}. Start his next sleep when it’s time.`
              : 'Start by logging his next nap or bedtime.'}
        </p>
        <div class="actions two">
          <button class="btn nap" onClick={() => startSession('nap')}><Sun /> Start nap</button>
          <button class="btn night" onClick={() => startSession('night')}><Moon /> Bedtime</button>
        </div>
      </Hero>
    )
  }

  const elapsed = t - plan.awakeSince
  const total = plan.target - plan.awakeSince
  const pct = Math.min(100, (elapsed / total) * 100)
  const left = plan.target - t
  const inWindDown = t >= plan.windDownAt
  const over = left < -20 * MIN
  const isBed = plan.kind === 'night'
  const what = isBed ? 'Bedtime' : `Nap ${plan.napNumber}`
  const pctOff = Math.round((plan.fit.factor - 1) * 100)

  return (
    <>
      <Hero kind={isBed ? 'night' : 'nap'} onEdit={() => onEdit(last.id)}>
        {isBed ? <MoonDeco /> : <SunDeco />}
        <div class="eyebrow">
          <Sun /> {plan.isMorning ? 'Good morning' : `After nap ${plan.index}`}
        </div>
        <div class="status">Awake</div>
        <Timer from={plan.awakeSince} t={t} />
        <div class="sub">
          {what} around <b>{fmtClock(plan.target)}</b>
          {left > 0 ? ` · in ${fmtDur(left)}` : left > -5 * MIN ? ' · now' : ` · ${fmtDur(-left)} past`}
        </div>
        <div class="ww">
          <div class="bar">
            <div class={`fill ${inWindDown ? 'soon' : ''}`} style={{ transform: `translateX(${pct - 100}%)` }} />
          </div>
          <div class="labels">
            <span>Wind down {fmtClock(plan.windDownAt)}</span>
            <span>{fmtMins(plan.ww)} window</span>
          </div>
        </div>
        <div class="actions">
          <button class={`btn primary`} onClick={() => startSession(plan.kind)}>
            {isBed ? <Moon /> : <Sun />} Start {isBed ? 'bedtime' : `nap ${plan.napNumber}`}
          </button>
          <button class="btn ghost" onClick={() => startSession(isBed ? 'nap' : 'night')}>
            Start {isBed ? 'a nap' : 'bedtime'} instead
          </button>
        </div>
      </Hero>

      {plan.reason === 'short' && (
        <Banner title="Short nap" link="Short-nap plan" onLink={() => onPlaybook('short')}>
          Very normal at this age. The next window is 15 minutes shorter so he doesn’t get overtired.
        </Banner>
      )}
      {plan.reason === 'noSleep' && (
        <Banner tone="warn" title="No nap that time" link="What to do" onLink={() => onPlaybook('noSleep')}>
          It happens, especially early on. Next window pulled in 20 minutes; aim for the next nap on time.
        </Banner>
      )}
      {plan.reason === 'long' && (
        <Banner icon={Leaf} title="Great nap">
          He’s well rested, so this window runs a little longer.
        </Banner>
      )}
      {plan.reason === 'shortNight' && (
        <Banner title="Short night">
          He’ll tire sooner this morning, so the first window is 15 minutes shorter.
        </Banner>
      )}
      {over && (
        <Banner tone="warn" title="Past his window">
          He’s been up {fmtDur(elapsed)}. Start the wind-down now — overtired babies fight sleep harder.
        </Banner>
      )}

      <Checklist plan={plan} t={t} />

      {age && (
        <p class="tiny" style="margin:-4px 6px 12px">
          Windows at {age.band.label}: {fmtMins(age.band.ww[0])}–{fmtMins(age.band.ww[1])}, shortest in the morning.
          {Math.abs(pctOff) >= 5 &&
            ` His last few days of naps say he does best on windows about ${Math.abs(pctOff)}% ${pctOff < 0 ? 'shorter' : 'longer'}, so the plan follows him. It keeps adjusting as you log.`}
        </p>
      )}
    </>
  )
}

function Checklist({ plan }) {
  const type = plan.isMorning ? 'morning' : plan.kind === 'night' ? 'bedtime' : 'nap'
  const items = CHECKLISTS[type]
  const checks = db.checks.value
  const whenFor = (item) => {
    if (item.at === 'winddown') return fmtClock(plan.windDownAt)
    if (item.at === 'routine') return fmtClock(plan.target - 30 * MIN)
    if (item.key === 'down') return fmtClock(plan.target)
    return null
  }
  const doneCount = items.filter((i) => checks.some((c) => c.id === `${plan.windowId}:${i.key}`)).length
  return (
    <section class="card">
      <div class="spread">
        <h2>{type === 'bedtime' ? 'Before bed' : type === 'morning' ? 'Morning' : 'Before the next nap'}</h2>
        <span class="tiny">{doneCount}/{items.length}</span>
      </div>
      <ul class="checklist">
        {items.map((item) => {
          const c = checks.find((x) => x.id === `${plan.windowId}:${item.key}`)
          const when = whenFor(item)
          return (
            <li key={item.key} class={c ? 'done' : ''}>
              <button onClick={() => toggleCheck(plan.windowId, item.key, !!c)} aria-pressed={!!c}>
                <span class="check"><Check width="16" height="16" /></span>
                <span>
                  <span class="item-text">{item.text}</span>
                  {c ? (
                    <span class="item-hint item-who">✓ {nameOf(c.done_by)} · {fmtClock(ms(c.done_at))}</span>
                  ) : (
                    item.hint && <span class="item-hint">{item.hint}</span>
                  )}
                </span>
                {when && <span class="item-when">{when}</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function TodaySummary({ t, onTab }) {
  const today = dayKey(t)
  const map = days.value
  // "Last night" = the most recent finished night.
  const lastNight = [...sortedSessions.value].reverse().find((x) => x.kind === 'night' && x.ended_at)
  const ln = lastNight ? stats(lastNight, wakesOf(lastNight), t) : null
  const todayDay = map.get(today)
  const sum = todayDay ? daySummary(todayDay, t) : null
  const naps = sum?.naps.filter((n) => !n.st.open) || []
  if (!ln && !naps.length) return null
  return (
    <>
      <div class="section-label">So far</div>
      {ln && (
        <button class="card entry" style="width:100%;text-align:left;border:0;display:block" onClick={() => onTab('history')}>
          <div class="spread" style="margin-bottom:10px">
            <h3 style="margin:0">Last night</h3>
            <span class="tiny">
              {fmtClock(ln.start)} – {fmtClock(ln.end)}
            </span>
          </div>
          <div class="tiles">
            <div class="tile night"><div class="v">{fmtDur(ln.sleep)}</div><div class="k">asleep</div></div>
            <div class="tile night">
              <div class="v">{ln.wakeCount}</div>
              <div class="k">wake{ln.wakeCount === 1 ? '' : 's'}{ln.fedCount ? ` · ${ln.fedCount} fed` : ''}</div>
            </div>
            <div class="tile night"><div class="v">{ln.latency != null ? fmtDur(ln.latency) : '—'}</div><div class="k">to fall asleep</div></div>
          </div>
        </button>
      )}
      {naps.length > 0 && (
        <button class="card entry" style="width:100%;text-align:left;border:0;display:block" onClick={() => onTab('history')}>
          <div class="spread">
            <h3 style="margin:0">Today’s naps</h3>
            <span class="tiny">{fmtDur(sum.napSleep)} total</span>
          </div>
          <div class="chips">
            {naps.map(({ s, st }) => (
              <span key={s.id} class={`chip ${st.noSleep ? 'fail' : ''}`}>
                {fmtClock(st.start)} · {st.noSleep ? 'no sleep' : fmtDur(st.sleep)}
              </span>
            ))}
          </div>
        </button>
      )}
    </>
  )
}
