import { useEffect, useState } from 'preact/hooks'
import { acceptInvite, createFamily, fetchInvites, signOut, user } from '../lib/store.js'

// Signed in but not part of a family yet: accept an invite someone sent to
// this email, or set up a new baby.
export function Onboarding() {
  const [invites, setInvites] = useState(null)
  const [mode, setMode] = useState(null) // 'create' once they choose to start fresh
  const [err, setErr] = useState(null)

  useEffect(() => {
    fetchInvites().then(setInvites, (e) => (setInvites([]), setErr(e.message)))
  }, [])

  if (invites === null) return <div class="empty" style="padding-top:40vh">Loading…</div>
  const showCreate = mode === 'create' || !invites.length

  return (
    <div class="signin">
      <div class="box">
        <img src="icons/icon-192.png" alt="" />
        <h1>{showCreate ? 'Set up your baby' : 'You’re invited'}</h1>
        {showCreate ? <CreateForm onErr={setErr} /> : (
          <>
            {invites.map((inv) => <InviteCard key={inv.id} inv={inv} onErr={setErr} />)}
            <button class="btn ghost" style="width:100%;margin-top:6px" onClick={() => setMode('create')}>
              Set up a different baby instead
            </button>
          </>
        )}
        {err && <p class="small" style="color:#c0453c;margin-top:12px">{err}</p>}
        <p class="tiny" style="margin-top:18px">
          Signed in as {user.value?.email}.{' '}
          <button type="button" class="btn ghost small" onClick={signOut}>Sign out</button>
        </p>
        {showCreate && (
          <p class="tiny" style="margin-top:6px">
            Joining someone else’s log? Ask them to invite this email from Guide → Settings → Family, then reopen the app.
          </p>
        )}
      </div>
    </div>
  )
}

function InviteCard({ inv, onErr }) {
  const [name, setName] = useState(inv.display_name || '')
  const [busy, setBusy] = useState(false)
  const join = async (e) => {
    e.preventDefault()
    setBusy(true)
    onErr(null)
    try {
      await acceptInvite(inv.id, name)
    } catch (e) {
      onErr(e.message)
      setBusy(false)
    }
  }
  return (
    <form onSubmit={join} style="margin-bottom:12px">
      <p class="muted" style="margin-bottom:18px">
        {inv.from_name || 'Someone'} invited you to {inv.baby_name ? `${inv.baby_name}’s` : 'their'} sleep log.
      </p>
      <label class="field">
        <span>Your name (what the others will see)</span>
        <input class="input" required value={name} onInput={(e) => setName(e.currentTarget.value)} placeholder="e.g. Grandma" />
      </label>
      <button class="btn primary" disabled={busy}>{busy ? 'Joining…' : 'Join'}</button>
    </form>
  )
}

function CreateForm({ onErr }) {
  const [f, setF] = useState({ babyName: '', yourName: '', birthDate: '', dueDate: '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.currentTarget.value })
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    onErr(null)
    try {
      await createFamily(f)
    } catch (e) {
      onErr(e.message)
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit}>
      <p class="muted" style="margin-bottom:18px">A private log for your baby. You can invite your partner and anyone else who helps from Settings.</p>
      <label class="field"><span>Your name</span><input class="input" required value={f.yourName} onInput={set('yourName')} placeholder="e.g. Sam" /></label>
      <label class="field"><span>Baby’s name</span><input class="input" required value={f.babyName} onInput={set('babyName')} /></label>
      <label class="field"><span>Birthday</span><input class="input" type="date" required value={f.birthDate} onInput={set('birthDate')} /></label>
      <label class="field"><span>Due date (only if born 2+ weeks early)</span><input class="input" type="date" value={f.dueDate} onInput={set('dueDate')} /></label>
      <button class="btn primary" disabled={busy}>{busy ? 'Setting up…' : 'Start the log'}</button>
    </form>
  )
}
