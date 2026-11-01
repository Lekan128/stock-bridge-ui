import { useQueryClient } from '@tanstack/react-query'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { useApiQuery } from '@/data/useApiQuery'
import { hasAreas } from '@/features/branches/areas'
import { useOptionalWorkingBranch } from '@/features/branches/useWorkingBranch'
import { useWorkArea } from '@/features/branches/workArea'
import { profileApi } from '@/features/profile/api/profileApi'
import type { Profile } from '@/features/profile/types'
import { useSellingPolicy } from '@/features/selling/useSellingPolicy'

/** What quick mode can be doing: its buttons along the top. */
export type Mode = 'sell' | 'in' | 'out' | 'move' | 'count'

// The same names as everywhere else in the app (it said Receive and Issue, warehouse words a
// shopkeeper had to guess at), each with one line saying what it does — Count most of all.
export const MODES: { value: Mode; label: string; verb: string; meaning: string }[] = [
  // Only where the company records sales (useSellingPolicy) - and first there: it is the till.
  { value: 'sell', label: 'Sell', verb: 'Sold', meaning: 'Scan what the customer is buying, then record the sale in one go.' },
  { value: 'in', label: 'Stock in', verb: 'Stock in', meaning: 'Goods coming in, like a delivery or a return. Adds them to your stock.' },
  { value: 'out', label: 'Stock out', verb: 'Stock out', meaning: 'Goods going out: sold, used or sent away. Takes them off your stock.' },
  // At a branch with areas (STOCK_AREAS_PART_3.md): from one area to another, several items at once.
  { value: 'move', label: 'Move', verb: 'Moved', meaning: 'From one area to another, a few items at a time.' },
  {
    value: 'count',
    label: 'Count',
    verb: 'Counted',
    meaning: "Count what's on the shelf. The app's figure is corrected to match, and the difference goes into the history.",
  },
]

/** Quick mode has room for this many buttons (owner, 2026-11-01). */
export const MAX_QUICK_TABS = 4

/**
 * The app's own choice of buttons for where this person works - the ones they're allowed, in quick mode's usual
 * order. Most people never change it, so it has to be right, and it needn't fill every place:
 * - **No areas** (one shop): the till and the stock in front of them - Sell, Stock in, Stock out, Count.
 * - **Every area** (owners, managers): Sell, Stock in, Stock out, Move; Count stays a small link.
 * - **Where deliveries arrive** (a storekeeper): Stock in, Move, Count.
 * - **Another area** (a cook, a barman): Sell where the company sells, Stock out, Move (which asks the Store when
 *   they don't work in it), Count (the closing count).
 * Anything else they may do is theirs to add, on their profile.
 */
const USUAL: Record<'noAreas' | 'everywhere' | 'store' | 'area', Mode[]> = {
  noAreas: ['sell', 'in', 'out', 'count'],
  everywhere: ['sell', 'in', 'out', 'move'],
  store: ['in', 'move', 'count'],
  area: ['sell', 'out', 'move', 'count'],
}

export interface QuickModeTabs {
  /** The buttons along the top, in quick mode's order. */
  tabs: Mode[]
  /** Every button this person may have here: what their role and this branch allow. */
  available: Mode[]
  /** The app's own choice, from `available`. */
  usual: Mode[]
  /** Their own choice, as saved on their account; null when they haven't made one. */
  chosen: Mode[] | null
  /** At a branch with areas, where this person takes stock from: Move is possible. */
  movesHere: boolean
  /**
   * Their account and branch are known (from the phone's copy, or just loaded): until then the buttons would be a
   * guess, so quick mode waits rather than flash the usual ones and swap.
   */
  ready: boolean
  /** Save a choice on their account (null: back to the usual ones). */
  save: (tabs: Mode[] | null) => Promise<Profile>
}

/**
 * Quick mode's buttons (owner, 2026-11-01): the person's own choice of up to four, kept on their account, else
 * the app's for where they work - and never a button their role doesn't give them. A choice left with none they
 * may use falls back to the usual ones. The account is read through the cache, so quick mode opens offline too.
 */
export function useQuickModeTabs(): QuickModeTabs {
  const { user } = useAuth()
  const permissions = user?.type === 'tenant' ? user.permissions : []
  const { recordsSales } = useSellingPolicy()
  const branch = useOptionalWorkingBranch()
  const working = branch && !branch.isAll ? branch.working : null
  const work = useWorkArea(working)
  const movesHere = permissions.includes(PERMISSIONS.STOCK_OUT) && hasAreas(working) && work.areas.length > 0
  const allowed: Record<Mode, boolean> = {
    sell: recordsSales && permissions.includes(PERMISSIONS.STOCK_OUT),
    in: permissions.includes(PERMISSIONS.STOCK_IN),
    out: permissions.includes(PERMISSIONS.STOCK_OUT),
    move: movesHere,
    count: permissions.includes(PERMISSIONS.MANAGE_INVENTORY),
  }
  const available = MODES.map((mode) => mode.value).filter((mode) => allowed[mode])
  const place = !movesHere
    ? 'noAreas'
    : !work.limited
      ? 'everywhere'
      : work.areas.some((area) => area.delivery)
        ? 'store'
        : 'area'
  const usualHere = available.filter((mode) => USUAL[place].includes(mode))
  // Nothing of the usual set allowed (an unusual role): whatever they may do, up to four.
  const usual = usualHere.length > 0 ? usualHere : available.slice(0, MAX_QUICK_TABS)

  const queryClient = useQueryClient()
  const me = useApiQuery({
    queryKey: ['me'],
    queryFn: () => profileApi.get(),
    fallbackError: "Couldn't load your account.",
    enabled: user?.type === 'tenant',
  })
  const ready = (me.data != null || me.error != null || user?.type !== 'tenant') && !(branch?.loading ?? false)
  const saved = me.data?.quickModeTabs
  const chosen = saved == null || saved.length === 0 ? null : (saved.filter((mode) => mode in allowed) as Mode[])
  const chosenHere = chosen?.filter((mode) => allowed[mode]) ?? []
  const tabs = chosenHere.length > 0 ? available.filter((mode) => chosenHere.includes(mode)) : usual

  return {
    tabs,
    available,
    usual,
    chosen,
    movesHere,
    ready,
    save: async (next) => {
      const profile = await profileApi.setQuickModeTabs(next)
      queryClient.setQueryData(['me'], profile)
      return profile
    },
  }
}
