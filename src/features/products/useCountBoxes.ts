import { useEffect, useState } from 'react'
import type { UnitOption } from '@/features/products/types'
import { countUnits, roundQuantity, toBaseQuantity } from '@/features/products/unitSet'

/** One box of a count: the unit it's in (null: the one it started with) and what's typed in it. */
interface Box {
  key: number
  label: string | null
  text: string
}

/** A typed amount, or null while it isn't one yet. Blank is 0: a box left empty counts nothing. */
function amountOf(text: string): number | null {
  const trimmed = text.trim()
  if (trimmed === '') return 0
  return /^\d*\.?\d{0,3}$/.test(trimmed) && trimmed !== '.' ? Number(trimmed) : null
}

/**
 * A count in as many of the product's units as the shelf needs (owner, 2026-11-09; as Restaurant365 and MarginEdge
 * count an item in several units, each in its own box, added up). It starts with what a store is counted in - whole
 * packs and what's left in the usual unit, or one box - and "Another unit" adds a box in the next unit not yet used,
 * until every one is. Each box's unit can change and a box can go. The total is in the stock unit.
 *
 * One rule for the count panel, quick mode and the count list, so a count reads the same wherever it's made.
 */
export function useCountBoxes(product: { usedInUnit?: string | null }, offered: UnitOption[]) {
  const pair = countUnits(product, offered)
  const starting = pair.big ? [pair.big, pair.small] : [pair.small]
  const [boxes, setBoxes] = useState<Box[]>(() => starting.map((_, index) => ({ key: index, label: null, text: '' })))
  const [nextKey, setNextKey] = useState(starting.length)
  // The product's units can arrive after the first render (the unit list loads): until anything is touched, start
  // with the boxes they call for.
  const [touched, setTouched] = useState(false)
  useEffect(() => {
    if (!touched && boxes.length !== starting.length) {
      setBoxes(starting.map((_, index) => ({ key: index, label: null, text: '' })))
      setNextKey(starting.length)
    }
  }, [touched, boxes.length, starting.length])

  const units: UnitOption[] = []
  for (const [index, box] of boxes.entries()) {
    const chosen = box.label != null ? offered.find((option) => option.label === box.label) : undefined
    const fallback =
      starting[index] && !units.some((unit) => unit.label === starting[index].label)
        ? starting[index]
        : (offered.find((option) => !units.some((unit) => unit.label === option.label)) ?? pair.small)
    units.push(chosen ?? fallback)
  }
  const unused = offered.filter((option) => !units.some((unit) => unit.label === option.label))
  const amounts = boxes.map((box) => amountOf(box.text))
  const anyTyped = boxes.some((box) => box.text.trim() !== '')
  const valid = amounts.every((amount) => amount != null)
  const total = valid ? roundQuantity(units.reduce((sum, unit, index) => sum + toBaseQuantity(amounts[index] ?? 0, unit), 0)) : null

  return {
    boxes: boxes.map((box, index) => ({ key: box.key, unit: units[index], text: box.text, amount: amounts[index] })),
    /** Something typed in some box. */
    anyTyped,
    /** Every box holds a number (or nothing). */
    valid,
    /** All the boxes together, in the stock unit; null while one isn't a number. */
    total,
    /** Another box can be added: the product has a unit no box is in yet. */
    canAdd: unused.length > 0,
    setText(index: number, text: string) {
      setTouched(true)
      setBoxes((current) => current.map((box, at) => (at === index ? { ...box, text: text.replace(',', '.') } : box)))
    },
    setUnit(index: number, label: string) {
      setTouched(true)
      setBoxes((current) => current.map((box, at) => (at === index ? { ...box, label } : box)))
    },
    /** A box in the next unit not yet used; its index. */
    add(): number {
      setTouched(true)
      const unit = unused[0]
      setBoxes((current) => [...current, { key: nextKey, label: unit?.label ?? null, text: '' }])
      setNextKey((key) => key + 1)
      return boxes.length
    },
    remove(index: number) {
      setTouched(true)
      setBoxes((current) => (current.length > 1 ? current.filter((_, at) => at !== index) : current))
    },
    /** Back to empty boxes, as it started: after a count is recorded. */
    clear() {
      setTouched(false)
      setBoxes(starting.map((_, index) => ({ key: index, label: null, text: '' })))
    },
  }
}

export type CountBoxes = ReturnType<typeof useCountBoxes>
