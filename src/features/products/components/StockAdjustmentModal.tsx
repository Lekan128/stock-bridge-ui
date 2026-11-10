import { zodResolver } from '@hookform/resolvers/zod'
import { useSheetBranch } from '@/features/branches/useSheetBranch'
import { useOptionalWorkingBranch } from '@/features/branches/useWorkingBranch'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { Sheet } from '@/components/Sheet'
import { StockFigure } from '@/features/products/components/StockFigure'
import { StockReceipt } from '@/features/products/components/StockReceipt'
import { submitStockWrite } from '@/features/outbox/outboxStore'
import { stockCountSchema, type StockCountFormValues } from '@/features/products/schemas'
import type { Product, StockMutationResponse } from '@/features/products/types'
import type { AreaFigure } from '@/features/branches/types'
import { formatQuantity, stockUnitWord } from '@/features/products/unitCopy'
import { productsOwnUnits, roundQuantity, unitOptionsForProduct } from '@/features/products/unitSet'
import { useCountBoxes } from '@/features/products/useCountBoxes'
import { CountUnitLines } from '@/features/products/components/CountUnitLines'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import { CountShortfall } from '@/features/branches/CountShortfall'
import { areaShortAs, lastCountedPhrase, type ShortAs } from '@/features/branches/areas'
import { isAppError } from '@/types/api'

export interface StockAdjustmentModalProps {
  productId: string
  productName: string
  currentQuantity: number
  /** The product in each area (V60), so a count of the Kitchen is judged against the Kitchen's figure. */
  areaStock?: AreaFigure[]
  /** The stock unit's short form ("kg"), for every figure on screen. */
  stockUnit: string
  /** Counted in pieces: a fraction of one is refused. Measured (kg, L): to 3 places (UNITS_PLAN.md Part 0). */
  countedInWholeUnits?: boolean
  /** The product, for its units: counted as "2 bags + 7 dericas" when it has a pack (UNITS_PLAN.md Part 4). */
  product?: Product
  onClose: () => void
  onSuccess: (result: StockMutationResponse) => void
  /** Saved on this phone instead of sent (A4); gets the waiting write's id, for Undo (B2). */
  onQueued?: (opId: string) => void
}

/**
 * Count stock (A4, decision D1) — what Adjust became.
 *
 * Asks what is on the shelf, not what to set the figure to, and shows the difference against the
 * books before it is confirmed. Sent as a count with the moment it was taken, so a count made on a
 * phone that was offline is carried forward by sales other phones recorded after it rather than
 * erasing them. Online, it does exactly what Adjust did.
 */
export function StockAdjustmentModal({
  productId,
  productName,
  currentQuantity: branchQuantity,
  areaStock,
  stockUnit,
  countedInWholeUnits = true,
  product,
  onClose,
  onSuccess,
  onQueued,
}: StockAdjustmentModalProps) {
  // Which branch's shelf is counted (MULTI_BRANCH_UX_PLAN.md §5.2).
  const sheetBranch = useSheetBranch()
  const branchContext = useOptionalWorkingBranch()
  // The area counted, at a branch with a choice of them (V60): its books are the Kitchen's, not the branch's.
  const areaFigure = sheetBranch.areaId ? areaStock?.find((figure) => figure.areaId === sheetBranch.areaId) : undefined
  const currentQuantity = sheetBranch.areaId ? (areaFigure?.quantityOnHand ?? 0) : branchQuantity
  // What a shortfall becomes (Part 3.5): the area's answer - used in a kitchen, missing in a store - unless
  // changed for this count.
  const area = sheetBranch.areaId
    ? branchContext?.branches.flatMap((branch) => branch.areas ?? []).find((candidate) => candidate.id === sheetBranch.areaId)
    : undefined
  const [shortChosen, setShortChosen] = useState<ShortAs | null>(null)
  const shortAs = shortChosen ?? (area ? areaShortAs(area) : 'MISSING')
  const lastCounted = lastCountedPhrase(areaFigure?.lastCountedAt)
  const [formError, setFormError] = useState<string | null>(null)
  const [queuedSentence, setQueuedSentence] = useState<string | null>(null)
  const [queuedOpId, setQueuedOpId] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<StockCountFormValues>({
    resolver: zodResolver(stockCountSchema),
    defaultValues: { countedQuantity: '', note: '' },
  })

  // Counted the way a store is (UNITS_PLAN.md Part 4): whole packs and what's left - "2 bags + 7 dericas" - in as
  // many of the product's units as the shelf needs, each in its own box (owner, 2026-11-09).
  const { options: unitsOfMeasure } = useUnitOfMeasureOptions()
  const offered = product ? productsOwnUnits(unitOptionsForProduct(product, unitsOfMeasure)) : []
  const count = useCountBoxes(product ?? {}, offered)
  const [countError, setCountError] = useState<string | null>(null)
  const counted = count.anyTyped ? count.total : null
  const difference = counted == null ? null : roundQuantity(counted - currentQuantity)
  // "= 164.2 kg" under boxes that aren't all the stock unit.
  const inStockUnits =
    counted != null && (count.boxes.length > 1 || !count.boxes[0].unit.isStockUnit) ? formatQuantity(counted, stockUnit) : null

  async function onSubmit(values: StockCountFormValues) {
    setFormError(null)
    setCountError(null)
    if (!count.anyTyped) return setCountError('Enter how much is on the shelf.')
    if (counted == null) return setCountError('Enter a number, 0 or greater, to 3 decimal places.')
    const countedQuantity = counted
    if (countedInWholeUnits && !Number.isInteger(countedQuantity)) {
      return setCountError(`That isn't a whole number of ${stockUnitWord(stockUnit, 2)}.`)
    }
    try {
      const outcome = await submitStockWrite({
        kind: 'COUNT',
        productId,
        productName,
        summary: formatQuantity(countedQuantity, stockUnit),
        payload: {
          countedQuantity,
          note: values.note || undefined,
          branchId: sheetBranch.branchId,
          areaId: sheetBranch.areaId,
          shortAs: shortChosen ?? undefined,
        },
      })
      sheetBranch.remember()
      if (outcome.status === 'sent') onSuccess(outcome.response)
      else {
        setQueuedSentence(formatQuantity(countedQuantity, stockUnit))
        setQueuedOpId(outcome.op.id)
      }
    } catch (err) {
      setFormError(isAppError(err) ? err.message : 'Something went wrong. Please try again.')
    }
  }

  if (queuedSentence) {
    return (
      <Sheet
        open
        onClose={() => (queuedOpId && onQueued ? onQueued(queuedOpId) : onClose())}
        title="Saved on this phone"
        size="sm"
        footer={<Button onClick={() => (queuedOpId && onQueued ? onQueued(queuedOpId) : onClose())}>Done</Button>}
      >
        <StockReceipt
          branchId={sheetBranch.branchId}
          state="recorded"
          kind="Count"
          id={queuedOpId}
          lines={[
            { label: 'Product', value: productName },
            { label: 'Counted', value: queuedSentence },
          ]}
        />
      </Sheet>
    )
  }

  return (
    <Sheet
      open
      onClose={onClose}
      // What and where before anything is typed (STOCK_SHEETS_AND_AREA_COUNT_PLAN.md Part 1). The line carries
      // what the app says is there, so the field's hint needn't say it again.
      title={`Count · ${productName}`}
      subtitle={sheetBranch.line(formatQuantity(currentQuantity, stockUnit))}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="action" onClick={handleSubmit(onSubmit)} loading={isSubmitting} disabled={sheetBranch.missing}>
            Record count
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {/* A line per unit, its box beside it; the other units wait below (owner, 2026-11-10). */}
        <fieldset aria-describedby={countError ? 'count-error' : lastCounted ? 'count-hint' : undefined}>
          <legend className="mb-1.5 text-sm font-medium text-neutral-700">How much is on the shelf now?</legend>
          <CountUnitLines
            count={count}
            productName={productName}
            stockSymbol={stockUnit}
            boxId={(index) => `count-box-${index}`}
            onBox={(index, text) => {
              setCountError(null)
              count.setText(index, text)
            }}
            boxProps={(index) => ({ autoFocus: index === 0 })}
          />
          {inStockUnits && <p className="mt-1.5 text-sm text-neutral-700" data-count-total>= {inStockUnits}</p>}
          {countError ? (
            <p id="count-error" role="alert" className="mt-1.5 text-xs text-danger-600">
              {countError}
            </p>
          ) : (
            lastCounted && (
              <p id="count-hint" className="mt-1.5 text-xs text-neutral-500">
                {lastCounted}.
              </p>
            )
          )}
        </fieldset>
        {/* The difference, before anything is recorded (C3, D1): set as a figure, because it is
            the thing a count is for. */}
        {difference != null && (
          <div role="status" className="flex items-baseline gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
            {difference === 0 ? (
              <span className="text-sm font-medium text-accent-700">Matches what the app says.</span>
            ) : (
              <>
                <StockFigure quantity={difference} unit={stockUnit} signed size="md" />
                <span className="text-sm text-neutral-600">vs what the app says</span>
              </>
            )}
          </div>
        )}
        {/* Moved here and not confirmed yet (Part 4): counted now, it would be counted again on confirming. */}
        {areaFigure?.waiting != null && areaFigure.waiting > 0 && (
          <p className="text-sm text-primary-800" data-count-waiting>
            {formatQuantity(areaFigure.waiting, stockUnit)} more {areaFigure.waiting === 1 ? 'is' : 'are'} waiting for you to
            confirm. Confirm {areaFigure.waiting === 1 ? 'it' : 'them'} first, so {areaFigure.waiting === 1 ? "it isn't" : "they aren't"}{' '}
            counted twice.
          </p>
        )}
        {area && (
          <CountShortfall
            area={area}
            shortAs={shortAs}
            short={difference != null && difference < 0 ? formatQuantity(-difference, stockUnit) : null}
            onChange={setShortChosen}
          />
        )}
        <div>
          <label htmlFor="count-note" className="mb-1.5 block text-sm font-medium text-neutral-700">
            Note <span className="font-normal text-neutral-500">(optional)</span>
          </label>
          <textarea
            id="count-note"
            rows={2}
            className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
            {...register('note')}
          />
          {errors.note?.message && <p className="mt-1.5 text-xs text-danger-600">{errors.note.message}</p>}
        </div>
        <FormError message={formError} />
      </form>
    </Sheet>
  )
}
