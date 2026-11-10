import type { InputHTMLAttributes } from 'react'
import { Plus, X } from 'lucide-react'
import type { UnitOption } from '@/features/products/types'
import { formatNumber, pluraliseUnitNoun, stockUnitWord, unitNoun } from '@/features/products/unitCopy'
import { keepInView, type CountBoxes } from '@/features/products/useCountBoxes'

/** "Bag", "Cup", "kg", "Pieces": the unit as a line of a count is headed, a word first letter up, a symbol as it is. */
export function countUnitName(unit: UnitOption, stockSymbol: string): string {
  const word = unit.isStockUnit ? stockUnitWord(stockSymbol, 2) : unitNoun(unit)
  return /^[a-z]{3,}/.test(word) ? word.charAt(0).toUpperCase() + word.slice(1) : word
}

/** "90 kg" under a bag, "0.6 kg" under a derica: what one holds. Nothing under the stock unit. */
function holds(unit: UnitOption, stockSymbol: string): string | null {
  if (unit.isStockUnit || !(unit.isPack || unit.isMeasure)) return null
  return `${formatNumber(unit.factorToStockUnit)} ${stockUnitWord(stockSymbol, unit.factorToStockUnit)}`
}

/**
 * A count, one line per unit (owner, 2026-11-10): the unit's name - "Bag", with "90 kg" under it - then its box, so
 * each number sits beside what it counts. The product's other units wait below as small "+ Cup" pills: a tap adds its
 * line, × takes one away (never the last). The same on the count list and the count panel.
 */
export function CountUnitLines({
  count,
  productName,
  stockSymbol,
  boxId,
  boxProps,
  onBox,
}: {
  count: CountBoxes
  productName: string
  stockSymbol: string
  boxId: (index: number) => string
  /** What each box adds: its faint hint, Enter to the next. */
  boxProps?: (index: number) => InputHTMLAttributes<HTMLInputElement>
  /** A box typed in. */
  onBox: (index: number, text: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1.5" data-count-pair>
        {count.boxes.map((box, index) => {
          const name = countUnitName(box.unit, stockSymbol)
          const size = holds(box.unit, stockSymbol)
          const plural = box.unit.isStockUnit ? stockUnitWord(stockSymbol, 2) : pluraliseUnitNoun(unitNoun(box.unit), 2)
          return (
            <div key={box.key} className="flex items-center gap-3">
              <label htmlFor={boxId(index)} className="w-24 shrink-0 leading-tight" aria-hidden="true">
                <span className="block text-base font-medium text-neutral-800">{name}</span>
                {size && <span className="block text-xs text-neutral-500">{size}</span>}
              </label>
              <input
                id={boxId(index)}
                aria-label={`${productName}: ${plural} here`}
                inputMode="decimal"
                autoComplete="off"
                value={box.text}
                onFocus={(event) => keepInView(event.currentTarget)}
                onChange={(event) => onBox(index, event.target.value)}
                className="h-11 w-24 rounded-md border border-neutral-300 bg-white px-3 text-right text-lg font-semibold text-neutral-900 tabular-nums placeholder:font-normal placeholder:text-neutral-400 focus:border-primary-600 focus:ring-2 focus:ring-primary-100 focus:outline-none disabled:bg-neutral-50"
                {...boxProps?.(index)}
              />
              {count.boxes.length > 1 && (
                <button
                  type="button"
                  onClick={() => count.toggle(box.key)}
                  aria-label={`Take ${name} off`}
                  className="inline-flex h-11 w-9 shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          )
        })}
      </div>
      <MoreCountUnits
        count={count}
        productName={productName}
        stockSymbol={stockSymbol}
        onAdded={(index) => window.requestAnimationFrame(() => document.getElementById(boxId(index))?.focus())}
      />
    </div>
  )
}

/** The product's units not in this count yet, as small "+ Cup" pills: a tap adds its box. */
export function MoreCountUnits({
  count,
  productName,
  stockSymbol,
  onAdded,
  size = 'md',
}: {
  count: CountBoxes
  productName: string
  stockSymbol: string
  /** A unit added: its box's index. */
  onAdded: (index: number) => void
  size?: 'md' | 'lg'
}) {
  const off = count.chips.filter((chip) => !chip.on)
  if (off.length === 0) return null
  return (
    <div role="group" aria-label={`Also count ${productName} in`} className="flex flex-wrap gap-1.5" data-count-more>
      {off.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => {
            const index = count.toggle(chip.key)
            if (index != null) onAdded(index)
          }}
          className={`inline-flex items-center gap-1 rounded-full border border-dashed border-neutral-300 font-medium text-neutral-700 hover:border-primary-400 hover:text-primary-800 ${
            size === 'lg' ? 'h-11 px-4 text-base' : 'h-8 px-3 text-sm'
          }`}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          {countUnitName(chip.unit, stockSymbol)}
        </button>
      ))}
    </div>
  )
}
