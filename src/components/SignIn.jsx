import { useState } from 'preact/hooks'
import { sendCode, signOut, verifyCode } from '../lib/store.js'

const EMAIL_KEY = 'sleeplog.email'

// Email + one-time code. The code (not just the link) matters on iPhone: a
// home-screen app has its own storage, separate from Safari, so tapping the
// email link would sign in Safari rather than the installed app. Typing the
// code signs in right here, and the session then persists indefinitely.
export function SignIn() {
  const [email, setEmail] = useState(() => localStorage.getItem(EMAIL_KEY) || '')
  const [step, setStep] = useState('email')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const send = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      const clean = email.trim().toLowerCase()
      await sendCode(clean)
      localStorage.setItem(EMAIL_KEY, clean)
      setStep('code')
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  const verify = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      await verifyCode(email.trim().toLowerCase(), code.replace(/\D/g, ''))
    } catch (e) {
      setErr('That code didn’t work — check it, or send a new one.')
      setBusy(false)
    }
  }

  return (
    <div class="signin">
      <div class="box">
        <img src="icons/icon-192.png" alt="" />
        <h1>Sleep Log</h1>
        {step === 'email' ? (
          <form onSubmit={send}>
            <p class="muted" style="margin-bottom:18px">Family only. We’ll email you a sign-in code — you’ll stay signed in after that.</p>
            <label class="field">
              <span>Email</span>
              <input class="input" type="email" autocomplete="email" required value={email} onInput={(e) => setEmail(e.currentTarget.value)} />
            </label>
            <button class="btn primary" disabled={busy}>{busy ? 'Sending…' : 'Email me a code'}</button>
          </form>
        ) : (
          <form onSubmit={verify}>
            <p class="muted" style="margin-bottom:18px">Enter the code we sent to <b>{email}</b>.</p>
            <label class="field">
              <span>Code</span>
              <input
                class="input" inputMode="numeric" autocomplete="one-time-code" required autofocus
                style="font-size:26px;letter-spacing:.3em;text-align:center"
                value={code} onInput={(e) => setCode(e.currentTarget.value)}
              />
            </label>
            <button class="btn primary" disabled={busy}>{busy ? 'Checking…' : 'Sign in'}</button>
            <button type="button" class="btn ghost" style="width:100%;margin-top:6px" onClick={() => setStep('email')}>Use a different email / resend</button>
          </form>
        )}
        {err && <p class="small" style="color:#c0453c;margin-top:12px">{err}</p>}
      </div>
    </div>
  )
}

export function NotMember() {
  return (
    <div class="signin">
      <div class="box">
        <h1>Not on the list</h1>
        <p class="muted">This account isn’t one of the family members allowed to see this log.</p>
        <button class="btn secondary" style="width:100%;margin-top:18px" onClick={signOut}>Sign out</button>
      </div>
    </div>
  )
}
