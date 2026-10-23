import { Link } from 'react-router-dom'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { useOptionalWorkingBranch } from '@/features/branches/useWorkingBranch'
import type { Product } from '@/features/products/types'
import { formatQuantity } from '@/features/products/unitCopy'

/**
 * Under "Not enough in stock" (MULTI_BRANCH_UX_PLAN.md §5.4's insufficient-stock entry point): the
 * branch that has most of it, and - for someone who can send from there - "Send stock from Bolade",
 * pre-filled. Nothing at a one-branch company, or when no other branch the person sees has any.
 */
export function SendFromOtherBranch({ product, shortAt, unit }: { product: Product; shortAt: string | undefined; unit?: string }) {
  const branch = useOptionalWorkingBranch()
  const { user } = useAuth()
  // A sheet at the working branch names none itself; one in "All branches" names the one chosen.
  const at = shortAt ?? branch?.working?.id
  if (!branch?.isMultiBranch || !at || product.branchStock == null) return null
  const best = product.branchStock
    .filter((entry) => entry.branchId !== at && entry.quantityOnHand > 0)
    .sort((a, b) => b.quantityOnHand - a.quantityOnHand)[0]
  if (!best) return null
  const name = branch.nameOf(best.branchId) ?? 'Another branch'
  const maySend =
    user?.type === 'tenant' &&
    user.permissions.includes(PERMISSIONS.SEND_STOCK) &&
    branch.recordable.some((entry) => entry.id === best.branchId)
  return (
    <p className="mt-1 text-sm text-danger-700">
      {name} has {formatQuantity(best.quantityOnHand, unit)}.{' '}
      {maySend && (
        <Link
          to={`/app/transfers/send?product=${product.id}&from=${best.branchId}&to=${at}`}
          className="font-medium text-primary-700 underline-offset-2 hover:underline"
        >
          Send stock from {name}
        </Link>
      )}
    </p>
  )
}
