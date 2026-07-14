const BAR_HEIGHTS = [45, 65, 35, 80, 55, 40, 70, 50, 60, 38, 72, 48]

export function ChartSkeleton() {
  return (
    <div className="flex h-64 items-end gap-2">
      {BAR_HEIGHTS.map((height, i) => (
        <div key={i} className="flex-1 animate-pulse rounded-md bg-neutral-200" style={{ height: `${height}%` }} />
      ))}
    </div>
  )
}
