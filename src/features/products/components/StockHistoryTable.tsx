import { Badge, type BadgeVariant } from '@/components/Badge'
import { Pagination } from '@/components/Pagination'
import { Skeleton } from '@/components/Skeleton'
import { useAuth } from '@/auth/useAuth'
import { formatCurrency, formatDateTime } from '@/features/products/formatters'
import type { MovementType, PageResponse, StockMovement } from '@/features/products/types'

const movementLabels: Record<MovementType, string> = { IN: 'Stock in', OUT: 'Stock out', ADJUSTMENT: 'Adjustment' }
const movementVariants: Record<MovementType, BadgeVariant> = { IN: 'success', OUT: 'danger', ADJUSTMENT: 'neutral' }

function formatQuantity(movement: StockMovement): string {
  if (movement.movementType === 'OUT') return `-${movement.quantity}`
  if (movement.movementType === 'IN') return `+${movement.quantity}`
  return movement.quantity > 0 ? `+${movement.quantity}` : String(movement.quantity)
}

export interface StockHistoryTableProps {
  data: PageResponse<StockMovement> | null
  loading: boolean
  error: string | null
  page: number
  onPageChange: (page: number) => void
}

export function StockHistoryTable({ data, loading, error, page, onPageChange }: StockHistoryTableProps) {
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
                <td className="border-b border-neutral-100 px-4 py-2.5 text-right font-medium text-neutral-900">
                  {formatQuantity(movement)}
                  {movement.unitPriceAtTime != null && (
                    <span className="ml-1 font-normal text-neutral-400">@ {formatCurrency(movement.unitPriceAtTime)}</span>
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
