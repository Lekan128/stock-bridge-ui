import { useApiQuery } from '@/data/useApiQuery'
import { useOptionalWorkingBranch } from '@/features/branches/useWorkingBranch'
import { movesApi } from '@/features/moves/movesApi'
import type { AreaMove } from '@/features/moves/types'
import { useOutboxState } from '@/features/outbox/useOutbox'

/** Often enough that a move made in the Store reaches the Kitchen's dashboard and quick mode in a minute. */
const EVERY_MINUTE = 60_000

/**
 * The moves waiting for this person to confirm (STOCK_AREAS_PART_4.md): to an area that confirms, that they
 * work in, at the branch they're at (every branch they see, in "All branches"). Only asked where some area
 * confirms. A confirmation still on this phone counts as done, so the move doesn't ask twice offline.
 */
export function useWaitingMoves(): { moves: AreaMove[]; loading: boolean } {
  const branch = useOptionalWorkingBranch()
  const here = branch && !branch.isAll ? branch.working : null
  const branches = here ? [here] : (branch?.branches ?? [])
  const someConfirm = branches.some((candidate) => candidate.areas?.some((area) => area.active && area.confirms))
  const { ops } = useOutboxState()
  const { data, loading } = useApiQuery({
    queryKey: ['area-moves', 'waiting', here?.id ?? 'all'],
    queryFn: () => movesApi.waiting(here?.id),
    fallbackError: "Couldn't load the moves waiting for you.",
    enabled: someConfirm,
    refetchInterval: EVERY_MINUTE,
    refetchOnWindowFocus: true,
  })
  const confirmedHere = new Set(ops.flatMap((op) => (op.kind === 'AREA_MOVE_CONFIRM' ? [op.moveId] : [])))
  return { moves: someConfirm ? (data ?? []).filter((move) => !confirmedHere.has(move.id)) : [], loading: someConfirm && loading }
}
