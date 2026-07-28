import { Skeleton } from '@/components/Skeleton'

export interface CatalogGridSkeletonProps {
  count?: number
}

/**
 * Mirrors `ProductGridCard`'s layout exactly — image block, brand line, two-line title, price,
 * MOQ hint, button — so the grid does not reflow when the real data lands. A skeleton whose
 * shape differs from the content it replaces is worse than none.
 */
export function CatalogGridSkeleton({ count = 8 }: CatalogGridSkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <Skeleton className="aspect-[4/3] w-full rounded-none" />
          <div className="space-y-2 p-3 sm:p-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </div>
      ))}
    </div>
  )
}
