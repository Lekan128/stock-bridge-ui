import { useCallback, useSyncExternalStore } from 'react'
import { useAuth } from '@/auth/useAuth'
import { hasAreas, stockAreas } from '@/features/branches/areas'
import type { Area, Branch } from '@/features/branches/types'

/**
 * Where a person is working inside a branch (STOCK_AREAS_PART_3.md, STOCK_AREAS_PLAN.md §4.2):
 *
 * - **All areas** (managers, procurement, the owner): nowhere in particular. Each sheet asks, pre-filled.
 * - **One area that keeps stock** (the cook): that area, fixed.
 * - **Several** (the barman in the Bar and at the front desk): the one this phone last chose for them,
 *   remembered per person and branch; none until they choose, from the top bar or the first sheet.
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
  /** Where this phone is for them: their only area, or the one chosen. Undefined: not chosen, or all areas. */
  area: Area | undefined
  /** Only one area: nothing to switch. */
  fixed: boolean
  /** Remember `areaId` as where this phone is, for this person at this branch. */
  choose: (areaId: string) => void
}

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
  if (!limited) return { limited, areas, area: undefined, fixed: false, choose }
  const fixed = areas.length === 1
  const area = fixed ? areas[0] : areas.find((candidate) => candidate.id === chosenId)
  return { limited, areas, area, fixed, choose }
}
