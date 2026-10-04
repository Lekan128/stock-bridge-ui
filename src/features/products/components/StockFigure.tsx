import { usePendingStock } from '@/features/outbox/useOutbox'
import { formatNumber, stockUnitWord } from '@/features/products/unitCopy'

export type StockFigureSize = 'sm' | 'md' | 'lg'

export interface StockFigureProps {
  /** In stock units. */
  quantity: number
  /** The stock unit's symbol as the unit list gives it ("kg", "L", "Piece"). */
  unit: string
  /** The same figure restated in packs, already phrased: "= 20 bags". */
  pack?: string | null
  /** Show what this phone has recorded for the product and not yet sent, beside the figure. */
  productId?: string
  /** `sm` a list row, `md` a card or summary, `lg` the product's hero figure. */
  size?: StockFigureSize
  align?: 'start' | 'end'
  /** A movement rather than a balance: "+400", "−100". */
  signed?: boolean
  /** A word after the unit, set like it: "usable". */
  label?: string
}

const NUMBER_CLASS: Record<StockFigureSize, string> = {
  sm: 'text-sm font-semibold',
  md: 'text-xl font-semibold',
  lg: 'text-[40px] leading-none font-semibold tracking-tight',
}
const UNIT_CLASS: Record<StockFigureSize, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-lg',
}
const PACK_CLASS: Record<StockFigureSize, string> = {
  sm: 'text-xs',
  md: 'text-xs',
  lg: 'text-base font-medium text-neutral-700',
}

/**
 * A stock quantity, the one way it is shown everywhere (plan Track B, B2): the number in tabular
 * figures, its unit attached, the pack restatement under it ("= 20 bags"), and — when this phone
 * holds changes not yet sent — "+10 waiting" beside it, never added into it.
 *
 * Plan §2's first principle, "the number is the hero": the figure carries the weight, the unit and
 * the restatement recede. Nought is greyed rather than bolded — even with a delivery on the way,
 * the number anyone can act on today is still nought.
 */
export function StockFigure({
  quantity,
  unit,
  pack,
  productId,
  size = 'sm',
  align = 'start',
  signed = false,
  label,
}: StockFigureProps) {
  const empty = !signed && quantity <= 0
  const sign = signed ? (quantity > 0 ? '+' : quantity < 0 ? '−' : '') : ''
  const shown = signed ? Math.abs(quantity) : quantity
  return (
    <div className={`flex flex-col ${align === 'end' ? 'items-end text-right' : 'items-start'} ${size === 'lg' ? 'gap-1.5' : 'gap-0.5'}`}>
      <p className="flex flex-wrap items-baseline gap-x-1 tabular-nums" data-stock-figure>
        <span className={`${NUMBER_CLASS[size]} ${empty ? 'text-neutral-400' : 'text-neutral-900'}`}>
          {sign}
          {formatNumber(shown)}
        </span>
        <span className={`${UNIT_CLASS[size]} text-neutral-500`}>
          {stockUnitWord(unit, shown)}
          {label && ` ${label}`}
        </span>
      </p>
      {pack && <p className={`tabular-nums ${PACK_CLASS[size]} ${size === 'lg' ? '' : 'text-neutral-500'}`}>{pack}</p>}
      {productId && <PendingDelta productId={productId} unit={unit} size={size} />}
    </div>
  )
}

/** "+10 kg waiting" (A4): what this phone recorded and hasn't sent — beside the figure. */
function PendingDelta({ productId, unit, size }: { productId: string; unit: string; size: StockFigureSize }) {
  const pending = usePendingStock(productId)
  if (pending.waiting === 0) return null
  const what =
    pending.delta !== 0
      ? `${pending.delta > 0 ? '+' : '−'}${formatNumber(Math.abs(pending.delta))} ${stockUnitWord(unit, Math.abs(pending.delta))}`
      : pending.count
        ? 'a count'
        : `${pending.waiting} change${pending.waiting === 1 ? '' : 's'}`
  return (
    <p
      className={`tabular-nums font-medium ${size === 'lg' ? 'text-sm' : 'text-xs'} ${
        pending.needsAttention ? 'text-warning-700' : 'text-primary-700'
      }`}
      title="Recorded on this phone, not yet sent"
    >
      {what} {pending.needsAttention ? 'needs you' : 'waiting'}
    </p>
  )
}
