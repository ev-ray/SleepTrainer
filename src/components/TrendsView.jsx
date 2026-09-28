import { useState } from 'preact/hooks'
import { minute, settings } from '../lib/store.js'
import { days, daySummary } from '../lib/metrics.js'
import { ageInfo } from '../lib/age.js'
import { MIN, HOUR, addDays, dayKey, fmtDay, fmtDur, parseDay } from '../lib/time.js'
import { Down, Up } from './icons.jsx'

const RANGES = [7, 14, 30]

export function TrendsView() {
  const [range, setRange] = useState(14)
  const t = minute.value
  const today = dayKey(t)
  const keys = Array.from({ length: range }, (_, i) => addDays(today, i - range + 1))
  const rows = keys.map((k) => {
    const d = days.value.get(k)
    const sum = d ? daySummary(d, t) : null
    const night = sum?.night && !sum.night.st.open ? sum.night.st : null
    return { key: k, sum, night }
  })
  const age = ageInfo(settings.value, t)

  const nights = rows.filter((r) => r.night)
  if (nights.length < 2 && !rows.some((r) => r.sum?.naps.length)) {
    return (
      <div class="empty">
        <h2>Trends need a few days</h2>
        <p>Keep logging — after two or three nights you’ll see wake-ups and time-to-sleep here.</p>
      </div>
    )
  }

  const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
  const compare = (pick) => {
    const vals = nights.map((r) => pick(r.night)).filter((v) => v != null)
    if (vals.length < 4) return { recent: avg(vals.slice(-3)), earlier: null }
    return { recent: avg(vals.slice(-3)), earlier: avg(vals.slice(0, 3)) }
  }
  const wakesCmp = compare((n) => n.wakeCount - n.fedCount)
  const latCmp = compare((n) => (n.latency != null ? n.latency / MIN : null))

  return (
    <>
      <div class="spread" style="margin:8px 0 14px">
        <h2 style="font-size:24px">Trends</h2>
        <div class="seg" role="group" aria-label="Range">
          {RANGES.map((r) => (
            <button key={r} aria-pressed={range === r} onClick={() => setRange(r)}>{r}d</button>
          ))}
        </div>
      </div>

      <div class="headline">
        <Stat label="Unfed wakes / night" value={wakesCmp.recent} earlier={wakesCmp.earlier} fmt={(v) => v.toFixed(1)} />
        <Stat label="Bedtime → asleep" value={latCmp.recent} earlier={latCmp.earlier} fmt={(v) => fmtDur(v * MIN)} />
      </div>
      <p class="tiny" style="margin:-6px 4px 14px">Average of the last 3 nights{wakesCmp.earlier != null ? ', compared with the first 3 in this range' : ''}. Planned feeds aren’t counted as wakes.</p>

      <section class="card chart-card">
        <h3>Night wakes</h3>
        <BarChart
          rows={rows}
          value={(r) => r.night && [r.night.wakeCount - r.night.fedCount, r.night.fedCount]}
          classes={['var(--night)', 'var(--nap)']}
          fmtAxis={(v) => v}
          integer
          detail={(r) => r.night && `${r.night.wakeCount} wake${r.night.wakeCount === 1 ? '' : 's'}${r.night.fedCount ? ` (${r.night.fedCount} fed)` : ''} · longest stretch ${fmtDur(r.night.longest)}`}
        />
        <div class="legend">
          <span><i style="background:var(--night)" />Wake</span>
          <span><i style="background:var(--nap)" />Feed</span>
        </div>
      </section>

      <section class="card chart-card">
        <h3>Time to fall asleep at bedtime</h3>
        <BarChart
          rows={rows}
          value={(r) => r.night?.latency != null && [r.night.latency / MIN]}
          classes={['var(--night)']}
          fmtAxis={(v) => `${v}m`}
          detail={(r) => r.night?.latency != null && `Asleep ${fmtDur(r.night.latency)} after bedtime`}
        />
      </section>

      <section class="card chart-card">
        <h3>Time to fall asleep for naps</h3>
        <BarChart
          rows={rows}
          value={(r) => r.sum?.napLatency != null && [r.sum.napLatency / MIN]}
          classes={['var(--nap)']}
          fmtAxis={(v) => `${v}m`}
          detail={(r) => r.sum?.napLatency != null && `Average ${fmtDur(r.sum.napLatency)} across ${r.sum.naps.length} nap attempt${r.sum.naps.length === 1 ? '' : 's'}`}
        />
      </section>

      <section class="card chart-card">
        <h3>Total sleep per day</h3>
        <BarChart
          rows={rows}
          value={(r) => r.night && [r.night.sleep / HOUR, r.sum.napSleep / HOUR]}
          classes={['var(--night)', 'var(--nap)']}
          fmtAxis={(v) => `${v}h`}
          band={age ? [age.band.total[0] / 60, age.band.total[1] / 60] : null}
          detail={(r) => r.night && `${fmtDur(r.night.sleep + r.sum.napSleep)} total · ${fmtDur(r.night.sleep)} night + ${fmtDur(r.sum.napSleep)} naps`}
        />
        <div class="legend">
          <span><i style="background:var(--night)" />Night</span>
          <span><i style="background:var(--nap)" />Naps</span>
          {age && <span><i style="background:var(--calm);opacity:.35" />Typical for his age</span>}
        </div>
      </section>
    </>
  )
}

function Stat({ label, value, earlier, fmt }) {
  let delta = null
  if (value != null && earlier != null && Math.abs(value - earlier) > 0.05) {
    const better = value < earlier
    delta = (
      <div class={`d ${better ? 'good' : 'bad'}`}>
        {value < earlier ? <Down /> : <Up />} from {fmt(earlier)}
      </div>
    )
  }
  return (
    <div class="stat">
      <div class="k">{label}</div>
      <div class="v">{value != null ? fmt(value) : '—'}</div>
      {delta}
    </div>
  )
}

const STEPS = [1, 2, 5, 10, 15, 20, 30, 45, 60, 90, 120]
function niceStep(max, integer) {
  const raw = max / 3
  return STEPS.find((s) => s >= raw && (!integer || Number.isInteger(s))) || Math.ceil(raw)
}

// Small stacked bar chart, one bar per day. Tap a bar for details.
function BarChart({ rows, value, classes, fmtAxis, band, detail, integer }) {
  const [sel, setSel] = useState(null)
  const W = 340, H = 140, L = 30, B = 20, T = 8
  const pw = W - L - 4, ph = H - B - T
  const vals = rows.map((r) => value(r) || null)
  const maxVal = Math.max(integer ? 3 : 1, band?.[1] || 0, ...vals.map((v) => (v ? v.reduce((a, b) => a + b, 0) : 0)))
  const step = niceStep(maxVal, integer)
  const top = Math.ceil(maxVal / step) * step
  const y = (v) => T + ph - (v / top) * ph
  const slot = pw / rows.length
  const bw = Math.max(4, Math.min(22, slot * 0.62))
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
  const labelEvery = rows.length > 14 ? 5 : rows.length > 7 ? 2 : 1
  const selRow = sel != null ? rows[sel] : null
  const d = selRow && detail(selRow)

  return (
    <div class="chart">
      <div class="chart-detail">
        {selRow ? (
          <>
            <b>{fmtDay(selRow.key)}</b> · {d || 'nothing logged'}
          </>
        ) : (
          <span class="tiny">Tap a bar for details</span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img">
        {band && <rect class="band" x={L} y={y(band[1])} width={pw} height={y(band[0]) - y(band[1])} />}
        {ticks.map((v) => (
          <g key={v}>
            <line class="grid" x1={L} x2={W - 4} y1={y(v)} y2={y(v)} />
            <text class="axis" x={L - 6} y={y(v) + 3} text-anchor="end">{fmtAxis(v)}</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const cx = L + slot * i + slot / 2
          const v = vals[i]
          let acc = 0
          const segs = (v || []).map((part, j) => ({ part, j })).filter((s) => s.part > 0)
          return (
            <g key={r.key}>
              {sel === i && <rect class="sel" x={cx - slot / 2} y={T} width={slot} height={ph} rx="4" />}
              {segs.map(({ part, j }, k) => {
                const y0 = y(acc)
                acc += part
                const y1 = y(acc) + (k > 0 ? 0 : 0)
                const h = Math.max(1, y0 - y1 - (k > 0 ? 2 : 0))
                const isTop = k === segs.length - 1
                const x = cx - bw / 2
                const yy = y0 - (k > 0 ? 2 : 0) - h
                const r4 = Math.min(4, h, bw / 2)
                return isTop ? (
                  <path
                    key={j}
                    d={`M${x} ${yy + h}V${yy + r4}Q${x} ${yy} ${x + r4} ${yy}H${x + bw - r4}Q${x + bw} ${yy} ${x + bw} ${yy + r4}V${yy + h}Z`}
                    fill={classes[j]}
                  />
                ) : (
                  <rect key={j} x={x} y={yy} width={bw} height={h} fill={classes[j]} />
                )
              })}
              {(i % labelEvery === (rows.length - 1) % labelEvery) && (
                <text class="axis" x={cx} y={H - 6} text-anchor="middle">
                  {rows.length > 7 ? parseDay(r.key).getDate() : parseDay(r.key).toLocaleDateString([], { weekday: 'short' })}
                </text>
              )}
              <rect class="hit" x={cx - slot / 2} y={0} width={slot} height={H} onClick={() => setSel(sel === i ? null : i)} />
            </g>
          )
        })}
      </svg>
    </div>
  )
}
