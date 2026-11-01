import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApiQuery } from '@/data/useApiQuery'
import { movesApi } from '@/features/moves/movesApi'
import { MoveSheet } from '@/features/moves/MoveSheet'
import { useMoveSheet } from '@/features/moves/useMoveSheet'
import { requestsApi } from '@/features/requests/requestsApi'
import { RequestSheet } from '@/features/requests/RequestSheet'

/**
 * A move or a request opened from a link - the bell's "1 item from the Store to confirm" (Part 4), "The Kitchen
 * asked for 2 items" (Part 5) - on whatever page it lands: `?move=<id>` or `?request=<id>` opens it over the page,
 * and closing it takes the parameter away. A request this person can fill opens Move already filled.
 */
export function MoveFromLink() {
  const [params, setParams] = useSearchParams()
  const moveId = params.get('move')
  const requestId = params.get('request')
  const moveSheet = useMoveSheet()
  const move = useApiQuery({
    queryKey: ['area-moves', 'detail', moveId],
    queryFn: () => movesApi.get(moveId as string),
    fallbackError: "Couldn't open that move.",
    enabled: moveId != null,
    persist: false,
  })
  const request = useApiQuery({
    queryKey: ['stock-requests', 'detail', requestId],
    queryFn: () => requestsApi.get(requestId as string),
    fallbackError: "Couldn't open that request.",
    enabled: requestId != null,
    persist: false,
  })

  function close(name: 'move' | 'request') {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.delete(name)
        return next
      },
      { replace: true },
    )
  }

  // A request still to move, for someone who can: straight into Move, filled (the plan's "open → Move").
  const opened = useRef<string | null>(null)
  const asked = request.data && request.data.id === requestId ? request.data : null
  const toFill =
    asked != null &&
    asked.status === 'OPEN' &&
    asked.canFill &&
    asked.lines.some((line) => !line.noneInStore && line.moved < line.quantity)
  useEffect(() => {
    if (!toFill || !asked || opened.current === asked.id) return
    opened.current = asked.id
    moveSheet.openRequest(asked)
    close('request')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toFill, asked?.id])

  return (
    <>
      {moveId && move.data && move.data.id === moveId && (
        <MoveSheet key={move.data.id} move={move.data} onClose={() => close('move')} />
      )}
      {asked && !toFill && <RequestSheet key={asked.id} request={asked} onClose={() => close('request')} />}
      {moveSheet.sheet}
    </>
  )
}
