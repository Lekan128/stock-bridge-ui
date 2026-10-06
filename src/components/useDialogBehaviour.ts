import { useEffect, useRef, type RefObject } from 'react'

/** Open dialogs, innermost last: only the top one answers Escape and keeps Tab inside it. */
const stack: HTMLElement[] = []

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
const FIELDS = 'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])'

/**
 * What every dialog does while it is open (plan Track B, B2), shared by `Modal` and `Sheet`:
 *
 * - **Initial focus**: whatever the form autofocused, else `[data-autofocus]`, else its first
 *   field, else the dialog itself — so a screen reader starts inside it, and a keyboard user can
 *   type straight away.
 * - **A focus trap**: Tab and Shift+Tab cycle inside the dialog.
 * - **`inert` on everything behind it**, so nothing back there can be reached or read out.
 * - **Escape closes** — only the top dialog, when one is opened from another.
 * - **Focus returns** to whatever opened it.
 *
 * `ref` is the element with `role="dialog"`; it must sit inside a direct child of <body> (the
 * portal), which is what stays reachable.
 */
export function useDialogBehaviour(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const dialog = ref.current
    if (!open || !dialog) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    stack.push(dialog)

    // Everything else on the page is out of reach while this is open.
    const portal = [...document.body.children].find((child) => child.contains(dialog))
    const madeInert: HTMLElement[] = []
    for (const child of document.body.children) {
      if (child === portal || !(child instanceof HTMLElement) || child.inert || child.tagName === 'SCRIPT') continue
      child.inert = true
      madeInert.push(child)
    }
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    if (!dialog.contains(document.activeElement)) {
      const target =
        dialog.querySelector<HTMLElement>('[data-autofocus]') ?? dialog.querySelector<HTMLElement>(FIELDS) ?? dialog
      target.focus({ preventScroll: true })
    }

    function onKeyDown(event: KeyboardEvent) {
      if (stack[stack.length - 1] !== dialog || !dialog) return
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      )
      if (focusable.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      stack.splice(stack.indexOf(dialog), 1)
      for (const element of madeInert) element.inert = false
      document.body.style.overflow = overflow
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [open, ref])
}
