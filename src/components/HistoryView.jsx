import { useState } from 'preact/hooks'
import { nameOf, now } from '../lib/store.js'
import { days, daySummary, nightNumber, stats, wakesOf } from '../lib/metrics.js'
import { dayKey, fmtClock, fmtDay, fmtDur, ms } from '../lib/time.js'
import { Chevron, Moon, Pencil, Plus, Sun } from './icons.jsx'

export function HistoryView({ onEdit, onAdd }) {
  const [limit, setLimit] = useState(10)
  const t = now.peek()
  const keys = [...days.value.keys()].sort().reverse()
  const today = dayKey(t)

  if (!keys.length) {
    return (
      <div class="empty">
        <h2>Nothing logged yet</h2>
        <p>Start a nap or bedtime from the Now tab and it’ll show up here.</p>
        <button class="btn secondary" style="margin-top:16px" onClick={onAdd}><Plus /> Add a past sleep</button>
      </div>
    )
  }

  return (
    <>
      <div class="spread" style="margin:8px 4px 0">
        <span class="tiny">Tap a sleep to see every step.</span>
        <button class="btn secondary small" onClick={onAdd}><Plus /> Add past sleep</button>
      </div>
      {keys.slice(0, limit).map((k) => (
        <Day key={k} sum={daySummary(days.value.get(k), t)} today={today} onEdit={onEdit} />
      ))}
      {keys.length > limit && (
        <button class="btn ghost" style="width:100%" onClick={() => setLimit(limit + 14)}>Show earlier days</button>
      )}
    </>
  )
}

function Day({ sum, today, onEdit }) {
  const night = sum.night
  return (
    <section>
      <div class="day-head">
        <h2>{fmtDay(sum.key, today)}</h2>
        <span class="tiny">
          {sum.napCount} nap{sum.napCount === 1 ? '' : 's'} · {fmtDur(sum.napSleep)}
          {night && !night.st.open && ` · ${fmtDur(sum.total)} total`}
        </span>
      </div>
      {night && <NightEntry s={night.s} st={night.st} onEdit={onEdit} />}
      {sum.naps.map(({ s, st }, i) => (
        <NapEntry key={s.id} s={s} st={st} n={i + 1} onEdit={onEdit} />
      )).reverse()}
    </section>
  )
}

// One nap or night: a one-line summary, tap to open the full timeline.
function Entry({ kind, icon, label, right, summary, children, notes, onEdit }) {
  const [open, setOpen] = useState(false)
  return (
    <div class={`entry ${kind}${open ? ' open' : ''}`}>
      <button class="entry-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <div class="top">
          {icon} {label}
          <span class="right">{right}</span>
          <Chevron class="chev" width="18" height="18" />
        </div>
        <p class="small muted entry-sum">{summary}</p>
      </button>
      {open && (
        <div class="entry-body">
          {children}
          {notes && <p class="small muted" style="margin-top:6px">{notes}</p>}
          <button class="btn ghost small entry-edit" onClick={onEdit}>
            <Pencil width="16" height="16" /> Edit
          </button>
        </div>
      )}
    </div>
  )
}

const span = (st) => `${fmtClock(st.start)} – ${st.open ? 'now' : fmtClock(st.end)}`

function NapEntry({ s, st, n, onEdit }) {
  const wakes = wakesOf(s)
  const summary = [
    span(st),
    st.latency != null && `asleep in ${fmtDur(st.latency)}`,
    wakes.length > 0 && `stirred ${wakes.length}×`,
    s.notes && 'note',
  ].filter(Boolean).join(' · ')
  return (
    <Entry
      kind="nap" icon={<Sun width="18" height="18" />} label={`Nap ${n}`}
      right={st.noSleep ? 'No sleep' : st.open ? 'In progress' : fmtDur(st.sleep)}
      summary={summary} notes={s.notes} onEdit={() => onEdit(s.id)}
    >
      <ul class="timeline">
        <li>
          <b>{fmtClock(st.start)}</b> down <span class="by">· {nameOf(s.started_by)}</span>
        </li>
        {st.asleep && (
          <li>
            <b>{fmtClock(st.asleep)}</b> asleep after {fmtDur(st.latency)} <span class="by">· {nameOf(s.asleep_by)}</span>
          </li>
        )}
        {wakes.map((w) => (
          <li key={w.id} class="wake">
            <b>{fmtClock(ms(w.woke_at))}</b> stirred
            {w.asleep_at ? ` · resettled after ${fmtDur(ms(w.asleep_at) - ms(w.woke_at))}` : ' · awake'}{' '}
            <span class="by">· {nameOf(w.logged_by)}</span>
          </li>
        ))}
        {s.ended_at && (
          <li>
            <b>{fmtClock(st.end)}</b> {st.noSleep ? 'attempt ended' : 'up'} <span class="by">· {nameOf(s.ended_by)}</span>
          </li>
        )}
      </ul>
    </Entry>
  )
}

function NightEntry({ s, st, onEdit }) {
  const wakes = wakesOf(s)
  const n = nightNumber(s)
  const summary = [
    span(st),
    `${st.wakeCount} wake${st.wakeCount === 1 ? '' : 's'}${st.fedCount ? ` (${st.fedCount} fed)` : ''}`,
    st.longest > 0 && `longest ${fmtDur(st.longest)}`,
    s.notes && 'note',
  ].filter(Boolean).join(' · ')
  return (
    <Entry
      kind="night" icon={<Moon width="18" height="18" />} label={n ? `Night ${n}` : 'Night'}
      right={st.open ? 'In progress' : fmtDur(st.sleep)}
      summary={summary} notes={s.notes} onEdit={() => onEdit(s.id)}
    >
      <ul class="timeline">
        <li>
          <b>{fmtClock(st.start)}</b> bedtime <span class="by">· {nameOf(s.started_by)}</span>
        </li>
        {st.asleep && (
          <li>
            <b>{fmtClock(st.asleep)}</b> asleep after {fmtDur(st.latency)} <span class="by">· {nameOf(s.asleep_by)}</span>
          </li>
        )}
        {wakes.map((w) => (
          <li key={w.id} class={w.fed ? 'fed' : 'wake'}>
            <b>{fmtClock(ms(w.woke_at))}</b> woke
            {w.asleep_at ? ` · back asleep after ${fmtDur(ms(w.asleep_at) - ms(w.woke_at))}` : ' · awake'}
            {w.fed && ' · fed'} <span class="by">· {nameOf(w.logged_by)}</span>
          </li>
        ))}
        {s.ended_at && (
          <li>
            <b>{fmtClock(st.end)}</b> up for the day <span class="by">· {nameOf(s.ended_by)}</span>
          </li>
        )}
      </ul>
    </Entry>
  )
}
