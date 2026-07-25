import { useEffect, useRef } from 'react'

// Shared dialog behavior: initial focus, Tab trap, Escape close, focus restore.
// Matches the contract already proven for the rule publish dialog and extends
// it to every modal dialog in the prototype (docs/16 §4, docs/29 §5).
export default function useDialogA11y(open, onClose) {
  const ref = useRef(null)
  const closeRef = useRef(onClose)

  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return undefined
    const node = ref.current
    const previous = document.activeElement
    const focusables = () => [...(node?.querySelectorAll('button, [href], input, select, textarea') || [])].filter(el => !el.disabled)
    focusables()[0]?.focus()
    const onKeyDown = event => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab' || !node) return
      const items = focusables()
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previous?.focus?.()
    }
  }, [open])

  return ref
}
