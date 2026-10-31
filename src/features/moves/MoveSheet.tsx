import { useState } from 'react'
import { Button } from '@/components/Button'
import { QuantityStepper } from '@/components/QuantityStepper'
import { Sheet } from '@/components/Sheet'
import { useToast } from '@/components/useToast'
import { formatDateTime } from '@/features/marketplace/formatters'
import { movesApi } from '@/features/moves/movesApi'
import { itemsWord, lineUnit, moveState, type MoveLine } from '@/features/moves/moveWords'
import type { AreaMove } from '@/features/moves/types'
import { applyMoveResult, submitMoveConfirm } from '@/features/outbox/outboxStore'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import { resolveUnitSymbol } from '@/features/products/unitSet'
import { isAppError } from '@/types/api'

/**
 * One move, opened from Needs you today, quick mode's line, the bell or the Moves list (STOCK_AREAS_PART_4.md,
 * STOCK_AREAS_PLAN.md §5.3). Waiting for an area this person works in: what was moved, each with "got", and
 * **Got everything** in one tap - change a number and it asks the one question, what happened to the rest.
 * Otherwise it says where the move stands, with **Take it back** for its mover while it waits. A side panel on a
 * laptop, a bottom sheet on a phone, like every stock write; the confirmation goes through the outbox.
 */
export function MoveSheet({ move, onClose }: { move: AreaMove; onClose: () => void }) {
  const confirming = move.status === 'WAITING' && move.canConfirm === true
  const { options } = useUnitOfMeasureOptions()
  const { showToast } = useToast()
  const units = move.lines.map((line) => lineUnit(line, resolveUnitSymbol(line.unitOfMeasure, options)))
  // What arrived of each line, in the unit it's spoken in; everything, to start with.
  const [got, setGot] = useState<number[]>(() => move.lines.map((line, i) => line.quantity / units[i].per))
  const [rest, setRest] = useState<'BACK' | 'DAMAGED'>('BACK')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const shortLines = move.lines.flatMap((line, i) => (got[i] * units[i].per < line.quantity ? [i] : []))
  const short = shortLines.length > 0
  const shortSaid =
    shortLines.length === 1
      ? units[shortLines[0]].say(move.lines[shortLines[0]].quantity / units[shortLines[0]].per - got[shortLines[0]])
      : itemsWord(shortLines.length)
  const moved = `Moved to the ${move.toAreaName}${move.movedByName ? ` by ${move.movedByName}` : ''} · ${formatDateTime(move.movedAt)}`

  async function confirm() {
    setBusy(true)
    setProblem(null)
    try {
      const outcome = await submitMoveConfirm(
        move.id,
        {
          lines: move.lines.map((line, i) => ({ productId: line.productId, got: Math.min(line.quantity, got[i] * units[i].per) })),
          ...(short ? { rest } : {}),
        },
        move.lines.map((line) => line.productId),
        `${itemsWord(move.lines.length)} · ${move.fromAreaName} → ${move.toAreaName}`,
      )
      onClose()
      showToast(
        outcome.status === 'sent'
          ? `Confirmed · ${short ? `${shortSaid} short` : 'got everything'} · ${move.toAreaName}`
          : "Saved on this phone. It goes when you're connected.",
        outcome.status === 'sent' ? 'success' : 'info',
      )
    } catch (error) {
      setProblem(isAppError(error) ? error.message : "Couldn't confirm this. Try again.")
    } finally {
      setBusy(false)
    }
  }

  async function takeBack() {
    setBusy(true)
    setProblem(null)
    try {
      applyMoveResult(await movesApi.cancel(move.id))
      onClose()
      showToast(`Taken back · in the ${move.fromAreaName} again`, 'info')
    } catch (error) {
      setProblem(isAppError(error) ? error.message : "Couldn't take this back. Try again.")
    } finally {
      setBusy(false)
    }
  }

  const state = moveState(move)
  return (
    <Sheet
      open
      onClose={onClose}
      title={`${itemsWord(move.lines.length)} from the ${move.fromAreaName}`}
      size="md"
      footer={
        confirming ? (
          <Button variant="action" className="w-full" loading={busy} onClick={() => void confirm()}>
            {short ? `Confirm · ${shortSaid} short` : 'Got everything'}
          </Button>
        ) : move.status === 'WAITING' && move.canCancel ? (
          <Button variant="secondary" className="w-full" loading={busy} onClick={() => void takeBack()}>
            Take it back
          </Button>
        ) : null
      }
    >
      <div className="flex flex-col gap-4" data-move-sheet={move.id}>
        <p className="text-sm text-neutral-600">
          {moved}
          {!confirming && state ? (
            <>
              <br />
              <span className="font-medium text-neutral-800" data-move-state>
                {state}
                {move.confirmedByName ? ` · ${move.confirmedByName}` : ''}
              </span>
            </>
          ) : null}
        </p>
        <ul className="flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200">
          {move.lines.map((line, i) => (
            <li key={line.productId} className="flex items-center justify-between gap-3 px-3 py-2.5" data-confirm-line={line.productId}>
              <div className="min-w-0">
                <p className="truncate text-base font-medium text-neutral-900">{line.productName}</p>
                <p className="text-sm text-neutral-600">
                  moved {units[i].say(line.quantity / units[i].per)}
                  {!confirming && line.got != null && line.got !== line.quantity ? ` · got ${units[i].say(line.got / units[i].per)}` : ''}
                  {line.damaged ? ` · ${units[i].say(line.damaged / units[i].per)} damaged` : ''}
                </p>
              </div>
              {confirming && <GotStepper line={line} value={got[i]} max={line.quantity / units[i].per} onChange={(n) => setGot((all) => all.map((v, j) => (j === i ? n : v)))} />}
            </li>
          ))}
        </ul>

        {confirming && short && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-neutral-800">
              What happened to {shortLines.length === 1 ? `the other ${shortSaid}` : 'the rest'}?
            </legend>
            {(
              [
                ['BACK', `It's still in the ${move.fromAreaName}`],
                ['DAMAGED', 'It was damaged'],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 ${
                  rest === value ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 bg-white'
                }`}
              >
                <input type="radio" name={`rest-${move.id}`} checked={rest === value} onChange={() => setRest(value)} className="h-4 w-4" />
                <span className="text-base text-neutral-900">{label}</span>
              </label>
            ))}
          </fieldset>
        )}

        {problem && (
          <p role="alert" className="text-sm text-danger-700">
            {problem}
          </p>
        )}

        {/* The mover may also be able to confirm (a manager works everywhere): taking it back stays here,
            quiet, never louder than the confirm button. */}
        {confirming && move.canCancel && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void takeBack()}
            className="-ml-1 inline-flex min-h-11 items-center self-start px-1 text-sm font-medium text-primary-700 hover:underline disabled:opacity-60"
          >
            Take it back to the {move.fromAreaName}
          </button>
        )}
      </div>
    </Sheet>
  )
}

function GotStepper({ line, value, max, onChange }: { line: MoveLine; value: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="text-sm text-neutral-600">got</span>
      <QuantityStepper value={value} onChange={onChange} min={0} max={max} label={`Got of ${line.productName}`} size="md" />
    </div>
  )
}
