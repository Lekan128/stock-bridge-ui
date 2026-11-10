import { useEffect, useState } from 'react'
import type { UnitOption } from '@/features/products/types'
import { biggestFirst, countInOptions, roundQuantity, toBaseQuantity, unitKey } from '@/features/products/unitSet'
import { formatNumber, pluraliseUnitNoun, stockUnitWord, unitNoun } from '@/features/products/unitCopy'

/** A typed amount, or null while it isn't one yet. Blank is 0: a box left empty counts nothing. */
function amountOf(text: string): number | null {
  const trimmed = text.trim()
  if (trimmed === '') return 0
  return /^\d*\.?\d{0,3}$/.test(trimmed) && trimmed !== '.' ? Number(trimmed) : null
}

/**
 * A count in as many of the product's units as the shelf needs (owner, 2026-11-10): every unit it has is shown as a
 * round chip, the ones it's counted in already on - set once on the product, as MarginEdge's "How do you want to count
 * this product?" - each with its own box. Tapping a chip adds or takes away its box for this count only; the last one
 * stays. Boxes go biggest unit first ("2 bags + 7 dericas") and add up to one total in the stock unit.
 *
 * One rule for the count panel, quick mode and the count list, so a count reads the same wherever it's made.
 */
export function useCountBoxes(
  product: { usedInUnit?: string | null; countIn?: string[] | null },
  offered: UnitOption[],
  /** Counting again (owner, 2026-11-10): the lines as the last count was typed, filled in. */
  initial?: CountedLine[] | null,
) {
  const startingUnits = countInOptions(product, offered)
  // A product with no stock unit set still gets its one box ("units").
  const chips = offered.length > 0 ? biggestFirst(offered) : startingUnits
  // The last count's lines, each matched to one of the product's units; any it no longer has and it starts afresh.
  const again = (initial ?? []).map((line) => ({
    key: chips.map(unitKey).find((key) => key.toLowerCase() === line.unit.toLowerCase()),
    text: formatPlain(line.quantity),
  }))
  const fromAgain = again.length > 0 && again.every((line) => line.key != null)
  const starting = fromAgain ? again.map((line) => line.key as string) : startingUnits.map(unitKey)
  const startingTexts = fromAgain ? Object.fromEntries(again.map((line) => [line.key as string, line.text])) : {}
  const startingKey = `${starting.join('|')}#${JSON.stringify(startingTexts)}`
  const [on, setOn] = useState<string[]>(starting)
  const [texts, setTexts] = useState<Record<string, string>>(startingTexts)
  // The product's units can arrive after the first render (the unit list loads): until anything is touched, start
  // with the ones it's counted in, or the last count's.
  const [touched, setTouched] = useState(false)
  useEffect(() => {
    if (touched) return
    const [keys, typed] = startingKey.split('#')
    setOn(keys.split('|'))
    setTexts(JSON.parse(typed) as Record<string, string>)
  }, [touched, startingKey])

  const units = chips.filter((option) => on.includes(unitKey(option)))
  const boxes = units.map((unit) => {
    const key = unitKey(unit)
    const text = texts[key] ?? ''
    return { key, unit, text, amount: amountOf(text) }
  })
  const anyTyped = boxes.some((box) => box.text.trim() !== '')
  const valid = boxes.every((box) => box.amount != null)
  const total = valid ? roundQuantity(boxes.reduce((sum, box) => sum + toBaseQuantity(box.amount ?? 0, box.unit), 0)) : null

  return {
    /** What was typed, box by box, as the count is sent (V85): read back as "1 bag + 2 kg". */
    countedAs: boxes.filter((box) => box.text.trim() !== '').map((box) => ({ unit: box.key, quantity: box.amount ?? 0 })),
    /** Every unit the product has, biggest first, and whether this count has a box for it. */
    chips: chips.map((unit) => ({ key: unitKey(unit), unit, on: on.includes(unitKey(unit)) })),
    boxes,
    /** Something typed in some box. */
    anyTyped,
    /** Every box holds a number (or nothing). */
    valid,
    /** All the boxes together, in the stock unit; null while one isn't a number. */
    total,
    setText(index: number, text: string) {
      setTouched(true)
      const key = boxes[index]?.key
      // A product with no unit set has the empty key: still a box.
      if (key != null) setTexts((current) => ({ ...current, [key]: text.replace(',', '.') }))
    },
    /** A chip tapped: its box comes or goes (the last one stays). The index of its box when it came, else null. */
    toggle(key: string): number | null {
      setTouched(true)
      if (on.includes(key)) {
        if (on.length > 1) {
          setOn((current) => current.filter((other) => other !== key))
          setTexts((current) => ({ ...current, [key]: '' }))
        }
        return null
      }
      const next = [...on, key]
      setOn(next)
      return chips.filter((option) => next.includes(unitKey(option))).findIndex((option) => unitKey(option) === key)
    },
    /** Back to empty boxes in the product's count units: after a count is recorded. */
    clear() {
      setTouched(false)
      setTexts({})
      setOn(starting)
    },
  }
}

export type CountBoxes = ReturnType<typeof useCountBoxes>

/** One box of a count as it was typed (API V85): 1 in "BAG:15". */
export interface CountedLine {
  unit: string
  quantity: number
}

/** 1.5 as "1.5", 2 as "2": what goes back in a box. */
function formatPlain(quantity: number): string {
  return String(roundQuantity(quantity))
}

/** "1 bag + 2 kg": a count read back as it was typed; null when a line's unit isn't one of these any more. */
export function countedAsText(lines: CountedLine[] | null | undefined, offered: UnitOption[], stockSymbol: string): string | null {
  if (!lines || lines.length === 0) return null
  const parts: string[] = []
  for (const line of lines) {
    const unit = offered.find((option) => unitKey(option).toLowerCase() === line.unit.toLowerCase())
    if (!unit && line.unit !== '') return null
    const noun = !unit || unit.isStockUnit ? stockUnitWord(stockSymbol, line.quantity) : pluraliseUnitNoun(unitNoun(unit), line.quantity)
    parts.push(`${formatNumber(line.quantity)} ${noun}`)
  }
  return parts.join(' + ')
}

/**
 * A box the phone's keypad might cover: once the keypad is up, it's scrolled to the middle of what's left of the
 * screen (owner, 2026-11-10: "I hope when the user clicks the keypad is not going to cover the text box").
 */
export function keepInView(element: HTMLElement) {
  window.setTimeout(() => element.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)
}
