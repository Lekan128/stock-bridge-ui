import { Badge, type BadgeVariant } from '@/components/Badge'
import { Pagination } from '@/components/Pagination'
import { Skeleton } from '@/components/Skeleton'
import { useAuth } from '@/auth/useAuth'
import { formatCurrency, formatDateTime } from '@/features/products/formatters'
import type { MovementType, PageResponse, StockMovement, UnitOfMeasureOption } from '@/features/products/types'
import { formatEnteredAndBase, formatPricePerOption } from '@/features/products/unitCopy'
import { buildPackOption } from '@/features/products/unitSet'
import { StockFigure } from '@/features/products/components/StockFigure'

const movementLabels: Record<MovementType, string> = { IN: 'Stock in', OUT: 'Stock out', ADJUSTMENT: 'Adjustment' }
const movementVariants: Record<MovementType, BadgeVariant> = { IN: 'success', OUT: 'danger', ADJUSTMENT: 'neutral' }

/** The movement as a signed change in stock units: a stock-out is always a fall. */
function signedQuantity(movement: StockMovement): number {
  if (movement.movementType === 'OUT') return -Math.abs(movement.quantity)
  if (movement.movementType === 'IN') return Math.abs(movement.quantity)
  return movement.quantity
}

/**
 * The one-off-pack echo `UNIT_UX_CONTRACT.md` §7 non-negotiable 3 requires and the ledger was
 * silently dropping — see `StockMovementResponse`'s V21 javadoc for the backend half of this fix.
 * A delivery entered as "10 bags" with "make this the usual pack" left unticked never becomes a
 * `ProductVendorPack`, so this row is the ONLY place that fact survives; without it, "10 bags of
 * 30 g" and "300 g typed straight in the stock unit" become indistinguishable the moment the
 * modal closes. Built from the movement's own `packagingUnit`/`packagingSize` snapshot rather
 * than the product's current unit set, because a delivery from six months ago must keep reading
 * the pack it actually arrived in even if the product's packaging has since changed.
 */
function enteredPackEcho(
  movement: StockMovement,
  stockUnit: string,
  unitOfMeasureOptions: UnitOfMeasureOption[],
): string | null {
  if (movement.enteredQuantity == null || movement.packagingUnit == null) return null
  const option = buildPackOption(movement, stockUnit, unitOfMeasureOptions)
  if (!option) return null
  const quantityEcho = formatEnteredAndBase(movement.enteredQuantity, option, movement.quantity, stockUnit)
  const priceEcho = movement.enteredUnitPrice != null ? formatPricePerOption(movement.enteredUnitPrice, option) : null
  return priceEcho ? `${quantityEcho} · ${priceEcho}` : quantityEcho
}

export interface StockHistoryTableProps {
  data: PageResponse<StockMovement> | null
  loading: boolean
  error: string | null
  page: number
  onPageChange: (page: number) => void
  /** The product's stock unit and the unit-of-measure catalog, needed only to echo a delivery's
   *  one-off pack (see {@link enteredPackEcho}) — every other column is unit-agnostic. */
  stockUnit: string
  unitOfMeasureOptions: UnitOfMeasureOption[]
}

export function StockHistoryTable({
  data,
  loading,
  error,
  page,
  onPageChange,
  stockUnit,
  unitOfMeasureOptions,
}: StockHistoryTableProps) {
  const { user } = useAuth()

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return <div className="rounded-md border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
  }

  if (!data || data.content.length === 0) {
    return <p className="py-6 text-center text-sm text-neutral-500">No stock movements yet.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th scope="col" className="border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 text-left text-xs font-medium text-neutral-500">
                Type
              </th>
              <th scope="col" className="border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 text-right text-xs font-medium text-neutral-500">
                Quantity
              </th>
              <th scope="col" className="border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 text-left text-xs font-medium text-neutral-500">
                Note
              </th>
              <th scope="col" className="border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 text-left text-xs font-medium text-neutral-500">
                Who
              </th>
              <th scope="col" className="border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 text-left text-xs font-medium text-neutral-500">
                When
              </th>
            </tr>
          </thead>
          <tbody>
            {data.content.map((movement) => (
              <tr key={movement.id}>
                <td className="border-b border-neutral-100 px-4 py-2.5">
                  <Badge variant={movementVariants[movement.movementType]}>{movementLabels[movement.movementType]}</Badge>
                </td>
                <td className="border-b border-neutral-100 px-4 py-2.5 text-right">
                  {/* The same figure as everywhere else (B2), as a change: "+400 kg", "−100 kg",
                      with the pack it arrived in under it when it came in one. */}
                  <StockFigure
                    quantity={signedQuantity(movement)}
                    unit={stockUnit}
                    pack={enteredPackEcho(movement, stockUnit, unitOfMeasureOptions)}
                    signed
                    align="end"
                  />
                  {movement.unitPriceAtTime != null && (
                    <span className="mt-0.5 block text-xs tabular-nums text-neutral-500">
                      @ {formatCurrency(movement.unitPriceAtTime)}
                    </span>
                  )}
                </td>
                <td className="max-w-xs truncate border-b border-neutral-100 px-4 py-2.5 text-neutral-600">
                  {movement.note || '—'}
                </td>
                <td className="border-b border-neutral-100 px-4 py-2.5 text-neutral-600">
                  {movement.createdByUserId
                    ? movement.createdByUserId === user?.id
                      ? 'You'
                      : `User ${movement.createdByUserId.slice(0, 8)}`
                    : '—'}
                </td>
                <td className="border-b border-neutral-100 px-4 py-2.5 whitespace-nowrap text-neutral-600">
                  {formatDateTime(movement.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={data.totalPages} onPageChange={onPageChange} />
    </div>
  )
}
