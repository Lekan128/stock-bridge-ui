import { useCallback, useSyncExternalStore } from 'react'
import { useAuth } from '@/auth/useAuth'
import { hasAreas, stockAreas } from '@/features/branches/areas'
import type { Area, Branch } from '@/features/branches/types'
import { useOptionalWorkingBranch } from '@/features/branches/useWorkingBranch'
import type { Product } from '@/features/products/types'

/**
 * Where a person is inside a branch (STOCK_AREAS_PART_3.md, STOCK_AREAS_PART_3_6.md): the top bar's area
 * chooser, which - like the branch chooser - decides what the app shows and where it records.
 *
 * - **One area that keeps stock** (the cook): that area, fixed.
 * - **Several, or every area**: *All my areas* / *All areas* (the default), or one of them, remembered per
 *   person and branch on this phone. On *All…* each sheet asks which area; on one area it records there.
 *
 * Read from the branch list's `worksHere`, which the server works out from the database. The server checks
 * every write again, so this decides what the phone offers, never what is allowed.
 */

/** Some open area of the branch isn't theirs: they're placed in particular areas. */
export function isLimited(branch: Branch | null | undefined): boolean {
  return hasAreas(branch) && (branch?.areas ?? []).some((area) => area.active && area.worksHere === false)
}

/** The open areas of the branch that keep stock and that this person works in. */
export function myStockAreas(branch: Branch | null | undefined): Area[] {
  return stockAreas(branch).filter((area) => area.worksHere !== false)
}

/** Every open area they work in, stock-keeping or not - what their area line shows. */
export function myAreas(branch: Branch | null | undefined): Area[] {
  return (branch?.areas ?? []).filter((area) => area.active && area.worksHere !== false)
}

const CHANGED = 'pp-work-area-changed'

function key(userId: string, branchId: string) {
  return `pp.work-area.${userId}.${branchId}`
}

function read(storageKey: string | null): string | null {
  if (!storageKey) return null
  try {
    return window.localStorage.getItem(storageKey)
  } catch {
    return null
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGED, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(CHANGED, onChange)
    window.removeEventListener('storage', onChange)
  }
}

export interface WorkArea {
  /** Placed in particular areas at this branch. False: all areas, and nothing below applies. */
  limited: boolean
  /** The areas they can record in here (stock-keeping, theirs). */
  areas: Area[]
  /** Where this phone is for them: their only area, or the one chosen. Undefined: all of them. */
  area: Area | undefined
  /** Only one area: nothing to switch. */
  fixed: boolean
  /**
   * What the app shows (Part 3.6): the chosen area, or - for someone placed in areas, on *All my areas* - theirs;
   * undefined for the whole branch (no areas, or *All areas*).
   */
  viewAreaIds: string[] | undefined
  /** Remember `areaId` - or ALL_AREAS - as where this phone is, for this person at this branch. */
  choose: (areaId: string) => void
}

/** The chooser's "All my areas" / "All areas". */
export const ALL_AREAS = 'all'

export function useWorkArea(branch: Branch | null | undefined): WorkArea {
  const { user } = useAuth()
  const storageKey = user?.id && branch ? key(user.id, branch.id) : null
  const chosenId = useSyncExternalStore(subscribe, () => read(storageKey), () => null)
  const choose = useCallback(
    (areaId: string) => {
      if (!storageKey) return
      try {
        window.localStorage.setItem(storageKey, areaId)
      } catch {
        // Storage blocked: the phone asks again next time.
      }
      window.dispatchEvent(new Event(CHANGED))
    },
    [storageKey],
  )
  const limited = isLimited(branch)
  const areas = limited ? myStockAreas(branch) : stockAreas(branch)
  if (!hasAreas(branch) || areas.length === 0) {
    return { limited, areas, area: undefined, fixed: false, viewAreaIds: undefined, choose }
  }
  const fixed = limited && areas.length === 1
  const area = fixed ? areas[0] : areas.find((candidate) => candidate.id === chosenId)
  const viewAreaIds = area ? [area.id] : limited ? areas.map((candidate) => candidate.id) : undefined
  return { limited, areas, area, fixed, viewAreaIds, choose }
}

/**
 * In an area view (Part 3.6), whether a product is one the chosen areas have never had - the Inventory row
 * says "Not here" for it rather than "Out". False outside an area view, or without the product's area figures.
 */
export function useNotHere(): (product: Product) => boolean {
  const branch = useOptionalWorkingBranch()
  const viewAreaIds = useWorkArea(branch && !branch.isAll ? branch.working : null).viewAreaIds
  return (product) =>
    viewAreaIds != null &&
    product.areaStock != null &&
    !product.areaStock.some(
      (figure) => viewAreaIds.includes(figure.areaId) && (figure.carried !== false || figure.quantityOnHand !== 0),
    )
}
