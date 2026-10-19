import { useEffect, useRef, useState } from 'react'
import { api } from '@/api/client'
import { useDraft } from '@/features/drafts/useDraft'
import { discardOp, getOutboxState, isInFlight, submitStockWrite } from '@/features/outbox/outboxStore'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import type { Product } from '@/features/products/types'
import { formatEnteredAndBase } from '@/features/products/unitCopy'
import { stockUnitLabel, toBaseQuantity } from '@/features/products/unitSet'
import { formatMoney } from '@/features/selling/money'
import { lineAmount, openingUnit, optionOf, unitsFor, type SaleLine } from '@/features/selling/sale/saleLine'
import { isAppError } from '@/types/api'

/** How one line of a recorded sale stands. */
export interface RecordedLine {
  line: SaleLine
  amount: number | null
  /** sent: the server has it. queued: saved on this phone. refused: the server said no, now. */
  status: 'sent' | 'queued' | 'refused'
  movementId?: string
  opId?: string
  message?: string
  /** For an oversell refused now: what is there, in stock units, to offer "Sell 4". */
  available?: number
}

export interface RecordedSale {
  saleId: string
  label: string
  lines: RecordedLine[]
  /** What the recorded lines came to - refused lines and unpriced ones are not in it. */
  total: number
}

interface BasketDraft {
  lines: SaleLine[]
  note: string
}

const DRAFT_KEY = 'sale:new'

/**
 * A sale being put together and recorded (`SELLING_PRICE_PLAN.md` §6.1, §4.4).
 *
 * Kept as a draft on the phone the whole time, so a closed app or a flat battery keeps the
 * customer's items. Recorded LINE BY LINE through the ordinary stock-out - each line keeps the
 * outbox, Idempotency-Key, Undo and conflict handling stock-outs already have - all under one sale
 * id made here, so an offline sale is one sale before it reaches the server. A line refused now
 * (oversold) does not stop the others: the money for them was taken.
 */
export function useSaleBasket() {
  const { options: catalogue } = useUnitOfMeasureOptions()
  const draft = useDraft<BasketDraft>(DRAFT_KEY)
  const [lines, setLines] = useState<SaleLine[]>([])
  const [note, setNote] = useState('')
  const restored = useRef(false)

  useEffect(() => {
    if (restored.current || draft.initial === undefined) return
    restored.current = true
    if (draft.initial?.value?.lines?.length) {
      setLines(draft.initial.value.lines)
      setNote(draft.initial.value.note ?? '')
    }
  }, [draft.initial])

  useEffect(() => {
    if (!restored.current) return
    if (lines.length === 0 && note === '') void draft.clear()
    else draft.save({ lines, note })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, note])

  /** Adds one of the product - or one more, if it is already in the basket in the unit it opens in. */
  function add(product: Product): string {
    const options = unitsFor(product, catalogue)
    const unit = openingUnit(product, options)
    const existing = lines.find((line) => line.product.id === product.id && line.unitLabel === unit.label)
    if (existing) {
      setLines((all) => all.map((line) => (line.key === existing.key ? { ...line, quantity: line.quantity + 1 } : line)))
      return existing.key
    }
    const key = crypto.randomUUID()
    setLines((all) => [...all, { key, product, unitLabel: unit.label, quantity: 1, priceTyped: null, totalTyped: null }])
    return key
  }

  function update(key: string, patch: Partial<SaleLine>) {
    setLines((all) => all.map((line) => (line.key === key ? { ...line, problem: undefined, ...patch } : line)))
  }

  function remove(key: string): SaleLine | undefined {
    const removed = lines.find((line) => line.key === key)
    setLines((all) => all.filter((line) => line.key !== key))
    return removed
  }

  function restore(line: SaleLine) {
    setLines((all) => (all.some((existing) => existing.key === line.key) ? all : [...all, line]))
  }

  const total = lines.reduce((sum, line) => {
    const options = unitsFor(line.product, catalogue)
    return sum + (lineAmount(line, optionOf(line, options), options) ?? 0)
  }, 0)

  /** Records every line under one new sale id, in order; returns how each one stands. */
  async function record(): Promise<RecordedSale> {
    const saleId = crypto.randomUUID()
    const time = new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    const label = `${time} sale (${lines.length} ${lines.length === 1 ? 'item' : 'items'})`
    const recorded: RecordedLine[] = []
    for (const line of lines) {
      const options = unitsFor(line.product, catalogue)
      const option = optionOf(line, options)
      const amount = lineAmount(line, option, options)
      const base = toBaseQuantity(line.quantity, option)
      const quantityText = formatEnteredAndBase(line.quantity, option, base, stockUnitLabel(options))
      try {
        const outcome = await submitStockWrite({
          kind: 'STOCK_OUT',
          productId: line.product.id,
          productName: line.product.name,
          // The sale it belongs to rides on every line, so a line waiting or refused on this
          // phone says which sale it is part of (§4.4).
          summary: `${quantityText}${amount != null ? ` · ${formatMoney(amount)}` : ''} · part of the ${label}`,
          payload: {
            quantity: line.quantity,
            unit: option.isStockUnit ? undefined : option.code,
            reason: 'SALE',
            saleId,
            // What the line came to, exactly as the screen showed it - never a price each the server
            // multiplies back, which would turn "₦5,000 a carton" sold by the piece into ₦4,999.92.
            ...(amount != null ? { lineTotal: amount } : {}),
            note: note.trim() || undefined,
          },
          baseDelta: -base,
        })
        recorded.push(
          outcome.status === 'sent'
            ? { line, amount, status: 'sent', movementId: outcome.response.movement?.id }
            : { line, amount, status: 'queued', opId: outcome.op.id },
        )
      } catch (err) {
        recorded.push({
          line,
          amount,
          status: 'refused',
          message: isAppError(err) ? err.message : 'Not recorded. Try again.',
          available: isAppError(err) && err.availableQuantity != null ? err.availableQuantity : undefined,
        })
      }
    }
    const total = recorded.filter((r) => r.status !== 'refused').reduce((sum, r) => sum + (r.amount ?? 0), 0)
    // Recorded lines leave the basket; a refused one stays, so it can be fixed and recorded.
    const refused = new Map(recorded.filter((r) => r.status === 'refused').map((r) => [r.line.key, r.message]))
    setLines((all) => all.filter((line) => refused.has(line.key)).map((line) => ({ ...line, problem: refused.get(line.key) })))
    if (refused.size === 0) setNote('')
    return { saleId, label, lines: recorded, total }
  }

  return { lines, note, setNote, add, update, remove, restore, total, record, catalogue, draftSavedAt: draft.savedAt }
}

/**
 * Undo a sale just recorded (D8, line by line): lines the server has are voided there - each refuses
 * on its own if it can no longer be undone - and lines still waiting on this phone are never sent.
 * Returns the sentences for lines that could not be taken back.
 */
export async function undoSale(sale: RecordedSale): Promise<string[]> {
  const problems: string[] = []
  for (const line of sale.lines) {
    if (line.status !== 'queued' || !line.opId) continue
    if (isInFlight(line.opId) || !getOutboxState().ops.some((op) => op.id === line.opId)) {
      // Gone to the server in the meantime: the server-side undo below covers it.
      continue
    }
    await discardOp(line.opId)
  }
  if (sale.lines.some((line) => line.status === 'sent' || line.status === 'queued')) {
    try {
      const response = await api.post<{ lines: { productName: string; undone: boolean; reason?: string }[] }>(
        `/api/sales/${sale.saleId}/undo`,
      )
      for (const line of response.data.lines) if (!line.undone) problems.push(`${line.productName}: ${line.reason}`)
    } catch (err) {
      // 404: nothing of it reached the server - which is right when every line was still on the phone.
      if (!(isAppError(err) && err.status === 404)) problems.push(isAppError(err) ? err.message : "Couldn't undo the sale.")
    }
  }
  return problems
}
