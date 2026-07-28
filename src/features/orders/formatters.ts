const dateTimeFormatter = new Intl.DateTimeFormat('en-NG', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const dateFormatter = new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium' })

/** `2026-07-26T09:12:00Z` → `26 Jul 2026, 09:12`. Undefined renders as an em dash, never "Invalid Date". */
export function formatOrderDateTime(value: string | undefined): string {
  if (!value) return '—'
  return dateTimeFormatter.format(new Date(value))
}

export function formatOrderDate(value: string | undefined): string {
  if (!value) return '—'
  return dateFormatter.format(new Date(value))
}

/** "2 items" / "1 item" — the list row's item count, which is a sum of line quantities. */
export function formatItemCount(count: number): string {
  return `${count} item${count === 1 ? '' : 's'}`
}
