import { useOptionalWorkingBranch } from '@/features/branches/useWorkingBranch'
import { useWorkArea } from '@/features/branches/workArea'

/**
 * What the one Move button means for this person (Part 5, owner 2026-11-01): someone placed in areas away from
 * where deliveries arrive (a cook, a barman) mostly gets stock by asking, so it reads **Ask for stock** and opens
 * asking; everyone else carries it, so **Move stock**. Either way the panel can switch.
 */
export function useMoveIntent(): { intent: 'move' | 'ask'; label: string; short: string } {
  const branch = useOptionalWorkingBranch()
  const work = useWorkArea(branch && !branch.isAll ? branch.working : null)
  const asks = work.limited && work.areas.length > 0 && !work.areas.some((area) => area.delivery)
  return asks ? { intent: 'ask', label: 'Ask for stock', short: 'Ask' } : { intent: 'move', label: 'Move stock', short: 'Move' }
}
