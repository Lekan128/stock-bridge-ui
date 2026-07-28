import { Lock } from 'lucide-react'
import type { Company } from '@/features/company/types'

/**
 * What a user without MANAGE_COMPANY_PROFILE sees in place of CompanyDetailsForm.
 *
 * Same three fields, same order, same labels — the page is deliberately not hidden from them
 * (the backend leaves GET /api/company ungated for exactly this reason), so the only difference
 * between the two versions should be whether the values are typeable.
 */
export function CompanyDetailsReadOnly({ company }: { company: Company }) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-5">
      <div>
        <h2 className="text-base font-semibold text-neutral-900">Company details</h2>
        <p className="mt-0.5 text-sm text-neutral-500">
          How your company is named on orders and invoices, and where ProcurePal sends account
          correspondence.
        </p>
      </div>

      <p className="flex items-start gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" aria-hidden="true" />
        <span>
          <span className="font-medium text-neutral-700">This is read-only for you.</span> Ask an
          account owner to change any of it.
        </span>
      </p>

      <dl className="flex flex-col gap-4">
        <Field label="Company name" value={company.name} />
        <Field label="Admin contact email" value={company.adminEmail} />
        <Field label="Phone" value={company.phone || '—'} />
      </dl>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="mb-1.5 text-sm font-medium text-neutral-700">{label}</dt>
      <dd className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm break-words text-neutral-900">
        {value}
      </dd>
    </div>
  )
}
