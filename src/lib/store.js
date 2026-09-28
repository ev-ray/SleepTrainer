// App state + sync.
//
// Every write is applied locally first (so a tap feels instant at 2am), then
// queued in an outbox persisted to localStorage and pushed to Supabase. If the
// phone is offline the outbox drains when it reconnects. Rows carry
// client-generated ids and are always sent whole, so retries are idempotent.
// Changes from the other phones arrive over Supabase Realtime, and we do a
// full refetch whenever the app comes back to the foreground (iOS drops
// websockets for backgrounded apps).

import { signal, computed, batch } from '@preact/signals'
import { supabase, DEMO } from './supabase.js'
import { makeDemoData } from './demo.js'
import { DAY } from './time.js'

export const TABLES = ['sessions', 'night_wakes', 'checks', 'settings', 'profiles']

export const db = Object.fromEntries(TABLES.map((t) => [t, signal([])]))
export const user = signal(undefined) // undefined = loading, null = signed out
export const loaded = signal(false)
export const needsFamily = signal(false) // signed in, but not part of a family yet
export const syncState = signal('ok') // ok | saving | offline
export const toast = signal(null)
export const now = signal(Date.now())
setInterval(() => (now.value = Date.now()), 1000)

export const settings = computed(() => db.settings.value[0] || null)
export const me = () => user.peek()?.id

export const nameOf = (id) => {
  if (!id) return null
  if (id === me()) return 'you'
  return db.profiles.value.find((p) => p.id === id)?.display_name || 'someone'
}

// ─── Local persistence ───────────────────────────────────────────────────────
const OUTBOX_KEY = 'sleeplog.outbox'
// Per account, so one person's log never shows up for the next person to sign in.
const cacheKey = () => `sleeplog.cache.${me()}`
const OLD_CACHE_KEY = 'sleeplog.cache'
const DEMO_KEY = 'sleeplog.demo'

function readJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}
function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

let outbox = readJSON(OUTBOX_KEY, [])
const persistOutbox = () => writeJSON(OUTBOX_KEY, outbox)

function snapshot() {
  return Object.fromEntries(TABLES.map((t) => [t, db[t].peek()]))
}
function persistCache() {
  writeJSON(DEMO ? DEMO_KEY : cacheKey(), snapshot())
}
function restore(data) {
  batch(() => TABLES.forEach((t) => (db[t].value = data?.[t] || [])))
}

// ─── Local mutations ─────────────────────────────────────────────────────────
function upsertLocal(table, row) {
  const list = db[table].peek()
  const i = list.findIndex((r) => r.id === row.id)
  const merged = i === -1 ? row : { ...list[i], ...row }
  db[table].value = i === -1 ? [...list, merged] : list.map((r, j) => (j === i ? merged : r))
  return merged
}
function deleteLocal(table, id) {
  db[table].value = db[table].peek().filter((r) => r.id !== id)
}

export function get(table, id) {
  return db[table].peek().find((r) => r.id === id) || null
}

// Rows are stamped with the family they were logged for, so a change that is
// still queued when someone signs out can never land in another family's log.
const FAMILY_TABLES = ['sessions', 'night_wakes', 'checks']

export function save(table, row) {
  const family = FAMILY_TABLES.includes(table) && !row.family_id ? { family_id: settings.peek()?.id } : null
  const merged = upsertLocal(table, { ...row, ...family, updated_at: new Date().toISOString() })
  enqueue({ op: 'upsert', table, id: merged.id, row: merged })
  return merged
}

export function remove(table, id) {
  deleteLocal(table, id)
  if (table === 'sessions') {
    // cascade locally; the database cascades on its side
    const gone = new Set(db.night_wakes.peek().filter((w) => w.session_id === id).map((w) => w.id))
    db.night_wakes.value = db.night_wakes.peek().filter((w) => !gone.has(w.id))
    // Unsent changes to its wakes would only fail once the session is gone.
    outbox = outbox.filter((o) => !(o.table === 'night_wakes' && gone.has(o.id)))
  }
  enqueue({ op: 'delete', table, id })
}

// Put a row back exactly as it was (used by undo).
export function restoreRow(table, before, id) {
  if (before) save(table, before)
  else remove(table, id)
}

function enqueue(item) {
  // Only the latest state of a row matters. It keeps its place in the queue,
  // so a session is always sent before the wakes logged during it.
  item = { ...item, uid: me() }
  const i = outbox.findIndex((o) => o.table === item.table && o.id === item.id)
  if (i === -1) outbox.push(item)
  else outbox = outbox.map((o, j) => (j === i ? item : o))
  persistOutbox()
  persistCache()
  flush()
}

// ─── Sync ────────────────────────────────────────────────────────────────────
let flushing = false
const isNetworkError = (e) =>
  !navigator.onLine || /fetch|network|load failed|timeout/i.test(e?.message || '')

async function flush() {
  if (DEMO) {
    outbox = []
    persistOutbox()
    return
  }
  if (flushing || !user.peek()) return
  flushing = true
  syncState.value = outbox.length ? 'saving' : 'ok'
  try {
    while (outbox.length) {
      const item = outbox[0]
      const q = supabase.from(item.table)
      const { error } =
        item.op === 'upsert' ? await q.upsert(item.row) : await q.delete().eq('id', item.id)
      if (error) {
        if (isNetworkError(error)) {
          syncState.value = 'offline'
          return
        }
        console.error('sync', item, error)
        toast.value = { text: `Couldn’t save that change (${error.message}).`, tone: 'error' }
      }
      outbox = outbox.filter((o) => o !== item)
      persistOutbox()
    }
    syncState.value = 'ok'
  } catch (e) {
    syncState.value = 'offline'
  } finally {
    flushing = false
  }
}

setInterval(() => outbox.length && flush(), 15000)
addEventListener('online', () => {
  flush()
  refresh()
})

const pendingIds = () => new Set(outbox.map((o) => `${o.table}:${o.id}`))

// Replay unsent local changes on top of fresh server data.
function applyOutbox() {
  for (const o of outbox) {
    if (o.op === 'upsert') upsertLocal(o.table, o.row)
    else deleteLocal(o.table, o.id)
  }
}

export async function refresh() {
  const uid = user.peek()?.id
  if (DEMO || !uid) return
  const since = new Date(Date.now() - 120 * DAY).toISOString()
  const recent = new Date(Date.now() - 3 * DAY).toISOString()
  try {
    const res = await Promise.all([
      supabase.from('sessions').select('*').gte('started_at', since).order('started_at', { ascending: false }).limit(2000),
      supabase.from('night_wakes').select('*').gte('woke_at', since).limit(4000),
      supabase.from('checks').select('*').gte('done_at', recent),
      supabase.from('settings').select('*'),
      supabase.from('profiles').select('*'),
    ])
    if (user.peek()?.id !== uid) return // signed out (or in as someone else) meanwhile
    const failed = res.find((r) => r.error)
    if (failed) throw failed.error
    batch(() => {
      TABLES.forEach((t, i) => (db[t].value = res[i].data))
      applyOutbox()
      needsFamily.value = !res[4].data.find((p) => p.id === me())?.family_id
      loaded.value = true
    })
    persistCache()
  } catch (e) {
    console.warn('refresh failed', e)
    if (isNetworkError(e)) syncState.value = 'offline'
  }
}

let channel = null
function subscribe() {
  if (channel) supabase.removeChannel(channel)
  channel = supabase
    .channel('family')
    .on('postgres_changes', { event: '*', schema: 'public' }, (p) => {
      if (!TABLES.includes(p.table)) return
      const id = p.new?.id ?? p.old?.id
      if (pendingIds().has(`${p.table}:${id}`)) return // our unsent version wins
      if (p.eventType === 'DELETE') deleteLocal(p.table, id)
      else upsertLocal(p.table, p.new)
      persistCache()
    })
    .subscribe()
}

function start() {
  // Changes queued by whoever used this phone before are theirs, not ours.
  outbox = outbox.filter((o) => (o.uid ?? me()) === me())
  persistOutbox()
  // One-time move from the old shared cache, only if it was this account's.
  const old = readJSON(OLD_CACHE_KEY, null)
  if (old) {
    if (old.profiles?.some((p) => p.id === me()) && !readJSON(cacheKey(), null)) writeJSON(cacheKey(), old)
    try {
      localStorage.removeItem(OLD_CACHE_KEY)
    } catch {}
  }
  restore(readJSON(cacheKey(), null))
  applyOutbox()
  if (db.settings.peek().length) loaded.value = true
  refresh()
  subscribe()
  flush()
}

function stop() {
  if (channel) supabase.removeChannel(channel)
  channel = null
  restore(null)
  loaded.value = false
  needsFamily.value = false
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || DEMO || !user.peek()) return
  now.value = Date.now()
  refresh()
  subscribe()
  flush()
})

// ─── Auth ────────────────────────────────────────────────────────────────────
export async function initAuth() {
  if (DEMO) {
    let data = readJSON(DEMO_KEY, null)
    if (!data) {
      data = makeDemoData()
      writeJSON(DEMO_KEY, data)
    }
    restore(data)
    user.value = { id: 'demo-evan', email: 'demo@example.com' }
    loaded.value = true
    return
  }
  const { data } = await supabase.auth.getSession()
  setUser(data.session?.user ?? null)
  // Don't call supabase from inside this callback (supabase-js can deadlock).
  supabase.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => setUser(session?.user ?? null), 0)
  })
}

function setUser(u) {
  const prev = user.peek()
  if (prev?.id === u?.id && prev !== undefined) return
  user.value = u
  if (u) start()
  else if (prev) stop()
}

export async function sendCode(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: location.origin + location.pathname },
  })
  if (error) throw error
}

export async function verifyCode(email, token) {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
  if (error) throw error
}

export async function signOut() {
  if (DEMO) {
    localStorage.removeItem(DEMO_KEY)
    location.reload()
    return
  }
  const key = cacheKey()
  await supabase.auth.signOut()
  localStorage.removeItem(key)
}

// ─── Family ──────────────────────────────────────────────────────────────────
// Joining and managing a family goes straight to the server (no outbox):
// these are one-off, need a connection, and the database checks who may do what.

const rpc = async (fn, args) => {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw error
  return data
}

export async function createFamily({ babyName, yourName, birthDate, dueDate }) {
  await rpc('create_family', { baby_name: babyName, your_name: yourName, birth_date: birthDate || null, due_date: dueDate || null })
  await refresh()
}

export async function acceptInvite(id, yourName) {
  await rpc('accept_invite', { invite: id, your_name: yourName })
  await refresh()
}

// Pending invites: your family's outgoing ones, or (before you've joined a
// family) any addressed to you.
export async function fetchInvites() {
  if (DEMO) return []
  const { data, error } = await supabase.from('invites').select('*').order('created_at')
  if (error) throw error
  return data
}

export async function invite(email, displayName) {
  const mine = db.profiles.peek().find((p) => p.id === me())
  const { error } = await supabase.from('invites').insert({
    email: email.trim().toLowerCase(),
    display_name: displayName?.trim() || null,
    from_name: mine?.display_name || null,
    baby_name: settings.peek()?.baby_name || null,
  })
  if (error) throw error.code === '23505' ? new Error('That email already has an invite.') : error
}

export async function cancelInvite(id) {
  const { error } = await supabase.from('invites').delete().eq('id', id)
  if (error) throw error
}

export async function removeMember(id) {
  await rpc('remove_member', { member: id })
  db.profiles.value = db.profiles.peek().filter((p) => p.id !== id)
}

export function renameMe(name) {
  const mine = db.profiles.peek().find((p) => p.id === me())
  if (!mine || !name.trim()) return
  upsertLocal('profiles', { ...mine, display_name: name.trim() })
  if (DEMO) return
  supabase.from('profiles').update({ display_name: name.trim() }).eq('id', mine.id).then(({ error }) => {
    if (error) toast.value = { text: `Couldn’t save your name (${error.message}).`, tone: 'error' }
  })
}

export function resetDemo() {
  localStorage.removeItem(DEMO_KEY)
  location.reload()
}
