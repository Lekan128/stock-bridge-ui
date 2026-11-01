import { useState } from 'react'
import { Button } from '@/components/Button'
import { QuantityStepper } from '@/components/QuantityStepper'
import { Sheet } from '@/components/Sheet'
import { TextField } from '@/components/TextField'
import { useToast } from '@/components/useToast'
import { formatDateTime } from '@/features/marketplace/formatters'
import { movesApi } from '@/features/moves/movesApi'
import { ChoiceChips } from '@/features/moves/ChoiceChips'
import { itemsWord, lineUnit, moveState, restChoices, restWords, returnsSaid, type MoveLine } from '@/features/moves/moveWords'
import type { AreaMove, MoveRest } from '@/features/moves/types'
import { applyMoveResult, submitMoveConfirm } from '@/features/outbox/outboxStore'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import { resolveUnitSymbol } from '@/features/products/unitSet'
import { isAppError } from '@/types/api'

/**
 * One move, opened from Needs you today, quick mode's line, the bell or the Moves list (STOCK_AREAS_PART_4.md,
 * STOCK_AREAS_PLAN.md §5.3). Waiting for an area this person works in: what was moved, each with "got", and
 * **Got everything** in one tap - change a number and that line asks what happened to the rest, one tap each, with
 * a note for the move (Part 6; owner, 2026-11-01).
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
  // What happened to each line's shortfall (Part 6): still where it came from, to start with.
  const [rests, setRests] = useState<MoveRest[]>(() => move.lines.map(() => 'BACK'))
  const [note, setNote] = useState('')
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
          lines: move.lines.map((line, i) => {
            const arrived = Math.min(line.quantity, got[i] * units[i].per)
            return { productId: line.productId, got: arrived, ...(arrived < line.quantity ? { rest: rests[i] } : {}) }
          }),
          ...(short && note.trim() ? { note: note.trim() } : {}),
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
          {!confirming && move.confirmNote ? (
            <>
              <br />
              <span className="text-neutral-800" data-confirm-note>
                Note: {move.confirmNote}
              </span>
            </>
          ) : null}
        </p>
        <ul className="flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200">
          {move.lines.map((line, i) => {
            const missing = line.quantity / units[i].per - got[i]
            // What happened to what didn't arrive, once it's confirmed: "1 bag damaged or spoilt", "1 still in the Store".
            const shortBy = line.got != null ? (line.quantity - line.got) / units[i].per : 0
            const why = line.restReason ?? (line.damaged ? 'DAMAGED' : 'BACK')
            const returned = returnsSaid(line.returns, units[i].say, units[i].per)
            return (
              <li key={line.productId} className="flex flex-col gap-2 px-3 py-2.5" data-confirm-line={line.productId}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-medium text-neutral-900">{line.productName}</p>
                    <p className="text-sm text-neutral-600">
                      moved {units[i].say(line.quantity / units[i].per)}
                      {!confirming && line.got != null && line.got !== line.quantity ? ` · got ${units[i].say(line.got / units[i].per)}` : ''}
                      {!confirming && shortBy > 0 ? ` · ${units[i].say(shortBy)} ${restWords(why, move.fromAreaName)}` : ''}
                      {returned ? ` · ${returned}` : ''}
                    </p>
                  </div>
                  {confirming && <GotStepper line={line} value={got[i]} max={line.quantity / units[i].per} onChange={(n) => setGot((all) => all.map((v, j) => (j === i ? n : v)))} />}
                </div>
                {confirming && missing > 0 && (
                  <div className="flex flex-col gap-1.5" data-rest-question>
                    <p className="text-sm font-medium text-neutral-800">What happened to the other {units[i].say(missing)}?</p>
                    <ChoiceChips
                      name={`rest-${move.id}-${line.productId}`}
                      label={`What happened to the other ${units[i].say(missing)} of ${line.productName}`}
                      value={rests[i]}
                      options={restChoices(move.fromAreaName)}
                      onChange={(value) => setRests((all) => all.map((v, j) => (j === i ? value : v)))}
                    />
                  </div>
                )}
              </li>
            )
          })}
        </ul>

        {confirming && short && (
          <TextField
            id={`confirm-note-${move.id}`}
            label="Note (optional)"
            value={note}
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
          />
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
