import { Store } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { describePaymentTerms, formatDate, formatPaymentTerms } from '@/features/company/formatters'
import type { Company } from '@/features/company/types'

/**
 * The four fields PUT /api/company reports but never accepts, plus the timestamps.
 *
 * Deliberately a facts panel rather than disabled inputs: a greyed-out text box reads as
 * "you personally may not edit this", which is wrong — nobody can change these here, by design.
 * The Company ID in particular is worth showing to everyone: it is what a colleague has to be
 * told before they can log in.
 */
export function CompanyAccountFacts({ company }: { company: Company }) {
  return (
    <div className="flex flex-col gap-5 rounded-lg border border-neutral-200 bg-white p-5">
      <div>
        <h2 className="text-base font-semibold text-neutral-900">Account</h2>
        <p className="mt-0.5 text-sm text-neutral-500">
          Set by ProcurePal. None of this can be changed from here — contact ProcurePal support if
          something is wrong.
        </p>
      </div>

      <div>
        <p className="text-xs text-neutral-500">Company ID</p>
        <p className="mt-0.5 font-mono text-sm font-medium break-all text-neutral-900">{company.clientIdentifier}</p>
        <p className="mt-1 text-xs text-neutral-500">
          Everyone at your company types this alongside their username to log in.
        </p>
      </div>

      <div>
        <p className="text-xs text-neutral-500">Payment terms</p>
        <p className="mt-1">
          <Badge variant={company.paymentTerms === 'PAY_ON_DELIVERY_ALLOWED' ? 'success' : 'neutral'}>
            {formatPaymentTerms(company.paymentTerms)}
          </Badge>
        </p>
        <p className="mt-1.5 text-xs text-neutral-500">{describePaymentTerms(company.paymentTerms)}</p>
      </div>

      <div>
        <p className="text-xs text-neutral-500">Status</p>
        <p className="mt-1">
          <Badge variant={company.active ? 'success' : 'danger'}>{company.active ? 'Active' : 'Suspended'}</Badge>
        </p>
      </div>

      {company.platformOwner && (
        <p className="flex items-start gap-2 rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-700">
          <Store className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>This company operates the ProcurePal marketplace.</span>
        </p>
      )}

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-neutral-500">Customer since</dt>
          <dd className="mt-0.5 text-sm font-medium text-neutral-900">{formatDate(company.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Last updated</dt>
          <dd className="mt-0.5 text-sm font-medium text-neutral-900">{formatDate(company.updatedAt)}</dd>
        </div>
      </dl>
    </div>
  )
}
