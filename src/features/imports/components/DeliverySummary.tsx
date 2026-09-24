import { Truck } from 'lucide-react'
import type { ImportDeliveryDetails } from '@/features/imports/types'

/**
 * One line under the review title: the delivery details asked once on the upload screen
 * (`BULK_IMPORT_CX_PLAN.md` task 1.5), so the person checking the rows can see what every blank
 * cell is about to be filled with.
 */
export function DeliverySummary({ delivery }: { delivery: ImportDeliveryDetails | null | undefined }) {
  if (delivery == null) return null
  const parts: string[] = []
  if (delivery.date) parts.push(`Arrived ${formatDay(delivery.date)}`)
  if (delivery.invoiceNo) parts.push(`Invoice ${delivery.invoiceNo}`)
  if (delivery.supplierName) parts.push(`From ${delivery.supplierName}`)
  if (parts.length === 0) return null

  return (
    <p className="flex items-center gap-2 text-sm text-neutral-600">
      <Truck className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
      <span>{parts.join(' · ')}</span>
    </p>
  )
}

/** `2026-09-15` → "15 Sep 2026", read as a calendar day rather than a moment in UTC. */
function formatDay(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  if (!year || !month || !day) return isoDate
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
