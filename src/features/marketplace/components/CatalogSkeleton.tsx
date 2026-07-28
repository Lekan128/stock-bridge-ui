import { Skeleton } from '@/components/Skeleton'

/** Shaped like the catalog rows it replaces, so the page does not reflow when products arrive. */
export function CatalogSkeleton({ desktop }: { desktop: boolean }) {
  const rows = Array.from({ length: 8 })

  if (!desktop) {
    return (
      <div className="flex flex-col gap-2">
        {rows.map((_, index) => (
          <div key={index} className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-3">
            <div className="flex gap-3">
              <Skeleton className="h-12 w-12 shrink-0 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <Skeleton className="h-16 w-full rounded-md" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      {rows.map((_, index) => (
        <div key={index} className="flex items-center gap-4 border-b border-neutral-100 px-4 py-3.5 last:border-b-0">
          <Skeleton className="h-4 w-4 shrink-0 rounded" />
          <Skeleton className="h-10 w-10 shrink-0 rounded-md" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="ml-auto h-4 w-24" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-6 w-11 rounded-full" />
          <Skeleton className="h-7 w-16 rounded-md" />
        </div>
      ))}
    </div>
  )
}
