import { useCallback, useMemo } from 'react'
import { useWorkingBranch } from '@/features/branches/useWorkingBranch'
import { useSellingSettings } from '@/features/selling/useSellingSettings'
import type { Branch } from '@/features/branches/types'
import type { BranchListPrice, Product } from '@/features/products/types'

/** The three price fields every price text reads. */
export type PriceFields = Pick<Product, 'unitPrice' | 'unitPriceEntered' | 'unitPriceEnteredUnit'>
type Priced = PriceFields & { branchPrices?: BranchListPrice[] }

const NO_PRICE: PriceFields = { unitPrice: null, unitPriceEntered: undefined, unitPriceEnteredUnit: undefined }

/**
 * A product's price in one branch's prices (BRANCH_PRICES_PLAN.md, V107; owner 2026-11-21): its row there, or no price
 * there yet. `listId` undefined is the one price every branch uses with the switch off.
 */
export function priceInList(product: Priced, listId: string | undefined): PriceFields {
  if (!listId) return { unitPrice: product.unitPrice, unitPriceEntered: product.unitPriceEntered, unitPriceEnteredUnit: product.unitPriceEnteredUnit }
  const own = product.branchPrices?.find((price) => price.priceListId === listId)
  if (!own) return NO_PRICE
  return { unitPrice: own.unitPrice, unitPriceEntered: own.unitPriceEntered ?? undefined, unitPriceEnteredUnit: own.unitPriceEnteredUnit ?? undefined }
}

/** One set of prices and the open branches that use it - branches sharing prices are one group. */
export interface PriceGroup {
  listId: string | undefined
  branches: Branch[]
}

/**
 * Prices per branch as every screen reads them. With "Each branch can have its own prices" off (or one branch) there
 * is one price, the product's, so nothing here changes a screen. On, every branch has prices of its own or shares
 * another branch's; no branch is special.
 */
export function useBranchPrices() {
  const settings = useSellingSettings()
  const { isMultiBranch, branches, working, isAll } = useWorkingBranch()
  const on = settings.data?.branchPrices === true && isMultiBranch

  const listOf = useCallback(
    (branchId: string | undefined): string | undefined =>
      on && branchId ? branches.find((branch) => branch.id === branchId)?.priceListId : undefined,
    [on, branches],
  )

  /** The open branches grouped by the prices they use, the main branch's group first. */
  const groups = useMemo((): PriceGroup[] => {
    const open = branches.filter((branch) => branch.active)
    if (!on) return [{ listId: undefined, branches: open }]
    const byList = new Map<string | undefined, Branch[]>()
    for (const branch of open) byList.set(branch.priceListId, [...(byList.get(branch.priceListId) ?? []), branch])
    return [...byList.entries()]
      .map(([listId, members]) => ({ listId, branches: [...members].sort((a, b) => Number(b.main) - Number(a.main)) }))
      .sort((a, b) => Number(b.branches[0]?.main ?? false) - Number(a.branches[0]?.main ?? false))
  }, [on, branches])

  /** The product priced where the person is working: that branch's price, or none there yet. "All branches": as is. */
  const atWorking = useCallback(
    <T extends Priced>(product: T): T => {
      if (!on || isAll || !working) return product
      return { ...product, ...priceInList(product, listOf(working.id)) }
    },
    [on, isAll, working, listOf],
  )

  /**
   * For "All branches": the lowest and highest price at the branches it's for, when they differ - "₦1,500 – ₦1,700".
   * Null when there's one price (or none), so the screen shows that one as before.
   */
  const range = useCallback(
    (product: Priced & { forAllBranches?: boolean; forBranchIds?: string[] }): [PriceFields, PriceFields] | null => {
      if (!on) return null
      const forBranch = (id: string) => product.forAllBranches !== false || (product.forBranchIds ?? []).includes(id)
      const prices = groups
        .filter((group) => group.branches.some((branch) => forBranch(branch.id)))
        .map((group) => priceInList(product, group.listId))
        .filter((price) => price.unitPrice != null)
        .sort((a, b) => (a.unitPrice as number) - (b.unitPrice as number))
      if (prices.length < 2 || prices[0].unitPrice === prices[prices.length - 1].unitPrice) return null
      return [prices[0], prices[prices.length - 1]]
    },
    [on, groups],
  )

  return { on, listOf, groups, atWorking, range, showingAll: isAll }
}
