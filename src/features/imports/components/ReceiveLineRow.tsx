import { X } from 'lucide-react'
import { receiveCopy as text } from '@/features/imports/receiveCopy'
import { arrivedOf, backOf, backProblem, invalidAmount, words, type ReceiveRow, type SendBack } from '@/features/imports/receive'
import type { SendBackReason } from '@/features/imports/types'

const REASONS: SendBackReason[] = ['WRONG_ITEM', 'DAMAGED', 'EXPIRED', 'NOT_ORDERED', 'PRICE', 'OTHER']

export interface ReceiveLineRowProps {
  row: ReceiveRow
  id: string
  onArrived: (typed: string) => void
  onBack: (patch: Partial<SendBack>) => void
  /** Only for a line that isn't on the order: it can be taken off again. */
  onRemove?: () => void
  disabled?: boolean
}

/**
 * One line of Record a delivery (mockups B, C, 5A): Ordered beside Arrived on the same line, so
 * there is no button between seeing the order and changing it. "5 short" or "2 extra" says itself
 * as the number changes; "Some sent back" opens a box under the line for how many and why.
 */
export function ReceiveLineRow({ row, id, onArrived, onBack, onRemove, disabled }: ReceiveLineRowProps) {
  const arrived = arrivedOf(row)
  const back = backOf(row)
  const problem = backProblem(row)
  const badArrived = invalidAmount(row.arrived)
  const name = row.line.productName
  const pack = row.line.pack ? row.line.comesIn.split(' · ').slice(1).join(' · ') : ''

  const status: React.ReactNode[] = []
  if (row.ordered == null) {
    status.push(
      <span key="no" className="font-medium text-accent-700">
        {text.notOrdered}
      </span>,
    )
  } else if (!badArrived && arrived < row.ordered) {
    status.push(
      <span key="short" className="font-semibold text-warning-800">
        {text.short(words(row, row.ordered - arrived))}
      </span>,
    )
  } else if (!badArrived && arrived > row.ordered) {
    status.push(
      <span key="extra" className="font-semibold text-accent-700">
        {text.extra(words(row, arrived - row.ordered))}
      </span>,
    )
  }
  if (back > 0 && problem == null) {
    status.push(
      <span key="back" className="text-neutral-700">
        {text.taking(words(row, Math.max(0, arrived - back)), words(row, back))}
      </span>,
    )
  }

  return (
    <li className="relative px-3 py-2.5 sm:px-4">
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3">
        <label htmlFor={id} className="min-w-0">
          <span className="block text-sm font-semibold text-neutral-900">{name}</span>
          {pack && <span className="block text-xs text-neutral-500">{row.line.comesIn}</span>}
          <span className="sr-only">, {text.arrivedLabel(name)}</span>
        </label>
        <span className="text-right text-xs whitespace-nowrap tabular-nums text-neutral-600">
          {row.ordered != null ? words(row, row.ordered) : '—'}
        </span>
        <span className="flex items-center gap-1">
          <input
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={row.arrived}
            disabled={disabled}
            onChange={(event) => onArrived(event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            aria-invalid={badArrived || undefined}
            className={`w-16 rounded-md border py-1.5 text-center text-base font-semibold tabular-nums text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none sm:text-sm ${
              badArrived ? 'border-danger-300 bg-danger-50' : 'border-neutral-200 bg-white'
            }`}
          />
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              disabled={disabled}
              aria-label={text.removeLabel(name)}
              className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </span>
      </div>

      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs" aria-live="polite">
        {status.map((part, index) => (
          <span key={index} className="inline-flex items-center gap-2">
            {index > 0 && <span aria-hidden="true">·</span>}
            {part}
          </span>
        ))}
        {!row.back.open && arrived > 0 && (
          <>
            {status.length > 0 && <span aria-hidden="true">·</span>}
            <button
              type="button"
              disabled={disabled}
              onClick={() => onBack({ open: true, reason: row.ordered == null ? 'NOT_ORDERED' : row.back.reason })}
              aria-label={text.someBackLabel(name)}
              className="rounded-sm font-medium text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
              {text.someBack}
            </button>
          </>
        )}
      </p>

      {row.back.open && (
        <div className="mt-2 flex flex-col gap-2 rounded-md bg-neutral-100 p-3">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor={`${id}-back`} className="text-sm text-neutral-700">
              {text.backHow}
              <span className="sr-only">, {text.backHowLabel(name)}</span>
            </label>
            <span className="flex items-center gap-2">
              <input
                id={`${id}-back`}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                autoFocus
                value={row.back.quantity}
                disabled={disabled}
                onChange={(event) => onBack({ quantity: event.target.value })}
                aria-invalid={problem === 'tooMany' || problem === 'number' || undefined}
                className={`w-16 rounded-md border py-1.5 text-center text-base font-semibold tabular-nums focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none sm:text-sm ${
                  problem === 'tooMany' || problem === 'number' ? 'border-danger-300 bg-danger-50' : 'border-neutral-200 bg-white'
                }`}
              />
              <button
                type="button"
                onClick={() => onBack({ open: false, quantity: '', reason: null, note: '' })}
                className="rounded-sm text-xs font-medium text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
              >
                {text.backNone}
              </button>
            </span>
          </div>
          {problem === 'tooMany' && <p className="text-xs text-danger-700">{text.backTooMany}</p>}
          <fieldset className="flex flex-col gap-1.5">
            <legend className={`mb-1 text-xs font-medium ${problem === 'why' ? 'text-danger-700' : 'text-neutral-700'}`}>{text.backWhy}</legend>
            <div className="flex flex-wrap gap-1.5">
              {REASONS.map((reason) => {
                const on = row.back.reason === reason
                return (
                  <button
                    key={reason}
                    type="button"
                    aria-pressed={on}
                    disabled={disabled}
                    onClick={() => onBack({ reason })}
                    className={`rounded-full border px-2.5 py-1 text-xs focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none ${
                      on ? 'border-primary-100 bg-primary-100 font-semibold text-primary-900' : 'border-neutral-200 bg-white text-neutral-700'
                    }`}
                  >
                    {text.reasons[reason]}
                  </button>
                )
              })}
            </div>
          </fieldset>
          {(row.back.reason === 'OTHER' || row.back.note !== '') && (
            <div className="flex flex-col gap-1">
              <label htmlFor={`${id}-note`} className={`text-xs font-medium ${problem === 'note' ? 'text-danger-700' : 'text-neutral-700'}`}>
                {text.backNote}
              </label>
              <input
                id={`${id}-note`}
                type="text"
                maxLength={200}
                value={row.back.note}
                disabled={disabled}
                onChange={(event) => onBack({ note: event.target.value })}
                className="w-full rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-base sm:text-sm"
              />
            </div>
          )}
        </div>
      )}
    </li>
  )
}
