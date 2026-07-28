import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { TextField } from '@/components/TextField'
import { useToast } from '@/components/useToast'
import { companyApi } from '@/features/company/api/companyApi'
import {
  companyDetailsDefaults,
  companyDetailsSchema,
  toUpdateCompanyPayload,
  type CompanyDetailsFormValues,
} from '@/features/company/schemas'
import type { Company } from '@/features/company/types'
import { isAppError } from '@/types/api'
import { applyBackendFieldErrors } from '@/utils/backendFieldErrors'

export interface CompanyDetailsFormProps {
  company: Company
  onUpdated: (company: Company) => void
}

const FIELD_KEYS = ['name', 'adminEmail', 'phone'] as const

/** Rendered only for a user holding MANAGE_COMPANY_PROFILE — see CompanySettingsPage. */
export function CompanyDetailsForm({ company, onUpdated }: CompanyDetailsFormProps) {
  const { showToast } = useToast()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CompanyDetailsFormValues>({
    resolver: zodResolver(companyDetailsSchema),
    defaultValues: companyDetailsDefaults(company),
  })

  async function onSubmit(values: CompanyDetailsFormValues) {
    setFormError(null)
    try {
      // PUT /api/company replaces the record — all three fields go on every submit.
      const updated = await companyApi.update(toUpdateCompanyPayload(values))
      onUpdated(updated)
      reset(companyDetailsDefaults(updated))
      showToast('Company details updated.', 'success')
    } catch (err) {
      if (isAppError(err) && err.status === 400) {
        setFormError(applyBackendFieldErrors<CompanyDetailsFormValues>(err.message, FIELD_KEYS, setError))
        return
      }
      setFormError(isAppError(err) ? err.message : 'Something went wrong. Please try again.')
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-5"
    >
      <div>
        <h2 className="text-base font-semibold text-neutral-900">Company details</h2>
        <p className="mt-0.5 text-sm text-neutral-500">
          How your company is named on orders and invoices, and where ProcurePal sends account
          correspondence.
        </p>
      </div>

      <TextField
        label="Company name"
        hint="Shown on your orders, invoices and delivery notes."
        error={errors.name?.message}
        {...register('name')}
      />
      <TextField
        label="Admin contact email"
        type="email"
        hint="ProcurePal sends account and billing correspondence here. It is not a login."
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

      <FormError message={formError} />

      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting}>
          Save changes
        </Button>
      </div>
    </form>
  )
}
