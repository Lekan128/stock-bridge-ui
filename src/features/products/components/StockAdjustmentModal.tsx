import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { Modal } from '@/components/Modal'
import { TextField } from '@/components/TextField'
import { stockApi } from '@/features/products/api/stockApi'
import { stockAdjustmentSchema, type StockAdjustmentFormValues } from '@/features/products/schemas'
import type { StockMutationResponse } from '@/features/products/types'
import { isAppError } from '@/types/api'

export interface StockAdjustmentModalProps {
  productId: string
  currentQuantity: number
  onClose: () => void
  onSuccess: (result: StockMutationResponse) => void
}

export function StockAdjustmentModal({ productId, currentQuantity, onClose, onSuccess }: StockAdjustmentModalProps) {
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<StockAdjustmentFormValues>({
    resolver: zodResolver(stockAdjustmentSchema),
    defaultValues: { newQuantity: '', note: '' },
  })

  async function onSubmit(values: StockAdjustmentFormValues) {
    setFormError(null)
    try {
      const result = await stockApi.adjust(productId, { newQuantity: Number(values.newQuantity), note: values.note })
      onSuccess(result)
    } catch (err) {
      setFormError(isAppError(err) ? err.message : 'Something went wrong. Please try again.')
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Adjust quantity"
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
        <p className="text-sm text-neutral-500">Current quantity on hand: {currentQuantity}</p>
        <TextField
          label="New quantity"
          inputMode="numeric"
          error={errors.newQuantity?.message}
          {...register('newQuantity')}
        />
        <div>
          <label htmlFor="adjustment-note" className="mb-1.5 block text-sm font-medium text-neutral-700">
            Reason
          </label>
          <textarea
            id="adjustment-note"
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
