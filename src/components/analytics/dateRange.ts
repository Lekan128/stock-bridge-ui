import type { Granularity } from '@/components/analytics/types'

export type DateRangePreset = 'thisWeek' | 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'custom'

export interface DateRange {
  preset: DateRangePreset
  from: Date
  to: Date
}

export const PRESET_OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: 'thisWeek', label: 'This Week' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'thisQuarter', label: 'This Quarter' },
  { value: 'custom', label: 'Custom range' },
]

function startOfDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

function endOfDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(23, 59, 59, 999)
  return result
}

function startOfWeek(date: Date): Date {
  const result = startOfDay(date)
  const day = result.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  result.setDate(result.getDate() + diffToMonday)
  return result
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date: Date): Date {
  return endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0))
}

function startOfQuarter(date: Date): Date {
  const quarter = Math.floor(date.getMonth() / 3)
  return new Date(date.getFullYear(), quarter * 3, 1)
}

/** Resolves a non-custom preset to a concrete { from, to } pair, anchored to `now`. */
export function resolvePresetRange(preset: Exclude<DateRangePreset, 'custom'>, now = new Date()): { from: Date; to: Date } {
  switch (preset) {
    case 'thisWeek':
      return { from: startOfWeek(now), to: endOfDay(now) }
    case 'thisMonth':
      return { from: startOfMonth(now), to: endOfDay(now) }
    case 'lastMonth': {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) }
    }
    case 'thisQuarter':
      return { from: startOfQuarter(now), to: endOfDay(now) }
  }
}

export function defaultDateRange(): DateRange {
  return { preset: 'thisMonth', ...resolvePresetRange('thisMonth') }
}

/** >45 days -> week buckets, >180 days -> month buckets, otherwise day buckets. */
export function granularityForRange(from: Date, to: Date): Granularity {
  const days = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)
  if (days > 180) return 'month'
  if (days > 45) return 'week'
  return 'day'
}

/** Formats a Date as an ISO offset-datetime string the Spring backend can parse (OffsetDateTime). */
export function toApiDateTime(date: Date): string {
  return date.toISOString()
}

export function toDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function fromDateInputValue(value: string, endOfDayValue = false): Date {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return endOfDayValue ? endOfDay(date) : startOfDay(date)
}
