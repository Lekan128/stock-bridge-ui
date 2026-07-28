import { Skeleton } from '@/components/Skeleton'

export function CompanySkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5 lg:col-span-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-5 w-32 rounded-sm" />
        <Skeleton className="h-5 w-24 rounded-sm" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  )
}
