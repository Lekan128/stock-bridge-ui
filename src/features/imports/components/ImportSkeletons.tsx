import { Skeleton } from '@/components/Skeleton'

export function ImportReviewSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

export function ImportPreviewSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-10 w-40" />
    </div>
  )
}
