// Every button in the main loop maps to one of these. Each shows a toast with
// Undo (and, where it makes sense, a quick "that was a few minutes ago" fix).

import { get, me, remove, restoreRow, save, toast } from './store.js'
import { wakesOf } from './metrics.js'
import { fmtClock, iso, uuid } from './time.js'

function announce(text, undo, adjust) {
  toast.value = { text, undo, adjust, at: Date.now() }
}

export function startSession(kind) {
  const s = save('sessions', {
    id: uuid(), kind, started_at: iso(), asleep_at: null, ended_at: null,
    started_by: me(), asleep_by: null, ended_by: null, notes: null,
  })
  announce(kind === 'nap' ? 'Nap started' : 'Bedtime started', () => remove('sessions', s.id), {
    table: 'sessions', id: s.id, field: 'started_at', label: 'Put down',
  })
}

export function markAsleep(s) {
  const before = get('sessions', s.id)
  save('sessions', { ...s, asleep_at: iso(), asleep_by: me() })
  announce('Asleep — logged', () => restoreRow('sessions', before, s.id), {
    table: 'sessions', id: s.id, field: 'asleep_at', label: 'Fell asleep',
  })
}

// Ends a nap or a night. If he's mid-wake when the night ends, that wake was
// really "up for the day", so it's folded into the end time.
export function endSession(s) {
  const before = get('sessions', s.id)
  const open = wakesOf(s).find((w) => !w.asleep_at)
  const endAt = open ? open.woke_at : iso()
  if (open) remove('night_wakes', open.id)
  save('sessions', { ...s, ended_at: endAt, ended_by: me() })
  const label = s.kind === 'night' ? `Up at ${fmtClock(endAt)}` : s.asleep_at ? 'Nap over' : 'Nap attempt ended'
  announce(
    label,
    () => {
      restoreRow('sessions', before, s.id)
      if (open) save('night_wakes', open)
    },
    { table: 'sessions', id: s.id, field: 'ended_at', label: s.kind === 'night' ? 'Up for the day' : 'Woke up' },
  )
}

export function nightWake(s) {
  const w = save('night_wakes', {
    id: uuid(), session_id: s.id, woke_at: iso(), asleep_at: null, fed: false, logged_by: me(), notes: null,
  })
  announce('Wake logged', () => remove('night_wakes', w.id), {
    table: 'night_wakes', id: w.id, field: 'woke_at', label: 'Woke',
  })
}

export function backAsleep(w) {
  const before = get('night_wakes', w.id)
  save('night_wakes', { ...w, asleep_at: iso() })
  announce('Back asleep', () => restoreRow('night_wakes', before, w.id), {
    table: 'night_wakes', id: w.id, field: 'asleep_at', label: 'Back asleep',
  })
}

export function toggleFed(w) {
  save('night_wakes', { ...w, fed: !w.fed })
}

export function toggleCheck(windowId, item, done) {
  const id = `${windowId}:${item}`
  if (done) remove('checks', id)
  else save('checks', { id, window_id: windowId, item, done_by: me(), done_at: iso() })
}
