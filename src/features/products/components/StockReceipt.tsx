import type { ReactNode } from 'react'
import { Stamp } from '@/components/Stamp'

export type ReceiptState =
  /** On its way to the server right now. */
  | 'sending'
  /** The server has it. */
  | 'synced'
  /** The server couldn't be reached: saved on this phone, sent later. */
  | 'recorded'

export interface ReceiptLine {
  label: string
  value: ReactNode
}

export interface StockReceiptProps {
  state: ReceiptState
  /** "Stock in", "Stock out", "Count". */
  kind: string
  /** The write's own id — printed as the receipt's number, as on a carbon-copy book. */
  id: string | null
  lines: ReceiptLine[]
  /** What the server said back, below the tear line: the new figure, where a sale came from. */
  children?: ReactNode
}

/**
 * The carbon-copy receipt (C3, finding U6; plan §2 "stamps for state"): what was just recorded,
 * line by line, numbered like a page torn from a receipt book — and stamped. It lands RECORDED the
 * moment Confirm is pressed and turns SYNCED when the server has it, or stays RECORDED, saying so
 * plainly, when the phone is offline. One for stock in, stock out and count.
 */
export function StockReceipt({ state, kind, id, lines, children }: StockReceiptProps) {
  const number = id ? id.replace(/-/g, '').slice(-6).toUpperCase() : null
  return (
    <div className="flex flex-col gap-4" data-receipt={state}>
      <div className="relative rounded-sm border border-neutral-200 bg-white shadow-paper">
        {/* The perforation along the top of a page torn from the book. */}
        <div className="h-2 border-b border-dashed border-neutral-300 bg-neutral-50" aria-hidden="true" />
        <div className="flex flex-col gap-4 px-5 pt-4 pb-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">{kind}</p>
              {number && <p className="mt-0.5 text-xs tabular-nums text-neutral-500">No. {number}</p>}
            </div>
            {/* Keyed by state, so the change from RECORDED to SYNCED lands as a fresh stamp. */}
            <Stamp key={state} kind={state === 'synced' ? 'synced' : 'recorded'} land />
          </div>

          <dl className="flex flex-col">
            {lines.map((line) => (
              <div key={line.label} className="flex items-baseline justify-between gap-4 border-b border-neutral-100 py-2 last:border-b-0">
                <dt className="shrink-0 text-sm text-neutral-500">{line.label}</dt>
                <dd className="min-w-0 text-right text-sm font-medium text-neutral-900 tabular-nums">{line.value}</dd>
              </div>
            ))}
          </dl>

          <p role="status" className="text-sm text-neutral-600">
            {state === 'sending' && 'Sending…'}
            {state === 'synced' && 'Recorded on the server.'}
            {state === 'recorded' &&
              "Saved on this phone — the server can't be reached right now. It will be sent by itself, and the stock figures change then. Don't record it again."}
          </p>
        </div>
      </div>
      {children}
    </div>
  )
}
