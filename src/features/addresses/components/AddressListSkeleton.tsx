import { Skeleton } from '@/components/Skeleton'

export function AddressListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-16 rounded-sm" />
          </div>
          <Skeleton className="mt-3 h-3.5 w-28" />
          <Skeleton className="mt-2 h-3.5 w-full" />
          <Skeleton className="mt-2 h-3.5 w-2/3" />
          <Skeleton className="mt-2 h-3.5 w-32" />
        </div>
      ))}
    </div>
  )
}
