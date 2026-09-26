import { useState } from 'preact/hooks'
import { db, get, me, remove, save, toast } from '../lib/store.js'
import { wakesOf } from '../lib/metrics.js'
import { HOUR, MIN, fmtClock, fromInput, iso, ms, toInput, uuid } from '../lib/time.js'
import { Sheet } from './ui.jsx'
import { Plus } from './icons.jsx'

// The other timestamps on a row that a given one must stay between.
function bounds(table, row, field) {
  if (table === 'sessions') {
    if (field === 'started_at') return [null, ms(row.asleep_at || row.ended_at)]
    if (field === 'asleep_at') return [ms(row.started_at), ms(row.ended_at)]
    if (field === 'ended_at') return [ms(row.asleep_at || row.started_at), null]
  }
  if (table === 'night_wakes') {
    if (field === 'woke_at') return [ms(get('sessions', row.session_id)?.asleep_at), ms(row.asleep_at)]
    if (field === 'asleep_at') return [ms(row.woke_at), null]
  }
  return [null, null]
}

// Quick "that actually happened a few minutes ago" fix, opened from a toast.
export function AdjustTimeSheet({ target, onClose }) {
  const row = get(target.table, target.id)
  const [value, setValue] = useState(toInput(row?.[target.field]))
  if (!row) return null
  const [lo, hi] = bounds(target.table, row, target.field)
  const ok = (t) => t != null && (lo == null || t >= lo) && (hi == null || t <= hi) && t <= Date.now() + MIN
  const picked = value ? new Date(value).getTime() : null
  const apply = (t) => {
    save(target.table, { ...row, [target.field]: iso(t) })
    toast.value = { text: 'Time updated' }
    onClose()
  }
  return (
    <Sheet onClose={onClose} label="Adjust time">
      <h2>{target.label} — when?</h2>
      <div class="quick">
        {[2, 5, 10, 15].map((m) => {
          const t = Date.now() - m * MIN
          return (
            <button key={m} class="btn secondary" disabled={!ok(t)} onClick={() => apply(t)}>{m}m ago</button>
          )
        })}
      </div>
      <label class="field">
        <span>Or pick a time</span>
        <input class="input" type="datetime-local" value={value} onInput={(e) => setValue(e.currentTarget.value)} />
      </label>
      {picked != null && !ok(picked) && (
        <p class="small" style="color:#c0453c;margin:-6px 0 12px">
          {lo != null && picked < lo ? `That’s before ${fmtClock(lo)}, the step before it.` : 'That’s out of order with the other times.'}
        </p>
      )}
      <button class="btn primary" style="width:100%;--accent:var(--night)" onClick={() => apply(picked)} disabled={!ok(picked)}>
        Save
      </button>
    </Sheet>
  )
}

// Full edit of one nap or night, including its night wakes. Works on a draft;
// nothing is written until Save.
export function EditSessionSheet({ id, onClose }) {
  const existing = id ? get('sessions', id) : null
  const [s, setS] = useState(
    () =>
      existing || {
        id: uuid(), kind: 'nap',
        started_at: iso(Date.now() - 2 * HOUR), asleep_at: iso(Date.now() - 2 * HOUR + 10 * MIN), ended_at: iso(Date.now() - HOUR),
        started_by: me(), asleep_by: me(), ended_by: me(), notes: null,
      },
  )
  // What the rows looked like when the sheet opened, so Save only writes the
  // fields you touched — the session may still be live on another phone.
  const [original] = useState(() => ({ s: existing, wakes: existing ? wakesOf(existing) : [] }))
  const [wakes, setWakes] = useState(() => original.wakes.map((w) => ({ ...w })))
  const [confirmDelete, setConfirmDelete] = useState(false)

  const set = (patch) => setS({ ...s, ...patch })
  const setWake = (i, patch) => setWakes(wakes.map((w, j) => (j === i ? { ...w, ...patch } : w)))

  const problems = []
  if (!s.started_at) problems.push('Needs a start time.')
  if (s.asleep_at && ms(s.asleep_at) < ms(s.started_at)) problems.push('“Fell asleep” is before “put down”.')
  if (s.ended_at && ms(s.ended_at) < ms(s.asleep_at || s.started_at)) problems.push('End is before it started.')
  wakes.forEach((w, i) => {
    if (w.asleep_at && ms(w.asleep_at) < ms(w.woke_at)) problems.push(`Wake ${i + 1}: back asleep before it woke.`)
  })

  const changes = (before, after) =>
    Object.fromEntries(Object.entries(after).filter(([k, v]) => !before || before[k] !== v))

  const commit = () => {
    save('sessions', { ...(get('sessions', s.id) || s), ...changes(original.s, s) })
    const keep = new Set(wakes.map((w) => w.id))
    original.wakes.forEach((w) => !keep.has(w.id) && remove('night_wakes', w.id))
    for (const w of wakes) {
      if (s.kind !== 'night') remove('night_wakes', w.id)
      else {
        const before = original.wakes.find((o) => o.id === w.id)
        const patch = changes(before, w)
        if (Object.keys(patch).length) save('night_wakes', { ...(get('night_wakes', w.id) || w), ...patch })
      }
    }
    toast.value = { text: existing ? 'Saved' : 'Added' }
    onClose()
  }

  const del = () => {
    const snapshot = { s: get('sessions', s.id), wakes: existing ? wakesOf(existing) : [] }
    remove('sessions', s.id)
    toast.value = {
      text: 'Deleted',
      undo: () => {
        save('sessions', snapshot.s)
        snapshot.wakes.forEach((w) => save('night_wakes', w))
      },
    }
    onClose()
  }

  return (
    <Sheet onClose={onClose} label="Edit sleep">
      <h2>{existing ? 'Edit' : 'Add'} {s.kind === 'nap' ? 'nap' : 'night'}</h2>

      {!existing && (
        <div class="seg" style="margin-bottom:14px">
          <button aria-pressed={s.kind === 'nap'} onClick={() => set({ kind: 'nap' })}>Nap</button>
          <button aria-pressed={s.kind === 'night'} onClick={() => set({ kind: 'night' })}>Night</button>
        </div>
      )}

      <label class="field">
        <span>Put down</span>
        <input class="input" type="datetime-local" value={toInput(s.started_at)} onInput={(e) => set({ started_at: fromInput(e.currentTarget.value) })} />
      </label>

      <label class="toggle">
        <input type="checkbox" checked={!s.asleep_at} onChange={(e) => set({ asleep_at: e.currentTarget.checked ? null : s.started_at })} />
        {s.ended_at ? 'Never fell asleep' : 'Not asleep yet'}
      </label>
      {s.asleep_at && (
        <label class="field">
          <span>Fell asleep</span>
          <input class="input" type="datetime-local" value={toInput(s.asleep_at)} onInput={(e) => set({ asleep_at: fromInput(e.currentTarget.value) })} />
        </label>
      )}

      {s.kind === 'night' && (
        <>
          <div class="section-label" style="margin-top:14px">Night wakes</div>
          {wakes.map((w, i) => (
            <div class="wake-edit" key={w.id}>
              <div class="grid2">
                <label class="field">
                  <span>Woke</span>
                  <input class="input" type="datetime-local" value={toInput(w.woke_at)} onInput={(e) => setWake(i, { woke_at: fromInput(e.currentTarget.value) })} />
                </label>
                <label class="field">
                  <span>Back asleep</span>
                  <input class="input" type="datetime-local" value={toInput(w.asleep_at)} onInput={(e) => setWake(i, { asleep_at: fromInput(e.currentTarget.value) })} />
                </label>
              </div>
              <div class="spread">
                <label class="toggle">
                  <input type="checkbox" checked={w.fed} onChange={(e) => setWake(i, { fed: e.currentTarget.checked })} /> Fed
                </label>
                <button class="btn ghost small" onClick={() => setWakes(wakes.filter((_, j) => j !== i))}>Remove</button>
              </div>
            </div>
          ))}
          <button
            class="btn secondary small"
            onClick={() => {
              const base = ms(wakes.at(-1)?.asleep_at || s.asleep_at || s.started_at) + HOUR
              setWakes([...wakes, { id: uuid(), session_id: s.id, woke_at: iso(base), asleep_at: iso(base + 15 * MIN), fed: false, logged_by: me(), notes: null }])
            }}
          >
            <Plus /> Add wake
          </button>
        </>
      )}

      <label class="toggle" style="margin-top:14px">
        <input type="checkbox" checked={!s.ended_at} onChange={(e) => set({ ended_at: e.currentTarget.checked ? null : iso() })} />
        Still going
      </label>
      {s.ended_at && (
        <label class="field">
          <span>{s.kind === 'night' ? 'Up for the day' : 'Woke / got up'}</span>
          <input class="input" type="datetime-local" value={toInput(s.ended_at)} onInput={(e) => set({ ended_at: fromInput(e.currentTarget.value) })} />
        </label>
      )}

      <label class="field">
        <span>Notes</span>
        <textarea class="input" value={s.notes || ''} placeholder="Teething, vaccine day, nap in the car…" onInput={(e) => set({ notes: e.currentTarget.value || null })} />
      </label>

      {problems.length > 0 && <p class="small" style="color:#c0453c;margin-bottom:10px">{problems.join(' ')}</p>}

      <div class="actions" style="margin-top:6px">
        <button class="btn primary" style="--accent:var(--night)" onClick={commit} disabled={problems.length > 0}>Save</button>
        {existing &&
          (confirmDelete ? (
            <button class="btn danger" onClick={del}>Tap again to delete</button>
          ) : (
            <button class="btn ghost" onClick={() => setConfirmDelete(true)}>Delete this {s.kind}</button>
          ))}
      </div>
    </Sheet>
  )
}
