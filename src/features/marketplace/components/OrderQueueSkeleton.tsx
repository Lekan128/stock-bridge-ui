import { Skeleton } from '@/components/Skeleton'

/**
 * Loading placeholder shaped like the queue it replaces (following `ProductListSkeleton`), so the
 * page does not reflow when the rows arrive.
 */
export function OrderQueueSkeleton({ desktop }: { desktop: boolean }) {
  const rows = Array.from({ length: 8 })

  if (!desktop) {
    return (
      <div className="flex flex-col gap-2">
        {rows.map((_, index) => (
          <div key={index} className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-3 w-40" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-24 rounded-sm" />
              <Skeleton className="h-5 w-20 rounded-sm" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      {rows.map((_, index) => (
        <div key={index} className="flex items-center gap-4 border-b border-neutral-100 px-4 py-3.5 last:border-b-0">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="ml-auto h-4 w-10" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-24 rounded-sm" />
          <Skeleton className="h-5 w-20 rounded-sm" />
        </div>
      ))}
    </div>
  )
}
