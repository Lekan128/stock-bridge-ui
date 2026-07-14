import { useRef, useState } from 'react'
import { Calendar, Check, ChevronDown } from 'lucide-react'
import { buttonClassName } from '@/components/Button'
import {
  PRESET_OPTIONS,
  fromDateInputValue,
  resolvePresetRange,
  toDateInputValue,
  type DateRange,
  type DateRangePreset,
} from '@/components/analytics/dateRange'
import { formatDateRange } from '@/components/analytics/formatters'
import { useClickOutside } from '@/hooks/useClickOutside'

export interface DateRangeControlProps {
  value: DateRange
  onChange: (range: DateRange) => void
}

export function DateRangeControl({ value, onChange }: DateRangeControlProps) {
  const [open, setOpen] = useState(false)
  const [customFrom, setCustomFrom] = useState(() => toDateInputValue(value.from))
  const [customTo, setCustomTo] = useState(() => toDateInputValue(value.to))
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false))

  const triggerLabel =
    value.preset === 'custom'
      ? formatDateRange(value.from, value.to)
      : (PRESET_OPTIONS.find((option) => option.value === value.preset)?.label ?? 'Select range')

  function handlePresetSelect(preset: DateRangePreset) {
    if (preset === 'custom') {
      setCustomFrom(toDateInputValue(value.from))
      setCustomTo(toDateInputValue(value.to))
      return
    }
    onChange({ preset, ...resolvePresetRange(preset) })
    setOpen(false)
  }

  function handleApplyCustomRange() {
    const from = fromDateInputValue(customFrom)
    const to = fromDateInputValue(customTo, true)
    if (from > to) return
    onChange({ preset: 'custom', from, to })
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
      >
        <Calendar className="h-4 w-4 text-neutral-400" />
        {triggerLabel}
        <ChevronDown className="h-4 w-4 text-neutral-400" />
      </button>

      {open && (
        <div className="absolute left-0 z-20 mt-2 w-72 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
          {PRESET_OPTIONS.filter((option) => option.value !== 'custom').map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handlePresetSelect(option.value)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50"
            >
              {option.label}
              {value.preset === option.value && <Check className="h-4 w-4 text-primary-600" strokeWidth={2.5} />}
            </button>
          ))}

          <div className="mt-1 border-t border-neutral-100 px-3 pt-3 pb-2">
            <button
              type="button"
              onClick={() => handlePresetSelect('custom')}
              className="flex w-full items-center justify-between text-left text-sm font-medium text-neutral-700"
            >
              Custom range
              {value.preset === 'custom' && <Check className="h-4 w-4 text-primary-600" strokeWidth={2.5} />}
            </button>

            <div className="mt-2 flex items-end gap-2">
              <label className="flex-1 text-xs text-neutral-500">
                From
                <input
                  type="date"
                  value={customFrom}
                  max={customTo}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-1.5 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
                />
              </label>
              <label className="flex-1 text-xs text-neutral-500">
                To
                <input
                  type="date"
                  value={customTo}
                  min={customFrom}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-1.5 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
                />
              </label>
            </div>
            <button type="button" onClick={handleApplyCustomRange} className={`${buttonClassName('primary')} mt-3 w-full`}>
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
