import { db, me, settings, user } from '../lib/store.js'
import { DEMO } from '../lib/supabase.js'
import { Sheet } from './ui.jsx'
import { Chevron } from './icons.jsx'

// One-time welcome for whoever started the family: point them at the rest of
// setup and at inviting everyone else. People who joined by invite never see it.
const key = () => `sleeplog.welcomed.${me()}`

export function shouldWelcome() {
  if (DEMO || !user.peek()) return false
  const members = db.profiles.value
  if (members.find((p) => p.id === me())?.role !== 'owner' || members.length > 1) return false
  try {
    return !localStorage.getItem(key())
  } catch {
    return false
  }
}

export function Welcome({ onClose, onSettings }) {
  const done = () => {
    try {
      localStorage.setItem(key(), '1')
    } catch {}
    onClose()
  }
  const go = (section) => () => {
    done()
    onSettings(section)
  }
  const baby = settings.value?.baby_name
  return (
    <Sheet onClose={done} label="Welcome">
      <h2>Welcome{baby ? ` to ${baby}’s log` : ''}</h2>
      <p class="muted" style="margin:-6px 0 16px">The log is ready. Two quick things before tonight:</p>
      <button class="setup-step" onClick={go('baby')}>
        <span class="n">1</span>
        <span>
          <b>Finish setting up</b>
          <span class="small muted">Add night 1 of training, your night-feed plan and when morning starts. The schedule uses them.</span>
        </span>
        <Chevron class="chev" width="18" height="18" />
      </button>
      <button class="setup-step" onClick={go('family')}>
        <span class="n">2</span>
        <span>
          <b>Invite your family</b>
          <span class="small muted">Add your partner and anyone else who helps, so everyone logs to the same place.</span>
        </span>
        <Chevron class="chev" width="18" height="18" />
      </button>
      <button class="btn ghost" style="width:100%;margin-top:4px" onClick={done}>Maybe later</button>
      <p class="tiny" style="text-align:center">Both live in Settings, behind the gear at the top.</p>
    </Sheet>
  )
}
