const BAR_WIDTHS = [90, 75, 82, 60, 68, 50, 58, 40]

export function HorizontalBarsSkeleton() {
  return (
    <div className="flex flex-col justify-center gap-3 py-2" style={{ height: 320 }}>
      {BAR_WIDTHS.map((width, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-3 w-20 shrink-0 animate-pulse rounded-md bg-neutral-200" />
          <div className="h-5 animate-pulse rounded-md bg-neutral-200" style={{ width: `${width}%` }} />
        </div>
      ))}
    </div>
  )
}
