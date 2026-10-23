import type { Product } from '@/features/products/types'
import type { Branch, BranchFigure } from '@/features/branches/types'

/**
 * The product as one branch holds it (MULTI_BRANCH_UX_PLAN.md §5.9): its figure, level and status at
 * the working branch, so the hero, the bar and the count sheet's "books say" all read that branch
 * without knowing branches exist. In "All branches", or at a one-branch company, the product as it is.
 */
export function scopeProduct(product: Product, working: Branch | null): Product {
  const figure = working ? product.branchStock?.find((entry) => entry.branchId === working.id) : undefined
  if (!figure) return product
  return {
    ...product,
    quantityOnHand: figure.quantityOnHand,
    lowStockThreshold: figure.lowStockThreshold ?? null,
    isLowStock: figure.isLowStock,
  }
}

/**
 * A stock write answers with the company's figure and no per-branch list. Until the product is read
 * again, keep the list and move the branch the write was made at by the same amount.
 */
export function carryBranchStock(previous: Product | null | undefined, changed: Product, branchId: string | null): Product {
  if (changed.branchStock != null || previous?.branchStock == null) return changed
  const delta = changed.quantityOnHand - previous.quantityOnHand
  const branchStock: BranchFigure[] = previous.branchStock.map((entry) =>
    entry.branchId === branchId ? { ...entry, quantityOnHand: entry.quantityOnHand + delta } : entry,
  )
  return { ...changed, branchStock }
}
