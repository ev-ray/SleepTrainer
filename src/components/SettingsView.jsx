import { useEffect, useState } from 'preact/hooks'
import { cancelInvite, db, fetchInvites, invite, me, removeMember, renameMe, resetDemo, save, settings, signOut, toast, user } from '../lib/store.js'
import { DEMO } from '../lib/supabase.js'

// Full-screen settings page, opened from the gear or the baby's name in the top bar.
export function SettingsView({ section, onClose }) {
  useEffect(() => {
    if (typeof section === 'string') document.getElementById(`settings-${section}`)?.scrollIntoView()
  }, [])
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [])

  return (
    <div class="page-over" role="dialog" aria-modal="true" aria-label="Settings">
      <header class="page-over-head">
        <h1>Settings</h1>
        <button class="btn secondary small" onClick={onClose}>Done</button>
      </header>
      <div class="page-over-body">
        <div class="section-label" id="settings-baby">Baby</div>
        <BabyForm />
        <div class="section-label" id="settings-family">Family</div>
        <FamilyCard />
        <div class="section-label">Account</div>
        <section class="card spread">
          <span class="small" style="min-width:0;overflow-wrap:anywhere">Signed in as <b>{user.value?.email}</b></span>
          {DEMO ? (
            <button class="btn ghost small" style="flex:none" onClick={resetDemo}>Reset demo</button>
          ) : (
            <button class="btn ghost small" style="flex:none" onClick={signOut}>Sign out</button>
          )}
        </section>
      </div>
    </div>
  )
}

function BabyForm() {
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
  // Only this family's outgoing invites (not ones other families sent to you).
  const load = () => fetchInvites().then((l) => setInvites(l.filter((i) => i.family_id === settings.peek()?.id)), (e) => setErr(e.message))
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
