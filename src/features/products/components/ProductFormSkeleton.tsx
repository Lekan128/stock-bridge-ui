import { Skeleton } from '@/components/Skeleton'

export function ProductFormSkeleton() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-40 w-40 rounded-lg" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-20 w-full" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      <Skeleton className="h-10 w-full" />
    </div>
  )
}
