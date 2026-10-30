import type { Area, Branch } from '@/features/branches/types'
import type { Product } from '@/features/products/types'

/**
 * Areas inside a branch (STOCK_AREAS_PLAN.md): the rules every screen reads them by, in one place.
 *
 * A branch "has areas" once it has had two (closed ones count, as on the server): its figures are then
 * per area. A sheet asks "Which area?" only where there is a choice - two or more open areas that keep
 * stock. Everything else shows no area word at all (rule 1).
 */

/** The branch has ever had more than its Store: its stock is counted per area. */
export function hasAreas(branch: Branch | null | undefined): boolean {
  return (branch?.areas?.length ?? 0) > 1
}

/** Open areas that keep stock, in the branch's order - what a sheet can record in. */
export function stockAreas(branch: Branch | null | undefined): Area[] {
  return (branch?.areas ?? []).filter((area) => area.active && area.keepsStock)
}

/** Where deliveries arrive: the sheet's choice when it has nothing better to go on. */
export function deliveryArea(branch: Branch | null | undefined): Area | undefined {
  return branch?.areas?.find((area) => area.delivery)
}

/** The product's figure in each open area of `branch` that keeps stock, zeros left out, in the branch's order. */
export function areaBreakdown(product: Product, branch: Branch | null | undefined): { area: Area; quantity: number }[] {
  if (!hasAreas(branch) || product.areaStock == null) return []
  const held = new Map(product.areaStock.map((figure) => [figure.areaId, figure.quantityOnHand]))
  return stockAreas(branch)
    .map((area) => ({ area, quantity: held.get(area.id) ?? 0 }))
    .filter((entry) => entry.quantity !== 0)
}

/** How many of the product one area holds, when the product says; undefined when it doesn't. */
export function figureInArea(product: Product, areaId: string | undefined): number | undefined {
  if (!areaId || product.areaStock == null) return undefined
  return product.areaStock.find((figure) => figure.areaId === areaId)?.quantityOnHand ?? 0
}
