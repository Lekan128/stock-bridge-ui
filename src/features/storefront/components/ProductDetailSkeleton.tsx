import { Skeleton } from '@/components/Skeleton'

/** Matches the two-column product detail layout so nothing jumps when the data arrives. */
export function StorefrontProductSkeleton() {
  return (
    <div aria-hidden="true">
      <Skeleton className="h-4 w-64" />
      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <Skeleton className="aspect-square w-full rounded-lg" />
        <div className="space-y-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-7 w-1/2" />
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-4 w-32" />
          <div className="space-y-2 pt-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-12 w-full rounded-md" />
        </div>
      </div>
    </div>
  )
}
