import { useEffect } from 'preact/hooks'
import { now, settings } from '../lib/store.js'
import { ageInfo, wakeWindow } from '../lib/age.js'
import { fmtMins } from '../lib/time.js'
import { GO_IN_IF, PLAN, PLAYBOOK, RESEARCH } from '../content/guide.js'

const clock = (hm) => {
  const [h, m] = hm.split(':').map(Number)
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function GuideView({ focus, onSettings }) {
  const st = settings.value
  const age = ageInfo(st, now.peek())

  useEffect(() => {
    if (!focus) return
    const el = document.getElementById(`pb-${focus}`)
    if (el) {
      el.open = true
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [focus])

  return (
    <>
      {age ? <AgeCard age={age} name={st.baby_name} /> : (
        <section class="card">
          <h2>Add his birthday</h2>
          <p class="muted">Enter it in Settings and the whole app (wake windows, nap count, targets) will follow his age automatically.</p>
          <button class="btn secondary" style="margin-top:12px" onClick={onSettings}>Open settings</button>
        </section>
      )}

      <div class="section-label">CIO extinction method</div>
      <section class="card">
        {PLAN.map((p, i) => (
          <div class="plan-step" key={p.title}>
            <span class="n">{i + 1}</span>
            <div>
              <b>{p.title}</b>
              <p>{p.body}</p>
            </div>
          </div>
        ))}
      </section>

      <div class="section-label">Go in if…</div>
      <section class="card">
        <ul style="margin:0;padding-left:20px">
          {GO_IN_IF.map((x) => <li key={x} style="margin-bottom:6px">{x}</li>)}
        </ul>
      </section>

      <div class="section-label">When things don’t go to plan</div>
      {PLAYBOOK.map((p) => (
        <details class="acc" id={`pb-${p.id}`} key={p.id} open={focus === p.id}>
          <summary>{p.title}</summary>
          <div class="body">
            <ol>{p.steps.map((s) => <li key={s}>{s}</li>)}</ol>
            {p.why && <div class="why">{p.why}</div>}
          </div>
        </details>
      ))}

      <div class="section-label">The research</div>
      <section class="card">
        {RESEARCH.map((r) => (
          <div class="research" key={r.id}>
            <b>{r.title}</b>
            <p class="small" style="margin-top:3px">{r.finding}</p>
            <p class="take small">{r.takeaway}</p>
            <p class="src"><a href={r.url} target="_blank" rel="noopener">{r.source}</a></p>
          </div>
        ))}
      </section>
    </>
  )
}

function AgeCard({ age, name }) {
  const b = age.band
  const windows = Array.from({ length: b.naps[1] + 1 }, (_, i) => wakeWindow(b, i))
  return (
    <section class="card">
      <div class="tiny" style="font-weight:700;letter-spacing:.06em;text-transform:uppercase">{name} today</div>
      <div class="age-big" style="margin-top:6px">Day {age.days}</div>
      <p class="muted" style="margin-top:4px">
        {age.weeks} weeks{age.extraDays ? `, ${age.extraDays} day${age.extraDays > 1 ? 's' : ''}` : ''}
        {age.preterm && ' (adjusted)'} · {b.label}
      </p>
      <dl class="bench">
        <dt>Wake windows</dt><dd>{fmtMins(b.ww[0])} – {fmtMins(b.ww[1])}</dd>
        <dt>Naps</dt><dd>{b.naps[0] === b.naps[1] ? b.naps[0] : `${b.naps[0]}–${b.naps[1]}`} a day</dd>
        <dt>Longest single nap</dt><dd>~{fmtMins(b.napCap)}</dd>
        <dt>Day sleep</dt><dd>{fmtMins(b.daySleep[0])} – {fmtMins(b.daySleep[1])}</dd>
        <dt>Night sleep</dt><dd>{fmtMins(b.night[0])} – {fmtMins(b.night[1])}</dd>
        <dt>Total per 24h</dt><dd>{b.total[0] / 60}–{b.total[1] / 60} h</dd>
        <dt>Bedtime</dt><dd>{clock(b.bedtime[0])} – {clock(b.bedtime[1])}</dd>
      </dl>
      <p class="small" style="margin-top:12px"><b>Today’s windows:</b> {windows.map(fmtMins).join(' → ')} (last one before bed)</p>
      <p class="small" style="margin-top:8px"><b>Night feeds:</b> {b.nightFeeds}</p>
      {b.notes && <p class="small muted" style="margin-top:8px">{b.notes}</p>}
      {age.next && (
        <p class="small muted" style="margin-top:8px">
          From {age.nextDate.toLocaleDateString([], { month: 'short', day: 'numeric' })} ({age.next.label}): windows {fmtMins(age.next.ww[0])}–{fmtMins(age.next.ww[1])}, {age.next.naps[0] === age.next.naps[1] ? age.next.naps[0] : `${age.next.naps[0]}–${age.next.naps[1]}`} naps. The app switches over automatically.
        </p>
      )}
    </section>
  )
}
