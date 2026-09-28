import { useEffect, useRef } from 'preact/hooks'
import { toast } from '../lib/store.js'

export function Sheet({ onClose, children, label }) {
  const ref = useRef(null)
  useEffect(() => {
    // Move focus into the sheet so keyboard and screen-reader users land in it.
    const prev = document.activeElement
    ref.current?.focus({ preventScroll: true })
    const onKey = (e) => e.key === 'Escape' && onClose()
    addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prev?.focus?.({ preventScroll: true })
    }
  }, [])
  return (
    <>
      <div class="scrim" onClick={onClose} />
      <div class="sheet" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={ref}>
        <div class="grab" />
        {children}
      </div>
    </>
  )
}

export function Toast({ onAdjust }) {
  const t = toast.value
  useEffect(() => {
    if (!t) return
    const id = setTimeout(() => {
      if (toast.peek() === t) toast.value = null
    }, t.tone === 'error' ? 8000 : 6000)
    return () => clearTimeout(id)
  }, [t])
  if (!t) return null
  return (
    <div class={`toast ${t.tone || ''}`} role="status">
      <span class="t">{t.text}</span>
      {t.adjust && (
        <button
          onClick={() => {
            onAdjust(t.adjust)
            toast.value = null
          }}
        >
          Adjust
        </button>
      )}
      {t.undo && (
        <button
          onClick={() => {
            t.undo()
            toast.value = null
          }}
        >
          Undo
        </button>
      )}
    </div>
  )
}
