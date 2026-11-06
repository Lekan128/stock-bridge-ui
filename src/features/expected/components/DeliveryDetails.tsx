import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { expectedCopy } from '@/features/expected/copy'
import { addDays, neededWords, todayIso } from '@/features/expected/expected'

const text = expectedCopy.form

export interface BranchChoice {
  id: string
  name: string
  address?: string
}

export interface DeliveryDetailsProps {
  supplierName: string
  /** Where it goes, said as a line: the branch, or the company's one address. */
  deliverTo: { name?: string; address?: string } | null
  /** More than one branch it could go to: "Change" opens a chooser in place. */
  branches: BranchChoice[]
  branchId: string
  onBranchChange: (branchId: string) => void
  /** Who may fix a missing address (company settings). */
  canEditAddress: boolean
  neededBy: string
  onNeededByChange: (isoDay: string) => void
  note: string
  onNoteChange: (note: string) => void
  disabled?: boolean
}

/**
 * "Delivery" (redesign 2026-11-04): always shown, because where and when are the first things a
 * supplier asks. Each part is one short line; "Change", "Pick a day" and "Add" open in place.
 */
export function DeliveryDetails(props: DeliveryDetailsProps) {
  const { supplierName, deliverTo, branches, branchId, onBranchChange, canEditAddress, neededBy, onNeededByChange, note, onNoteChange, disabled } = props
  const [choosingBranch, setChoosingBranch] = useState(false)
  // Only where the browser can't open its calendar from a button: then the date box shows instead.
  const [pickingDay, setPickingDay] = useState(false)
  const dayRef = useRef<HTMLInputElement>(null)

  /** "Pick a day" opens the calendar at once — no box to find and press a second time. */
  function openCalendar() {
    const input = dayRef.current
    try {
      if (input && typeof input.showPicker === 'function') {
        input.showPicker()
        return
      }
    } catch {
      // Some browsers refuse outside a direct tap; fall through to the box.
    }
    setPickingDay(true)
    window.setTimeout(() => dayRef.current?.focus(), 0)
  }
  const [writingNote, setWritingNote] = useState(false)
  const today = todayIso()
  const quick = [
    { label: text.anyTime, value: '' },
    { label: text.tomorrow, value: addDays(today, 1) },
    { label: text.inThreeDays, value: addDays(today, 3) },
    { label: text.nextWeek, value: addDays(today, 7) },
  ]
  const isQuick = quick.some((option) => option.value === neededBy)
  const inPast = neededBy !== '' && neededBy < today
  const noteOpen = writingNote || note.trim() !== ''

  const deliverToText = deliverTo
    ? [deliverTo.name, deliverTo.address].filter((part) => part && part.trim() !== '').join(', ')
    : ''

  return (
    <section aria-labelledby="po-delivery-heading" className="flex flex-col gap-2">
      <h2 id="po-delivery-heading" className="text-sm font-semibold text-neutral-900">
        {text.deliveryHeading}
      </h2>
      <div className="flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white text-sm">
        {/* Deliver to */}
        <div className="flex flex-col gap-2 px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-wrap gap-x-3">
              <span className="w-24 shrink-0 text-neutral-500">{text.deliverTo}</span>
              <span className="min-w-0 flex-1 text-neutral-900">
                {deliverToText || <span className="text-neutral-600">{text.deliverToNone}</span>}
              </span>
            </div>
            {branches.length > 1 && !choosingBranch && (
              <LinkButton onClick={() => setChoosingBranch(true)} disabled={disabled}>
                {text.change}
              </LinkButton>
            )}
            {branches.length <= 1 && !deliverTo?.address && canEditAddress && (
              <Link to="/app/company" className="shrink-0 rounded-sm font-medium text-primary-700 hover:underline">
                {text.addAddress}
              </Link>
            )}
          </div>
          {choosingBranch && (
            <select
              aria-label={text.deliverTo}
              value={branchId}
              disabled={disabled}
              onChange={(event) => {
                onBranchChange(event.target.value)
                setChoosingBranch(false)
              }}
              className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm"
            >
              <option value="">{text.chooseBranch}</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Needed by */}
        <div className="flex flex-col gap-2 px-4 py-3">
          <div className="flex flex-wrap gap-x-3">
            <span className="w-24 shrink-0 text-neutral-500">{text.neededBy}</span>
            <span className="text-neutral-900">{neededBy ? neededWords(neededBy) : text.anyTime}</span>
          </div>
          <div role="group" aria-label={text.neededBy} className="flex flex-wrap gap-1.5">
            {quick.map((option) => (
              <Chip
                key={option.label}
                on={neededBy === option.value}
                disabled={disabled}
                onClick={() => {
                  setPickingDay(false)
                  onNeededByChange(option.value)
                }}
              >
                {option.label}
              </Chip>
            ))}
            {/* The date box sits under this chip, invisible, so the calendar opens beside it. */}
            <span className="relative inline-flex">
              <Chip on={!isQuick && neededBy !== ''} disabled={disabled} onClick={openCalendar}>
                {text.pickDay}
              </Chip>
              <label htmlFor="po-needed-by" className="sr-only">
                {text.pickDayLabel}
              </label>
              <input
                ref={dayRef}
                id="po-needed-by"
                type="date"
                min={today}
                value={isQuick ? '' : neededBy}
                disabled={disabled}
                tabIndex={pickingDay ? 0 : -1}
                onChange={(event) => {
                  if (event.target.value) onNeededByChange(event.target.value)
                }}
                aria-invalid={inPast || undefined}
                className={
                  pickingDay
                    ? 'absolute top-full left-0 z-10 mt-1 h-10 rounded-md border border-neutral-300 bg-white px-3 text-base sm:text-sm'
                    : 'pointer-events-none absolute bottom-0 left-0 h-px w-full opacity-0'
                }
              />
            </span>
          </div>
          {pickingDay && <div className="h-11" aria-hidden="true" />}
          {inPast && <p className="text-xs text-danger-700">{text.neededInPast}</p>}
        </div>

        {/* Note */}
        <div className="flex flex-col gap-2 px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex flex-wrap gap-x-3">
              <span className="text-neutral-500">{text.noteFor(supplierName)}</span>
              {!noteOpen && <span className="text-neutral-600">{text.noteNone}</span>}
            </div>
            {!noteOpen && (
              <LinkButton onClick={() => setWritingNote(true)} disabled={disabled}>
                {text.noteAdd}
              </LinkButton>
            )}
          </div>
          {noteOpen && (
            <textarea
              aria-label={text.noteFor(supplierName)}
              rows={2}
              maxLength={500}
              value={note}
              disabled={disabled}
              autoFocus={writingNote && note === ''}
              onChange={(event) => onNoteChange(event.target.value)}
              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-base text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none sm:text-sm"
            />
          )}
        </div>
      </div>
    </section>
  )
}

function Chip({ on, onClick, disabled, children }: { on: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none ${
        on ? 'border-primary-100 bg-primary-100 font-semibold text-primary-900' : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
      }`}
    >
      {children}
    </button>
  )
}

function LinkButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="shrink-0 rounded-sm font-medium text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
    >
      {children}
    </button>
  )
}
