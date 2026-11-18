import { useRef, type InputHTMLAttributes } from 'react'

/**
 * An amount as it's typed, with commas in the thousands (owner, 2026-11-18): "12500" reads "12,500" while it's typed.
 * Kobo after a point, two at most; `whole` keeps it to naira. Anything else typed is dropped.
 */
export function groupMoney(text: string, whole = false): string {
  const kept = text.replace(whole ? /[^0-9]/g : /[^0-9.]/g, '')
  const dot = kept.indexOf('.')
  const naira = (dot === -1 ? kept : kept.slice(0, dot)).replace(/^0+(?=\d)/, '')
  const grouped = naira.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  if (dot === -1) return grouped
  return `${grouped || '0'}.${kept.slice(dot + 1).replace(/\./g, '').slice(0, 2)}`
}

/** A number as an amount box shows it: "1,500", "133.33". */
export function moneyText(value: number): string {
  return groupMoney(String(Math.round(value * 100) / 100))
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'inputMode'> & {
  value: string
  onValue: (text: string) => void
  /** Naira only: no point, no kobo. */
  whole?: boolean
}

/**
 * A text box for money that puts the commas in as the person types, keeping the cursor where they were typing - a
 * comma appearing never throws it to the end. Reads back with `parseMoneyInput` / `moneyTyped`, which skip commas.
 */
export function MoneyInput({ value, onValue, whole = false, ...rest }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <input
      {...rest}
      ref={ref}
      inputMode={whole ? 'numeric' : 'decimal'}
      value={value}
      onChange={(event) => {
        const typed = event.target.value
        const caret = event.target.selectionStart ?? typed.length
        // How many digits (and the point) sit before the cursor: the same count lands it in the same place after.
        const before = typed.slice(0, caret).replace(whole ? /[^0-9]/g : /[^0-9.]/g, '').length
        const next = groupMoney(typed, whole)
        onValue(next)
        requestAnimationFrame(() => {
          const box = ref.current
          if (!box || document.activeElement !== box) return
          let seen = 0
          let at = 0
          while (at < next.length && seen < before) {
            if (/[0-9.]/.test(next[at])) seen += 1
            at += 1
          }
          box.setSelectionRange(at, at)
        })
      }}
    />
  )
}
