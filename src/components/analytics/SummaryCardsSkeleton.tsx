import { Skeleton } from '@/components/Skeleton'

export function SummaryCardsSkeleton({ count = 6 }: { count?: number }) {
  const cards = Array.from({ length: count })

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((_, i) => (
        <div key={i} className="rounded-lg border border-neutral-200 bg-white p-5">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="mt-3 h-7 w-20" />
          <Skeleton className="mt-2 h-3 w-32" />
        </div>
      ))}
    </div>
  )
}
