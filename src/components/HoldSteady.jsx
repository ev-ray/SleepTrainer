import { useEffect, useMemo, useState } from 'preact/hooks'
import { now, settings } from '../lib/store.js'
import { active, nightNumber, nightsInTraining, openWake, stats, wakesOf } from '../lib/metrics.js'
import { fmtDur, ms } from '../lib/time.js'
import { COPING, GO_IN_IF, REMINDERS, RESEARCH, whatsNormal } from '../content/guide.js'

// Full-screen calm space for the moment you're about to go in.
export function HoldSteady({ onClose }) {
  const t = now.value
  const reminder = useMemo(() => REMINDERS[Math.floor(Math.random() * REMINDERS.length)], [])
  const s = active.value
  const w = openWake.value
  const crying = w ? ms(w.woke_at) : s && !s.asleep_at ? ms(s.started_at) : null
  const nightNo = s?.kind === 'night' ? nightNumber(s) : null
  const why = settings.value?.why_note

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [])

  // Evidence from his own log: first nights vs the most recent one.
  const done = nightsInTraining.value.filter((n) => n.ended_at && n.asleep_at)
  const first = done[0] && stats(done[0], wakesOf(done[0]))
  const latest = done.length > 1 && stats(done.at(-1), wakesOf(done.at(-1)))

  return (
    <div class="hold" role="dialog" aria-modal="true" aria-label="Hold steady">
      <div class="hold-inner">
        <div class="spread">
          <span class="tiny" style="letter-spacing:.08em;text-transform:uppercase;font-weight:700">Hold steady</span>
          <button class="close" onClick={onClose}>Close</button>
        </div>

        <h1>{reminder}</h1>
        {crying && (
          <p class="lead">
            {w ? 'Awake' : 'Settling'} for <b>{t - crying < 60000 ? 'under a minute' : fmtDur(t - crying)}</b>. {nightNo ? whatsNormal(nightNo) : 'Short protest crying at naps is normal while he learns.'}
          </p>
        )}

        <Breathe />

        {first && latest && (
          <div class="panel">
            <h3>It’s already working</h3>
            <div class="progress">
              <div>
                <div class="tiny">Night 1</div>
                <div class="big-num">{fmtDur(first.latency)}</div>
                <div class="small" style="color:var(--ink-2)">to fall asleep · {first.wakeCount - first.fedCount} unfed wake{first.wakeCount - first.fedCount === 1 ? '' : 's'}</div>
              </div>
              <div>
                <div class="tiny">Night {done.length}</div>
                <div class="big-num">{fmtDur(latest.latency)}</div>
                <div class="small" style="color:var(--ink-2)">to fall asleep · {latest.wakeCount - latest.fedCount} unfed wake{latest.wakeCount - latest.fedCount === 1 ? '' : 's'}</div>
              </div>
            </div>
          </div>
        )}

        {why && (
          <div class="panel">
            <h3>Why we’re doing this</h3>
            <p class="why-note">“{why}”</p>
          </div>
        )}

        <div class="panel">
          <h3>Go in if…</h3>
          <ul>{GO_IN_IF.map((x) => <li key={x}>{x}</li>)}</ul>
          <p class="small" style="margin-top:10px;color:var(--ink-2)">Otherwise, he’s safe. The kindest thing now is to stay consistent.</p>
        </div>

        <div class="panel">
          <h3>Get through the next ten minutes</h3>
          <ul>{COPING.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>

        <div class="panel">
          <h3>What the research says</h3>
          <ul>
            {RESEARCH.filter((r) => ['price', 'gradisar', 'burst'].includes(r.id)).map((r) => (
              <li key={r.id}>
                <b>{r.takeaway}</b> <span style="color:var(--ink-3)">— {r.source}</span>
              </li>
            ))}
          </ul>
        </div>

        <button class="btn primary" onClick={onClose}>I’m okay — back to it</button>
      </div>
    </div>
  )
}

// 4s in, 4s hold, 6s out — matches the CSS animation.
function Breathe() {
  const [start] = useState(Date.now())
  const t = now.value
  const phase = ((t - start) / 1000) % 14
  const cue = phase < 4 ? 'Breathe in…' : phase < 8 ? 'Hold…' : 'And out, slowly…'
  return (
    <div class="breathe">
      <div class="orb" />
      <div class="cue">{cue}</div>
    </div>
  )
}
