import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { Modal } from '@/components/Modal'
import { TextField } from '@/components/TextField'
import { superAdminApiClient } from '@/features/admin/api/superAdminApi'
import { PAYMENT_TERMS_OPTIONS } from '@/features/admin/formatters'
import {
  editClientDefaults,
  editClientSchema,
  toUpdateClientPayload,
  type EditClientFormValues,
} from '@/features/admin/schemas'
import type { SuperAdminClientDetail } from '@/features/admin/types'
import { isAppError } from '@/types/api'
import { applyBackendFieldErrors } from '@/utils/backendFieldErrors'

export interface EditClientModalProps {
  client: SuperAdminClientDetail
  onClose: () => void
  onSuccess: (client: SuperAdminClientDetail) => void
}

const FIELD_KEYS = ['name', 'adminEmail', 'phone', 'paymentTerms', 'slug'] as const

/**
 * Edits a tenant's `clients` row.
 *
 * Two things are deliberately absent. `active` is not here — suspension has its own button and
 * its own endpoint, so a routine profile save can never un-suspend a tenant. `platformOwner` is
 * not here either, and has no API anywhere: moving it would re-point the whole marketplace at a
 * different seller's inventory.
 *
 * The login identifier is behind an explicit opt-in rather than sitting in the field list. It is
 * a text input like any other, which is exactly the problem: renaming it means every user of the
 * company is told "unknown client" the next time they sign in, and every onboarding email and
 * password-manager entry recording the old one is wrong. Off by default, `slug` is omitted from
 * the request entirely and the backend leaves it alone.
 */
export function EditClientModal({ client, onClose, onSuccess }: EditClientModalProps) {
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    control,
    watch,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EditClientFormValues>({
    resolver: zodResolver(editClientSchema),
    defaultValues: editClientDefaults(client),
  })

  const renameSlug = watch('renameSlug')
  const nextSlug = watch('slug')

  async function onSubmit(values: EditClientFormValues) {
    setFormError(null)
    try {
      const updated = await superAdminApiClient.updateClient(client.id, toUpdateClientPayload(values))
      onSuccess(updated)
    } catch (err) {
      // A duplicate identifier is the one 409 this form can provoke, and it belongs on the field
      // that caused it. Guarded on `renameSlug` because that field is not rendered otherwise —
      // an error attached to a hidden input is an error nobody ever sees.
      if (isAppError(err) && err.status === 409 && values.renameSlug) {
        setError('slug', { message: err.message })
        return
      }
      if (isAppError(err) && err.status === 400) {
        setFormError(applyBackendFieldErrors<EditClientFormValues>(err.message, FIELD_KEYS, setError))
        return
      }
      setFormError(isAppError(err) ? err.message : 'Something went wrong. Please try again.')
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${client.name}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={renameSlug ? 'danger' : 'primary'}
            onClick={handleSubmit(onSubmit)}
            loading={isSubmitting}
          >
            {renameSlug ? 'Save and rename' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <TextField label="Company name" error={errors.name?.message} {...register('name')} />
        <TextField
          label="Admin contact email"
          type="email"
          hint="Where ProcurePal's account correspondence goes. Not a login."
          error={errors.adminEmail?.message}
          {...register('adminEmail')}
        />
        <TextField
          label="Phone"
          type="tel"
          hint="Optional. Any format — leave it empty to remove the number on file."
          error={errors.phone?.message}
          {...register('phone')}
        />

        <Controller
          control={control}
          name="paymentTerms"
          render={({ field }) => (
            <div>
              <span className="mb-1.5 block text-sm font-medium text-neutral-700">Payment terms</span>
              <p className="mb-2 text-xs text-neutral-500">
                A credit decision, not a preference — pay on delivery lets this customer take goods
                before paying for them.
              </p>
              <div role="radiogroup" aria-label="Payment terms" className="flex flex-col gap-1.5">
                {PAYMENT_TERMS_OPTIONS.map((option) => {
                  const selected = field.value === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => field.onChange(option.value)}
                      className={`rounded-md border px-3 py-2 text-left transition-colors ${
                        selected ? 'border-primary-300 bg-primary-50' : 'border-neutral-200 bg-white hover:bg-neutral-50'
                      }`}
                    >
                      <span className="block text-sm font-medium text-neutral-900">{option.label}</span>
                      <span className="mt-0.5 block text-xs text-neutral-500">{option.description}</span>
                    </button>
                  )
                })}
              </div>
              {errors.paymentTerms?.message && (
                <p role="alert" className="mt-1.5 text-xs text-danger-600">
                  {errors.paymentTerms.message}
                </p>
              )}
            </div>
          )}
        />

        <div className="border-t border-neutral-200 pt-4">
          <p className="text-sm font-medium text-neutral-700">Login identifier</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            Everyone at {client.name} types{' '}
            <span className="font-mono font-medium text-neutral-700">{client.slug}</span> alongside their
            username to sign in.
          </p>

          <Controller
            control={control}
            name="renameSlug"
            render={({ field }) => (
              <label className="mt-3 flex items-start gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded-sm border-neutral-300 text-primary-600 focus:ring-2 focus:ring-primary-100"
                />
                <span>Rename the login identifier</span>
              </label>
            )}
          />

          {renameSlug && (
            <div className="mt-3 flex flex-col gap-3">
              <p
                role="alert"
                className="flex items-start gap-2 rounded-md border border-warning-200 bg-warning-50 px-3 py-2 text-sm text-warning-700"
              >
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  <span className="font-medium">This changes how every user at {client.name} logs in.</span>{' '}
                  The moment it is saved, anyone signing in with{' '}
                  <span className="font-mono">{client.slug}</span> is told their company does not exist,
                  and every onboarding email, bookmark and password-manager entry recording it is wrong.
                  Tell them first. Renaming it back undoes this.
                </span>
              </p>
              <TextField
                label="New login identifier"
                hint="Lowercase letters, numbers and single hyphens. Somebody has to type this, so keep it short."
                error={errors.slug?.message}
                {...register('slug')}
              />
              {nextSlug && nextSlug !== client.slug && !errors.slug && (
                <p className="text-xs text-neutral-500">
                  Users will sign in with <span className="font-mono font-medium text-neutral-700">{nextSlug}</span>{' '}
                  instead of <span className="font-mono line-through">{client.slug}</span>.
                </p>
              )}
            </div>
          )}
        </div>

        <FormError message={formError} />
      </form>
    </Modal>
  )
}
