import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { Sheet } from '@/components/Sheet'
import { TextField } from '@/components/TextField'
import { QueuedReceipt } from '@/features/outbox/QueuedReceipt'
import { submitStockWrite } from '@/features/outbox/outboxStore'
import { stockCountSchema, type StockCountFormValues } from '@/features/products/schemas'
import type { StockMutationResponse } from '@/features/products/types'
import { formatQuantity } from '@/features/products/unitCopy'
import { isAppError } from '@/types/api'

export interface StockAdjustmentModalProps {
  productId: string
  productName: string
  currentQuantity: number
  /** The stock unit's short form ("kg"), for every figure on screen. */
  stockUnit: string
  onClose: () => void
  onSuccess: (result: StockMutationResponse) => void
  /** Saved on this phone instead of sent — the server could not be reached. */
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
  currentQuantity,
  stockUnit,
  onClose,
  onSuccess,
  onQueued,
}: StockAdjustmentModalProps) {
  const [formError, setFormError] = useState<string | null>(null)
  const [queuedSentence, setQueuedSentence] = useState<string | null>(null)
  const [queuedOpId, setQueuedOpId] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<StockCountFormValues>({
    resolver: zodResolver(stockCountSchema),
    defaultValues: { countedQuantity: '', note: '' },
  })

  const typed = watch('countedQuantity').trim()
  const counted = /^\d+$/.test(typed) ? Number(typed) : null
  const difference = counted == null ? null : counted - currentQuantity

  async function onSubmit(values: StockCountFormValues) {
    setFormError(null)
    const countedQuantity = Number(values.countedQuantity)
    try {
      const outcome = await submitStockWrite({
        kind: 'COUNT',
        productId,
        productName,
        summary: formatQuantity(countedQuantity, stockUnit),
        payload: { countedQuantity, note: values.note || undefined },
      })
      if (outcome.status === 'sent') onSuccess(outcome.response)
      else {
        setQueuedSentence(`A count of ${formatQuantity(countedQuantity, stockUnit)} for ${productName}.`)
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
        <QueuedReceipt sentence={queuedSentence} />
      </Sheet>
    )
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Count stock"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="action" onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
            Record count
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <TextField
          label={`How much is on the shelf now? (${stockUnit})`}
          inputMode="numeric"
          autoFocus
          error={errors.countedQuantity?.message}
          hint={`The books say ${formatQuantity(currentQuantity, stockUnit)}.`}
          {...register('countedQuantity')}
        />
        {difference != null && (
          <p
            role="status"
            className={`text-sm font-medium tabular-nums ${difference === 0 ? 'text-accent-700' : 'text-neutral-800'}`}
          >
            {difference === 0
              ? 'Matches the books.'
              : `${difference > 0 ? '+' : '−'}${formatQuantity(Math.abs(difference), stockUnit)} against the books.`}
          </p>
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
