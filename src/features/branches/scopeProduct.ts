import type { Product } from '@/features/products/types'
import type { Branch, BranchFigure } from '@/features/branches/types'

/**
 * The product as one branch holds it (MULTI_BRANCH_UX_PLAN.md §5.9): its figure, level and status at
 * the working branch, so the hero, the bar and the count sheet's "books say" all read that branch
 * without knowing branches exist. In "All branches", or at a one-branch company, the product as it is.
 */
export function scopeProduct(product: Product, working: Branch | null): Product {
  if (product.branchStock == null) return product
  const figure = working ? product.branchStock.find((entry) => entry.branchId === working.id) : undefined
  if (!figure) {
    // "All branches": the company figure, and everything on the way between branches beside it.
    const onTheWay = working ? 0 : product.branchStock.reduce((sum, entry) => sum + (entry.onTheWay ?? 0), 0)
    return onTheWay > 0 ? { ...product, transferOnTheWay: onTheWay } : product
  }
  return {
    ...product,
    quantityOnHand: figure.quantityOnHand,
    lowStockThreshold: figure.lowStockThreshold ?? null,
    isLowStock: figure.isLowStock === true,
    transferOnTheWay: figure.onTheWay ?? 0,
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

/**
 * The product as the areas chosen in the top bar hold it (STOCK_AREAS_PART_3_6.md): their figures summed for
 * the headline - the breakdown under it still lists each - out when they hold none, never "low" until areas
 * have levels (Part 8). Unchanged for the whole branch, or without the product's area figures.
 */
export function scopeToAreas(product: Product, areaIds: string[] | undefined): Product {
  if (!areaIds || areaIds.length === 0 || product.areaStock == null) return product
  const quantity = product.areaStock
    .filter((figure) => areaIds.includes(figure.areaId))
    .reduce((sum, figure) => sum + figure.quantityOnHand, 0)
  return { ...product, quantityOnHand: quantity, isLowStock: false }
}
