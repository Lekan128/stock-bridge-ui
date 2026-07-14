import { Skeleton } from '@/components/Skeleton'

export function UserListSkeleton() {
  const rows = Array.from({ length: 4 })

  return (
    <>
      <div className="flex flex-col gap-2 md:hidden">
        {rows.map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-neutral-200 bg-white md:block">
        {rows.map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-neutral-100 px-4 py-3 last:border-b-0">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-16 rounded-sm" />
            <Skeleton className="h-5 w-16 rounded-sm" />
            <Skeleton className="ml-auto h-4 w-24" />
          </div>
        ))}
      </div>
    </>
  )
}
