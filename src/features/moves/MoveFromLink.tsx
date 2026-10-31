import { useSearchParams } from 'react-router-dom'
import { useApiQuery } from '@/data/useApiQuery'
import { movesApi } from '@/features/moves/movesApi'
import { MoveSheet } from '@/features/moves/MoveSheet'

/**
 * A move opened from a link - the bell's "2 items from the Store to confirm" (STOCK_AREAS_PART_4.md) - on
 * whatever page it lands: `?move=<id>` opens it over the page, and closing it takes the parameter away.
 */
export function MoveFromLink() {
  const [params, setParams] = useSearchParams()
  const moveId = params.get('move')
  const { data } = useApiQuery({
    queryKey: ['area-moves', 'detail', moveId],
    queryFn: () => movesApi.get(moveId as string),
    fallbackError: "Couldn't open that move.",
    enabled: moveId != null,
    persist: false,
  })
  if (!moveId || !data || data.id !== moveId) return null
  return (
    <MoveSheet
      key={data.id}
      move={data}
      onClose={() =>
        setParams(
          (current) => {
            const next = new URLSearchParams(current)
            next.delete('move')
            return next
          },
          { replace: true },
        )
      }
    />
  )
}
