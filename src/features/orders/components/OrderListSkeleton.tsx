import { Skeleton } from '@/components/Skeleton'

/** Mirrors the real list's two layouts so nothing jumps when the data lands. */
export function OrderListSkeleton() {
  const rows = Array.from({ length: 5 })

  return (
    <>
      <div className="flex flex-col gap-2 md:hidden">
        {rows.map((_, i) => (
          <div key={i} className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="mt-3 h-3 w-40" />
            <div className="mt-3 flex gap-2">
              <Skeleton className="h-5 w-24 rounded-sm" />
              <Skeleton className="h-5 w-20 rounded-sm" />
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-neutral-200 bg-white md:block">
        {rows.map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-neutral-100 px-4 py-4 last:border-b-0">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="ml-auto h-4 w-24" />
            <Skeleton className="h-5 w-28 rounded-sm" />
            <Skeleton className="h-5 w-24 rounded-sm" />
          </div>
        ))}
      </div>
    </>
  )
}
