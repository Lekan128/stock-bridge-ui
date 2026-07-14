import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { formatCompactCurrency } from '@/components/analytics/formatters'
import { ClientStatusBadge } from '@/features/admin/components/ClientStatusBadge'
import type { TenantBreakdownEntry } from '@/features/admin/types'

type SortField = 'clientName' | 'activeUserCount' | 'activeProductCount' | 'stockInValue' | 'stockOutValue'
type SortDirection = 'asc' | 'desc'

export interface TenantBreakdownTableProps {
  entries: TenantBreakdownEntry[]
  onRowClick: (entry: TenantBreakdownEntry) => void
}

const columns: { field: SortField; label: string; align?: 'right' }[] = [
  { field: 'clientName', label: 'Client' },
  { field: 'activeUserCount', label: 'Active Users', align: 'right' },
  { field: 'activeProductCount', label: 'Active Products', align: 'right' },
  { field: 'stockInValue', label: 'Stock In Value', align: 'right' },
  { field: 'stockOutValue', label: 'Stock Out Value', align: 'right' },
]

export function TenantBreakdownTable({ entries, onRowClick }: TenantBreakdownTableProps) {
  const [sort, setSort] = useState<{ field: SortField; direction: SortDirection }>({
    field: 'stockInValue',
    direction: 'desc',
  })

  const sorted = useMemo(() => {
    const copy = [...entries]
    copy.sort((a, b) => {
      const aValue = a[sort.field]
      const bValue = b[sort.field]
      const compared = typeof aValue === 'string' ? aValue.localeCompare(bValue as string) : (aValue as number) - (bValue as number)
      return sort.direction === 'asc' ? compared : -compared
    })
    return copy
  }, [entries, sort])

  function handleSortChange(field: SortField) {
    setSort((prev) =>
      prev.field === field ? { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { field, direction: 'desc' },
    )
  }

  return (
    <table className="w-full border-separate border-spacing-0 text-sm">
      <thead>
        <tr>
          {columns.map((col) => (
            <th
              key={col.field}
              scope="col"
              className={`border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 text-xs font-medium text-neutral-500 ${
                col.align === 'right' ? 'text-right' : 'text-left'
              }`}
            >
              <button
                type="button"
                onClick={() => handleSortChange(col.field)}
                className={`inline-flex items-center gap-1 hover:text-neutral-700 ${col.align === 'right' ? 'flex-row-reverse' : ''}`}
              >
                {col.label}
                {sort.field === col.field ? (
                  sort.direction === 'asc' ? (
                    <ArrowUp className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowDown className="h-3.5 w-3.5" />
                  )
                ) : (
                  <ArrowUpDown className="h-3.5 w-3.5 text-neutral-300" />
                )}
              </button>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map((entry) => (
          <tr key={entry.clientId} onClick={() => onRowClick(entry)} className="cursor-pointer hover:bg-neutral-50">
            <td className="border-b border-neutral-100 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="font-medium text-neutral-900">{entry.clientName}</span>
                {!entry.active && <ClientStatusBadge active={false} />}
              </div>
            </td>
            <td className="border-b border-neutral-100 px-4 py-2.5 text-right text-neutral-700">{entry.activeUserCount}</td>
            <td className="border-b border-neutral-100 px-4 py-2.5 text-right text-neutral-700">{entry.activeProductCount}</td>
            <td className="border-b border-neutral-100 px-4 py-2.5 text-right text-neutral-700">
              {formatCompactCurrency(entry.stockInValue)}
            </td>
            <td className="border-b border-neutral-100 px-4 py-2.5 text-right text-neutral-700">
              {formatCompactCurrency(entry.stockOutValue)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
