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

/**
 * The product's figure in each open area of `branch` that keeps stock, zeros left out, in the branch's
 * order. Someone placed in particular areas (Part 3, D-A10) sees only theirs, zero included: it's where
 * they are, and "Kitchen 0" is the answer they came for.
 */
export function areaBreakdown(product: Product, branch: Branch | null | undefined): { area: Area; quantity: number }[] {
  if (!hasAreas(branch) || product.areaStock == null) return []
  const held = new Map(product.areaStock.map((figure) => [figure.areaId, figure.quantityOnHand]))
  const limited = (branch?.areas ?? []).some((area) => area.active && area.worksHere === false)
  return stockAreas(branch)
    .filter((area) => !limited || area.worksHere !== false)
    .map((area) => ({ area, quantity: held.get(area.id) ?? 0 }))
    .filter((entry) => limited || entry.quantity !== 0)
}

/**
 * What's on its way into the branch's areas and not confirmed yet (Part 4): "2 waiting for Kitchen". In the
 * branch's figure, in no area's.
 */
export function areaWaiting(product: Product, branch: Branch | null | undefined): { area: Area; quantity: number }[] {
  if (!hasAreas(branch) || product.areaStock == null) return []
  const waiting = new Map(product.areaStock.map((figure) => [figure.areaId, figure.waiting ?? 0]))
  return stockAreas(branch)
    .map((area) => ({ area, quantity: waiting.get(area.id) ?? 0 }))
    .filter((entry) => entry.quantity > 0)
}

/** How many of the product one area holds, when the product says; undefined when it doesn't. */
export function figureInArea(product: Product, areaId: string | undefined): number | undefined {
  if (!areaId || product.areaStock == null) return undefined
  return product.areaStock.find((figure) => figure.areaId === areaId)?.quantityOnHand ?? 0
}

/**
 * What one place holds of the product (STOCK_SHEETS_AND_AREA_COUNT_PLAN.md Part 4): the area's figure, else
 * the branch's, else the product's own - so quick mode's search says the Kitchen's 12, not the branch's 42.
 * `carried` is false where the area has never had it ("Not in Kitchen"): the row stays, as it may be
 * arriving there for the first time.
 */
export function placeFigure(
  product: Product,
  place: { branchId?: string | null; areaId?: string | null },
): { quantity: number; carried: boolean } {
  if (place.areaId && product.areaStock != null) {
    const figure = product.areaStock.find((entry) => entry.areaId === place.areaId)
    if (!figure) return { quantity: 0, carried: false }
    return { quantity: figure.quantityOnHand, carried: figure.carried !== false || figure.quantityOnHand !== 0 }
  }
  const atBranch = place.branchId ? product.branchStock?.find((entry) => entry.branchId === place.branchId) : undefined
  return { quantity: atBranch ? atBranch.quantityOnHand : product.quantityOnHand, carried: true }
}

/**
 * What happens in an area (D-A12, STOCK_AREAS_PART_3_5.md), one question with three answers: stock is
 * **stored** there (counted; a shortfall is missing), **worked with** (counted; a shortfall is what was used),
 * or what it's given is **used up** (no figure).
 */
export type AreaKind = 'STORED' | 'WORKED' | 'USED_UP'

/**
 * The three answers in the words people use (owner, 2026-10-31: not "stored / worked with / used up", and
 * no examples beside them): `title` where it's chosen, `means` what it does, and `short` on the area's row.
 */
export const AREA_KINDS: Record<AreaKind, { title: string; short: string; means: string }> = {
  // Each title says it alone (owner, 2026-11-01: "the user does not have to read the description").
  STORED: {
    title: 'Stock is stored here',
    short: 'stock is stored here',
    means: 'If a count finds less, the rest is recorded as missing.',
  },
  WORKED: {
    title: 'Stock is used here, bit by bit',
    short: 'stock is used here bit by bit',
    means: 'If a count finds less, the rest is recorded as used, so nobody has to record each use.',
  },
  USED_UP: {
    title: 'Stock is used up as soon as it arrives',
    short: 'used up as soon as it arrives',
    means: "Nothing is counted here: what's moved here is recorded as used when it arrives.",
  },
}

/** The answers to "When stock is moved here" (Part 4), as Edit asks it and as a card says it. */
export const ARRIVING = { NOW: 'It arrives straight away', CONFIRM: 'Someone here confirms it' } as const

/** The three answers, in the order they're offered. */
export const AREA_KIND_ORDER: AreaKind[] = ['STORED', 'WORKED', 'USED_UP']

export function kindOf(area: Pick<Area, 'keepsStock' | 'shortIsUsed'>): AreaKind {
  return !area.keepsStock ? 'USED_UP' : area.shortIsUsed ? 'WORKED' : 'STORED'
}

/** The two flags the server keeps for an answer. */
export function kindFlags(kind: AreaKind): { keepsStock: boolean; shortIsUsed: boolean } {
  return { keepsStock: kind !== 'USED_UP', shortIsUsed: kind === 'WORKED' }
}

/**
 * A first answer for a new area, for the quick picks only (a typed name says nothing): the Kitchen, Bar, Shop
 * floor and Front desk work with stock, Housekeeping uses it up. Anything else starts as stored. Always shown,
 * and changed with one tap.
 */
export function suggestedKind(name: string): AreaKind {
  const key = name.trim().toLowerCase()
  if (['kitchen', 'bar', 'shop floor', 'front desk'].includes(key)) return 'WORKED'
  if (key === 'housekeeping') return 'USED_UP'
  return 'STORED'
}

/** What a count's shortfall is recorded as (Part 3.5). */
export type ShortAs = 'USED' | 'MISSING'

/** What the area says a shortfall is: used where stock is worked with (a kitchen), missing where it's stored. */
export function areaShortAs(area: Area): ShortAs {
  return area.shortIsUsed ? 'USED' : 'MISSING'
}

/** "Last counted today 18:05", "Last counted Tue 14:00", "Last counted 3 Oct", or nothing yet. */
export function lastCountedPhrase(iso: string | undefined): string | null {
  if (!iso) return null
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return null
  const time = at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  const days = Math.floor((startOfDay(new Date()) - startOfDay(at)) / 86_400_000)
  if (days <= 0) return `Last counted today ${time}`
  if (days === 1) return `Last counted yesterday ${time}`
  if (days < 7) return `Last counted ${at.toLocaleDateString(undefined, { weekday: 'short' })} ${time}`
  return `Last counted ${at.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}
