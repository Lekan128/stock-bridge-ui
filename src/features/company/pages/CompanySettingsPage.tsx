import { PERMISSIONS } from '@/auth/permissions'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { ErrorState } from '@/components/ErrorState'
import { CompanyAccountFacts } from '@/features/company/components/CompanyAccountFacts'
import { CompanyDetailsForm } from '@/features/company/components/CompanyDetailsForm'
import { CompanyDetailsReadOnly } from '@/features/company/components/CompanyDetailsReadOnly'
import { CompanySkeleton } from '@/features/company/components/CompanySkeleton'
import { useCompany } from '@/features/company/hooks/useCompany'
import { SellingSettingsSection } from '@/features/selling/components/SellingSettingsSection'

/**
 * Open to every authenticated tenant user, matching GET /api/company, which carries no
 * permission check at all.
 *
 * The route is therefore NOT wrapped in RequirePermission: hiding the page from a storekeeper
 * would contradict a backend that deliberately lets them read it, and would leave them with
 * nowhere to look up the Company ID they need to tell a new colleague. Only the *edit
 * affordance* is gated — on MANAGE_COMPANY_PROFILE, which V7 grants to OWNER alone — and the
 * gate is the same permission list every other guard in the app reads. As always this is UI
 * hygiene: the server rejects the PUT regardless.
 */
export function CompanySettingsPage() {
  const { user } = useAuth()
  const { company, setCompany, loading, error, refetch } = useCompany()

  const permissions = user?.type === 'tenant' ? user.permissions : []
  const canEdit = permissions.includes(PERMISSIONS.MANAGE_COMPANY_PROFILE)
  // The one branch word a one-branch company sees (MULTI_BRANCH_UX_PLAN.md rule 1).
  const canManageBranches = permissions.includes(PERMISSIONS.MANAGE_BRANCHES)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Company settings</h1>
        <p className="text-sm text-neutral-500">
          {canEdit
            ? "Your company's details as ProcurePal holds them."
            : "Your company's details as ProcurePal holds them. Only an account owner can change them."}
        </p>
      </div>

      {canManageBranches && (
        <Link
          to="/app/company/branches"
          className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3 hover:bg-neutral-50"
        >
          <span>
            <span className="block font-medium text-neutral-900">Branches</span>
            <span className="block text-sm text-neutral-600">Add a branch, or rename and close the ones you have.</span>
          </span>
          <span aria-hidden className="text-neutral-400">›</span>
        </Link>
      )}

      {loading && <CompanySkeleton />}

      {!loading && error && (
        <ErrorState title="Could not load your company" message={error} onRetry={refetch} />
      )}

      {!loading && !error && company && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            {canEdit ? (
              <CompanyDetailsForm company={company} onUpdated={setCompany} />
            ) : (
              <CompanyDetailsReadOnly company={company} />
            )}
            <SellingSettingsSection />
          </div>
          <CompanyAccountFacts company={company} />
        </div>
      )}
    </div>
  )
}
