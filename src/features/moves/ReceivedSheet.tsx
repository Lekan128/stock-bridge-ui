import { useState } from 'react'
import { Button } from '@/components/Button'
import { QuantityStepper } from '@/components/QuantityStepper'
import { Sheet } from '@/components/Sheet'
import { Skeleton } from '@/components/Skeleton'
import { TextField } from '@/components/TextField'
import { useToast } from '@/components/useToast'
import { useApiQuery } from '@/data/useApiQuery'
import { useOptionalWorkingBranch } from '@/features/branches/useWorkingBranch'
import { formatDateTime } from '@/features/marketplace/formatters'
import { ChoiceChips } from '@/features/moves/ChoiceChips'
import { movesApi } from '@/features/moves/movesApi'
import { GIVE_BACK_REASONS, RETURN_REASONS, lineUnit, returnsSaid, type MoveLine } from '@/features/moves/moveWords'
import type { AreaMove, ReturnReason } from '@/features/moves/types'
import { submitReturn } from '@/features/outbox/outboxStore'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import { resolveUnitSymbol } from '@/features/products/unitSet'
import { isAppError } from '@/types/api'

type Open = { key: string; kind: 'GIVE_BACK' | 'REPORT' }

/**
 * "Received by Kitchen" (STOCK_AREAS_PART_6.md, STOCK_AREAS_PLAN.md §5.6; owner, 2026-11-01: any area that received
 * stock): what arrived in the last 7 days in the areas this person works in, newest first - each line with **Give
 * back** and **Report**, so nobody searches the catalogue. Either opens that line in place (owner: no popups), one at
 * a time: how many, why, a note. Give back goes to where it came from; Report writes it off where it is. Through the
 * outbox, so it works offline like the move it came from.
 */
export function ReceivedSheet({ onClose }: { onClose: () => void }) {
  const branch = useOptionalWorkingBranch()
  const here = branch && !branch.isAll ? branch.working : null
  const { data, loading } = useApiQuery({
    queryKey: ['area-moves', 'received', here?.id ?? 'all'],
    queryFn: () => movesApi.received(here?.id),
    fallbackError: "Couldn't load what arrived.",
  })
  const [open, setOpen] = useState<Open | null>(null)
  const moves = data ?? []
  const areaNames = [...new Set(moves.map((move) => move.toAreaName))]
  const title = areaNames.length === 1 ? `Received by ${areaNames[0]}` : 'Received lately'

  return (
    <Sheet open onClose={onClose} title={title} size="md">
      <div className="flex flex-col gap-4" data-given-sheet>
        <p className="text-sm text-neutral-600">
          The last 7 days. Give back what you don't need or can't use, or report what spoilt.
        </p>
        {loading && moves.length === 0 ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full rounded-md" />
            ))}
          </div>
        ) : moves.length === 0 ? (
          <p className="rounded-lg border border-neutral-200 bg-white px-4 py-6 text-center text-sm text-neutral-600">
            Nothing arrived here in the last 7 days.
          </p>
        ) : (
          <ul aria-label="Received lately" className="flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
            {moves.flatMap((move) =>
              move.lines.map((line) => (
                <ReceivedLine
                  key={`${move.id}:${line.productId}`}
                  move={move}
                  line={line}
                  areaShown={areaNames.length > 1}
                  open={open?.key === `${move.id}:${line.productId}` ? open.kind : null}
                  onOpen={(kind) => setOpen(kind ? { key: `${move.id}:${line.productId}`, kind } : null)}
                />
              )),
            )}
          </ul>
        )}
      </div>
    </Sheet>
  )
}

function ReceivedLine({
  move,
  line,
  areaShown,
  open,
  onOpen,
}: {
  move: AreaMove
  line: MoveLine
  areaShown: boolean
  open: 'GIVE_BACK' | 'REPORT' | null
  onOpen: (kind: 'GIVE_BACK' | 'REPORT' | null) => void
}) {
  const { options } = useUnitOfMeasureOptions()
  const { showToast } = useToast()
  const unit = lineUnit(line, resolveUnitSymbol(line.unitOfMeasure, options))
  const used = line.got ?? line.quantity
  const left = Math.floor((line.returnable ?? 0) / unit.per)
  const [howMany, setHowMany] = useState(1)
  const [reason, setReason] = useState<ReturnReason>('SPOILT')
  const [why, setWhy] = useState<ReturnReason | 'NOT_NEEDED'>('NOT_NEEDED')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const returned = returnsSaid(line.returns, unit.say, unit.per)
  const reasonWord = RETURN_REASONS.find((option) => option.value === reason)?.word ?? ''
  const amount = unit.say(Math.min(howMany, left))

  function start(kind: 'GIVE_BACK' | 'REPORT') {
    setHowMany(1)
    setWhy('NOT_NEEDED')
    setNote('')
    setProblem(null)
    onOpen(kind)
  }

  async function send() {
    if (!open) return
    setBusy(true)
    setProblem(null)
    try {
      const quantity = Math.min(howMany, left) * unit.per
      const outcome = await submitReturn(
        move.id,
        {
          id: crypto.randomUUID(),
          productId: line.productId,
          kind: open,
          quantity,
          ...(open === 'REPORT' ? { reason } : why !== 'NOT_NEEDED' ? { reason: why } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        },
        open === 'GIVE_BACK' ? `Give back ${amount} of ${line.productName}` : `Report ${amount} of ${line.productName} ${reasonWord}`,
      )
      onOpen(null)
      showToast(
        outcome.status === 'queued'
          ? "Saved on this phone. It goes when you're connected."
          : open === 'GIVE_BACK'
            ? `Given back · ${amount} of ${line.productName} · to the ${move.fromAreaName}`
            : `Reported · ${amount} of ${line.productName} ${reasonWord}`,
        outcome.status === 'queued' ? 'info' : 'success',
      )
    } catch (error) {
      setProblem(isAppError(error) ? error.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="flex flex-col gap-3 px-3 py-3" data-given-line={line.productName}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="text-base font-medium text-neutral-900">{line.productName}</p>
        <p className="text-xs text-neutral-500">
          {areaShown ? `${move.toAreaName} · ` : ''}
          {formatDateTime(move.movedAt)}
          {move.movedByName ? ` · ${move.movedByName}` : ''}
        </p>
      </div>
      <div className="-mt-2 flex items-end justify-between gap-3">
        <p className="text-sm text-neutral-600">
          {unit.say(used / unit.per)} received{returned ? ` · ${returned}` : ''}
        </p>
        {open == null && left > 0 && (
          <div className="-my-2 flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => start('GIVE_BACK')}
              aria-label={`Give back ${line.productName}`}
              className="inline-flex min-h-11 items-center px-1 text-sm font-medium text-primary-700 hover:underline"
            >
              Give back
            </button>
            <span aria-hidden="true" className="self-center text-neutral-300">
              ·
            </span>
            <button
              type="button"
              onClick={() => start('REPORT')}
              aria-label={`Report ${line.productName}`}
              className="inline-flex min-h-11 items-center px-1 text-sm font-medium text-primary-700 hover:underline"
            >
              Report
            </button>
          </div>
        )}
      </div>

      {open != null && (
        // Opened in place (no popup): how many, and for a report why - the line grows, the others move down.
        <div className="flex flex-col gap-3 rounded-lg bg-neutral-50 p-3" data-return-form={open}>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-neutral-800">{open === 'GIVE_BACK' ? 'How many to give back?' : 'How many?'}</span>
            <QuantityStepper value={Math.min(howMany, left)} onChange={setHowMany} min={1} max={left} label={`How many ${line.productName}`} size="md" />
          </div>
          {open === 'REPORT' ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-sm text-neutral-800">What happened to it?</p>
              <ChoiceChips
                name={`reason-${move.id}-${line.productId}`}
                label={`What happened to the ${line.productName}`}
                value={reason}
                options={RETURN_REASONS.map(({ value, label }) => ({ value, label }))}
                onChange={setReason}
              />
            </div>
          ) : (
            // Why it goes back, so the area it came from knows what to do with it (an expired tin to the supplier).
            <div className="flex flex-col gap-1.5">
              <p className="text-sm text-neutral-800">Why?</p>
              <ChoiceChips
                name={`why-${move.id}-${line.productId}`}
                label={`Why the ${line.productName} goes back`}
                value={why}
                options={GIVE_BACK_REASONS}
                onChange={setWhy}
              />
            </div>
          )}
          <TextField
            id={`return-note-${move.id}-${line.productId}`}
            label="Note (optional)"
            value={note}
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
          />
          {problem && (
            <p role="alert" className="text-sm text-danger-700">
              {problem}
            </p>
          )}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpen(null)}
              className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-neutral-700 hover:underline"
            >
              Cancel
            </button>
            <Button variant="action" loading={busy} onClick={() => void send()}>
              {open === 'GIVE_BACK' ? `Give back ${amount} to the ${move.fromAreaName}` : `Report ${amount} ${reasonWord}`}
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}
