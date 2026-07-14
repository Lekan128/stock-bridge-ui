import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { Modal } from '@/components/Modal'
import { TextField } from '@/components/TextField'
import { stockApi } from '@/features/products/api/stockApi'
import { makeStockQuantitySchema, type StockQuantityFormValues } from '@/features/products/schemas'
import type { StockMutationResponse } from '@/features/products/types'
import { isAppError } from '@/types/api'

export interface StockQuantityModalProps {
  direction: 'in' | 'out'
  productId: string
  currentQuantity: number
  onClose: () => void
  onSuccess: (result: StockMutationResponse) => void
}

export function StockQuantityModal({ direction, productId, currentQuantity, onClose, onSuccess }: StockQuantityModalProps) {
  const schema = makeStockQuantitySchema(direction === 'out' ? currentQuantity : undefined)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<StockQuantityFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { quantity: '', unitPrice: '', note: '' },
  })

  async function onSubmit(values: StockQuantityFormValues) {
    setFormError(null)
    const payload = {
      quantity: Number(values.quantity),
      unitPrice: values.unitPrice ? Number(values.unitPrice) : undefined,
      note: values.note || undefined,
    }
    try {
      const result =
        direction === 'in' ? await stockApi.stockIn(productId, payload) : await stockApi.stockOut(productId, payload)
      onSuccess(result)
    } catch (err) {
      setFormError(isAppError(err) ? err.message : 'Something went wrong. Please try again.')
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={direction === 'in' ? 'Stock in' : 'Stock out'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
            Confirm
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {direction === 'out' && (
          <p className="text-sm text-neutral-500">Current quantity on hand: {currentQuantity}</p>
        )}
        <TextField label="Quantity" inputMode="numeric" error={errors.quantity?.message} {...register('quantity')} />
        <TextField
          label="Unit price"
          inputMode="decimal"
          hint="Optional"
          error={errors.unitPrice?.message}
          {...register('unitPrice')}
        />
        <div>
          <label htmlFor="stock-note" className="mb-1.5 block text-sm font-medium text-neutral-700">
            Note
          </label>
          <textarea
            id="stock-note"
            rows={2}
            className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
            {...register('note')}
          />
          {errors.note?.message && <p className="mt-1.5 text-xs text-danger-600">{errors.note.message}</p>}
        </div>
        <FormError message={formError} />
      </form>
    </Modal>
  )
}
