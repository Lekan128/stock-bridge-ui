import { Skeleton } from '@/components/Skeleton'

/** Mirrors the cart's line-list + summary-column layout so nothing shifts on load. */
export function CartSkeleton() {
  return (
    <div aria-hidden="true" className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
      <div className="rounded-lg border border-neutral-200 bg-white px-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex gap-4 border-b border-neutral-100 py-4 last:border-b-0">
            <Skeleton className="h-16 w-16 shrink-0 rounded-md sm:h-20 sm:w-20" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-8 w-28 rounded-md" />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 space-y-3 rounded-lg border border-neutral-200 bg-white p-4 lg:mt-0">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-11 w-full rounded-md" />
      </div>
    </div>
  )
}
