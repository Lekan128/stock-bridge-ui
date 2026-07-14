import { Skeleton } from '@/components/Skeleton'

export function ProductListSkeleton() {
  const rows = Array.from({ length: 6 })

  return (
    <>
      {/* Mobile cards */}
      <div className="flex flex-col gap-2 md:hidden">
        {rows.map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3">
            <Skeleton className="h-12 w-12 shrink-0 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-lg border border-neutral-200 bg-white md:block">
        {rows.map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-neutral-100 px-4 py-3 last:border-b-0">
            <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="ml-auto h-4 w-16" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-5 w-16 rounded-sm" />
          </div>
        ))}
      </div>
    </>
  )
}
