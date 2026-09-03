import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { Modal } from '@/components/Modal'
import { TextField } from '@/components/TextField'
import { productsApi } from '@/features/products/api/productsApi'
import { requestUnitOfMeasureSchema, type RequestUnitOfMeasureFormValues } from '@/features/products/schemas'
import { isAppError } from '@/types/api'

export interface RequestUnitOfMeasureModalProps {
  onClose: () => void
  /** Called after a successful 202. The caller shows the toast — this modal has no body to read back. */
  onSuccess: () => void
}

/**
 * The Amazon/Jumia "can't find your category? tell us" pattern, sized for a fixed list with
 * exactly one gap worth naming at a time: what unit, and why. Deliberately lightweight — this
 * posts an email to ProcurePaddy's support inbox, not a request that blocks the save the person
 * came here to make. A vendor or company who cannot find their unit picks the closest one (or
 * leaves it blank; the pair is optional) and keeps going.
 *
 * On failure the form is left exactly as typed — see `onSubmit` — because losing someone's
 * carefully-worded note on a transient network blip is a worse outcome than a visible retry.
 */
export function RequestUnitOfMeasureModal({ onClose, onSuccess }: RequestUnitOfMeasureModalProps) {
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RequestUnitOfMeasureFormValues>({
    resolver: zodResolver(requestUnitOfMeasureSchema),
    defaultValues: { requestedUnit: '', note: '' },
  })

  async function onSubmit(values: RequestUnitOfMeasureFormValues) {
    setFormError(null)
    try {
      await productsApi.requestUnitOfMeasure({
        requestedUnit: values.requestedUnit,
        note: values.note || undefined,
      })
      onSuccess()
    } catch (err) {
      setFormError(isAppError(err) ? err.message : 'Something went wrong. Please try again.')
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Request a new unit"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
            Send request
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <p className="text-sm text-neutral-500">
          Can&apos;t find the unit or packaging you need in the lists? Tell us and we&apos;ll consider adding it.
        </p>
        <TextField
          label="Unit you need"
          placeholder="e.g. Drum (200L), Pallet"
          error={errors.requestedUnit?.message}
          {...register('requestedUnit')}
        />
        <div>
          <label htmlFor="unit-request-note" className="mb-1.5 block text-sm font-medium text-neutral-700">
            Note <span className="font-normal text-neutral-400">(optional)</span>
          </label>
          <textarea
            id="unit-request-note"
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
