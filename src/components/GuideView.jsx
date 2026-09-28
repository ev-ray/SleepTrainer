import { useEffect, useState } from 'preact/hooks'
import { cancelInvite, db, fetchInvites, invite, me, now, removeMember, renameMe, resetDemo, save, settings, signOut, toast, user } from '../lib/store.js'
import { DEMO } from '../lib/supabase.js'
import { ageInfo, wakeWindow } from '../lib/age.js'
import { fmtMins } from '../lib/time.js'
import { GO_IN_IF, PLAN, PLAYBOOK, RESEARCH } from '../content/guide.js'

const clock = (hm) => {
  const [h, m] = hm.split(':').map(Number)
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function GuideView({ focus }) {
  const st = settings.value
  const age = ageInfo(st, now.peek())

  useEffect(() => {
    if (!focus) return
    const el = document.getElementById(focus === 'settings' ? 'settings' : `pb-${focus}`)
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
          <p class="muted">Enter it in Settings below and the whole app — wake windows, nap count, targets — will follow his age automatically.</p>
        </section>
      )}

      <div class="section-label">Our plan</div>
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

      <div class="section-label" id="settings">Settings</div>
      <SettingsForm />
      <div class="section-label">Family</div>
      <FamilyCard />
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

function SettingsForm() {
  const st = settings.value
  const [f, setF] = useState(st || {})
  const [saved, setSaved] = useState(false)
  useEffect(() => setF(st || {}), [st?.updated_at])
  if (!st) return null
  const set = (k) => (e) => {
    setSaved(false)
    setF({ ...f, [k]: e.currentTarget.value === '' ? null : e.currentTarget.value })
  }
  const submit = (e) => {
    e.preventDefault()
    save('settings', {
      ...f,
      feed_interval_hours: f.feed_interval_hours == null ? null : Number(f.feed_interval_hours),
      nap_limit_min: Number(f.nap_limit_min) || 60,
      morning_time: f.morning_time || '06:00',
      baby_name: f.baby_name || 'Baby',
    })
    setSaved(true)
  }
  return (
    <form class="card" onSubmit={submit}>
      <label class="field"><span>Baby’s name</span><input class="input" value={f.baby_name || ''} onInput={set('baby_name')} /></label>
      <label class="field"><span>Birthday</span><input class="input" type="date" value={f.birth_date || ''} onInput={set('birth_date')} /></label>
      <label class="field"><span>Due date (only if born 2+ weeks early)</span><input class="input" type="date" value={f.due_date || ''} onInput={set('due_date')} /></label>
      <label class="field"><span>Night 1 of sleep training</span><input class="input" type="date" value={f.training_start || ''} onInput={set('training_start')} /></label>
      <label class="field">
        <span>Night-feed plan: feed if at least this many hours since last feed</span>
        <select class="input" value={f.feed_interval_hours ?? ''} onChange={set('feed_interval_hours')}>
          <option value="">No plan set</option>
          {[2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8].map((h) => <option key={h} value={h}>{h} hours</option>)}
          <option value="24">No night feeds</option>
        </select>
      </label>
      <label class="field">
        <span>Morning starts at</span>
        <input class="input" type="time" value={(f.morning_time || '06:00').slice(0, 5)} onInput={set('morning_time')} />
      </label>
      <label class="field">
        <span>Nap attempt limit (minutes)</span>
        <input class="input" type="number" inputMode="numeric" min="20" max="120" value={f.nap_limit_min ?? 60} onInput={set('nap_limit_min')} />
      </label>
      <label class="field">
        <span>Our “why” — shown on Hold steady</span>
        <textarea class="input" value={f.why_note || ''} onInput={set('why_note')} placeholder="Write a note to yourselves for the hard moments." />
      </label>
      <button class="btn primary" style="width:100%;--accent:var(--night)" type="submit">{saved ? 'Saved ✓' : 'Save settings'}</button>
      <p class="tiny" style="margin-top:14px">
        Signed in as {user.value?.email}.{' '}
        {DEMO ? (
          <button type="button" class="btn ghost small" onClick={resetDemo}>Reset demo data</button>
        ) : (
          <button type="button" class="btn ghost small" onClick={signOut}>Sign out</button>
        )}
      </p>
    </form>
  )
}

// Who can see and log for this baby, and inviting more people.
function FamilyCard() {
  const members = db.profiles.value
  const mine = members.find((p) => p.id === me())
  const owner = mine?.role === 'owner'
  const [invites, setInvites] = useState([])
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [myName, setMyName] = useState(mine?.display_name || '')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const load = () => fetchInvites().then(setInvites, (e) => setErr(e.message))
  useEffect(() => void load(), [])

  const send = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      await invite(email, name)
      setEmail('')
      setName('')
      toast.value = { text: 'Invite saved' }
      await load()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }
  const act = (fn) => async () => {
    setErr(null)
    try {
      await fn()
      await load()
    } catch (e) {
      setErr(e.message)
    }
  }
  const link = location.origin + location.pathname

  return (
    <section class="card">
      <ul class="people">
        {members.map((p) => (
          <li key={p.id}>
            <span>
              <b>{p.display_name}</b>{p.id === me() && ' (you)'}
              <span class="tiny" style="display:block">{p.email}{p.role === 'owner' && ' · owner'}</span>
            </span>
            {owner && p.id !== me() && !DEMO &&
              (confirm === p.id ? (
                <button class="btn danger small" onClick={act(() => removeMember(p.id))}>Remove</button>
              ) : (
                <button class="btn ghost small" onClick={() => setConfirm(p.id)}>Remove…</button>
              ))}
          </li>
        ))}
        {invites.map((i) => (
          <li key={i.id}>
            <span>
              <b>{i.display_name || i.email}</b>
              <span class="tiny" style="display:block">{i.email} · invited, hasn’t joined yet</span>
            </span>
            <button class="btn ghost small" onClick={act(() => cancelInvite(i.id))}>Cancel</button>
          </li>
        ))}
      </ul>

      <form onSubmit={send} style="margin-top:14px">
        <h3 style="margin-bottom:8px">Invite someone</h3>
        <label class="field"><span>Their email</span><input class="input" type="email" required value={email} onInput={(e) => setEmail(e.currentTarget.value)} /></label>
        <label class="field"><span>Their name (optional)</span><input class="input" value={name} onInput={(e) => setName(e.currentTarget.value)} placeholder="e.g. Grandma" /></label>
        <button class="btn secondary" style="width:100%" disabled={busy || DEMO}>{busy ? 'Saving…' : 'Invite'}</button>
        <p class="tiny" style="margin-top:8px">
          Then send them the app link (<b>{link}</b>). When they sign in with that email, they’ll join this log.
        </p>
      </form>

      {mine && (
        <form style="margin-top:14px" onSubmit={(e) => { e.preventDefault(); renameMe(myName); toast.value = { text: 'Name saved' } }}>
          <label class="field">
            <span>Your name</span>
            <input class="input" value={myName} onInput={(e) => setMyName(e.currentTarget.value)} />
          </label>
          <button class="btn ghost small" disabled={!myName.trim() || myName === mine.display_name}>Save name</button>
        </form>
      )}
      {err && <p class="small" style="color:#c0453c;margin-top:10px">{err}</p>}
    </section>
  )
}
