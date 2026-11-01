import type { ShortAs } from '@/features/branches/areas'
import type { Area } from '@/features/branches/types'

/**
 * The line a count sheet shows at a branch with areas (STOCK_AREAS_PART_3_5.md): what anything short will be
 * recorded as, before it's saved - "Anything short is recorded as used at the Kitchen." - and *Change*, for
 * this one count. A count that finds more is never "used", so the line only speaks of a shortfall.
 */
export function CountShortfall({
  area,
  shortAs,
  short,
  onChange,
}: {
  area: Area
  /** The choice for this count. */
  shortAs: ShortAs
  /** How much short the typed figure is, when it is; null before anything's typed or when it isn't short. */
  short: string | null
  onChange: (next: ShortAs) => void
}) {
  const what = shortAs === 'USED' ? `used at the ${area.name}` : `missing from the ${area.name}`
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-neutral-700" data-count-shortfall={shortAs}>
      <span>{short ? `${short} short: recorded as ${what}.` : `Anything short is recorded as ${what}.`}</span>
      <button
        type="button"
        onClick={() => onChange(shortAs === 'USED' ? 'MISSING' : 'USED')}
        className="-my-3 inline-flex min-h-11 items-center font-medium text-primary-700 hover:underline"
        aria-label={shortAs === 'USED' ? 'Change: record it as missing' : 'Change: record it as used'}
      >
        Change
      </button>
    </p>
  )
}
