import { useState } from 'preact/hooks'
import { loaded, needsFamily, settings, syncState, user } from './lib/store.js'
import { ageInfo } from './lib/age.js'
import { DEMO } from './lib/supabase.js'
import { NowView } from './components/NowView.jsx'
import { HistoryView } from './components/HistoryView.jsx'
import { TrendsView } from './components/TrendsView.jsx'
import { GuideView } from './components/GuideView.jsx'
import { HoldSteady } from './components/HoldSteady.jsx'
import { SettingsView } from './components/SettingsView.jsx'
import { SignIn } from './components/SignIn.jsx'
import { Onboarding } from './components/Onboarding.jsx'
import { AdjustTimeSheet, EditSessionSheet } from './components/EditSheets.jsx'
import { Toast } from './components/ui.jsx'
import { Book, Chart, Gear, Heart, Home, List } from './components/icons.jsx'

const TABS = [
  { id: 'now', label: 'Now', Icon: Home },
  { id: 'history', label: 'History', Icon: List },
  { id: 'trends', label: 'Trends', Icon: Chart },
  { id: 'guide', label: 'Guide', Icon: Book },
]

export function App() {
  if (user.value === undefined) return null
  if (!user.value) return <SignIn />
  if (!loaded.value) return <div class="empty" style="padding-top:40vh">Loading…</div>
  if (needsFamily.value) return <Onboarding />
  return <Shell />
}

function Shell() {
  const [tab, setTab] = useState('now')
  const [hold, setHold] = useState(false)
  const [edit, setEdit] = useState(null) // session id, or 'new'
  const [adjust, setAdjust] = useState(null)
  const [focus, setFocus] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const openSettings = () => setShowSettings(true)

  const st = settings.value
  const age = ageInfo(st)
  const goTab = (id) => {
    setTab(id)
    scrollTo(0, 0)
  }
  const openPlaybook = (id) => {
    setFocus(id)
    setTab('guide')
  }

  return (
    <div class="shell">
      <header class="topbar">
        <div class="who">
          <h1>
            <button class="name-btn" onClick={openSettings}>{st?.baby_name || 'Sleep Log'}</button>
            <span class={`sync-dot ${syncState.value}`} title={syncState.value === 'ok' ? 'Synced' : syncState.value === 'saving' ? 'Saving…' : 'Offline — will sync'} />
          </h1>
          <div class="age">
            {age ? `${age.weeks} weeks${age.extraDays ? ` ${age.extraDays}d` : ''}` : 'Sleep training log'}
            {DEMO && ' · demo'}
            {syncState.value === 'offline' && ' · offline, will sync'}
          </div>
        </div>
        <button class="hold-btn" onClick={() => setHold(true)}>
          <Heart width="18" height="18" /> Hold steady
        </button>
        <button class="icon-btn" onClick={openSettings} aria-label="Settings and family">
          <Gear width="20" height="20" />
        </button>
      </header>

      <main>
        {tab === 'now' && <NowView onPlaybook={openPlaybook} onTab={goTab} onEdit={setEdit} />}
        {tab === 'history' && <HistoryView onEdit={setEdit} onAdd={() => setEdit('new')} />}
        {tab === 'trends' && <TrendsView />}
        {tab === 'guide' && <GuideView focus={focus} onSettings={openSettings} />}
      </main>

      <nav class="tabbar">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => { setFocus(null); goTab(id) }}>
            <Icon />
            {label}
          </button>
        ))}
      </nav>

      <Toast onAdjust={setAdjust} />
      {edit && <EditSessionSheet id={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
      {adjust && <AdjustTimeSheet target={adjust} onClose={() => setAdjust(null)} />}
      {hold && <HoldSteady onClose={() => setHold(false)} />}
      {showSettings && <SettingsView onClose={() => setShowSettings(false)} />}
    </div>
  )
}
