import { formatCount } from '@/features/imports/copy'
import type { ImportSessionSummary } from '@/features/imports/types'

const dateFormatter = new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium' })
const relativeFormatter = new Intl.RelativeTimeFormat('en-NG', { numeric: 'auto' })

/**
 * "2 days ago" for anything inside a fortnight, a real date beyond it. Recent-imports rows are
 * scanned, not read: "12 Jun" tells you nothing about whether it was this week.
 */
export function formatWhen(isoDate: string): string {
  const then = new Date(isoDate).getTime()
  if (Number.isNaN(then)) return ''
  const diffMs = then - Date.now()
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000))

  if (Math.abs(diffDays) > 14) return dateFormatter.format(new Date(isoDate))
  if (Math.abs(diffDays) >= 1) return relativeFormatter.format(diffDays, 'day')

  const diffHours = Math.round(diffMs / (60 * 60 * 1000))
  if (Math.abs(diffHours) >= 1) return relativeFormatter.format(diffHours, 'hour')

  const diffMinutes = Math.round(diffMs / (60 * 1000))
  return relativeFormatter.format(diffMinutes, 'minute')
}

/**
 * The one-line outcome on a recent-imports row.
 *
 * `summaryText` is composed server-side (contract §4), the same rule the preview and result
 * lines follow, so it is used verbatim whenever it is there. The local composition below is a
 * fallback for a server that has not filled it in yet — never the primary path, because a count
 * assembled on the client is exactly what that rule exists to prevent.
 */
export function summariseOutcome(entry: ImportSessionSummary): string {
  if (entry.summaryText) return entry.summaryText

  const parts: string[] = []
  if (entry.createdCount) parts.push(`${formatCount(entry.createdCount)} created`)
  if (entry.updatedCount) parts.push(`${formatCount(entry.updatedCount)} updated`)
  if (parts.length === 0) parts.push(`${formatCount(entry.rowCount)} rows`)
  return parts.join(' · ')
}
