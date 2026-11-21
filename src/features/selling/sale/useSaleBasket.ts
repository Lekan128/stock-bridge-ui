import { useEffect, useRef, useState } from 'react'
import { api } from '@/api/client'
import { deleteDraft, loadDraft } from '@/features/drafts/draftStore'
import { useDraft } from '@/features/drafts/useDraft'
import { discardOp, getOutboxState, isInFlight, submitStockWrite } from '@/features/outbox/outboxStore'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import type { Product } from '@/features/products/types'
import { formatEnteredAndBase } from '@/features/products/unitCopy'
import { stockUnitLabel, toBaseQuantity } from '@/features/products/unitSet'
import { formatMoney } from '@/features/selling/money'
import type { SalePaymentMethod } from '@/features/selling/sale/paymentMethod'
import { lineAmount, openingUnit, optionOf, unitsFor, type SaleLine } from '@/features/selling/sale/saleLine'
import { isAppError } from '@/types/api'
import { useBranchPrices } from '@/features/selling/branchPrices'

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
  /** How the customer paid (selling till Step 1). */
  paymentMethod: SalePaymentMethod
  /** The account a transfer came into (Step 12). Kept off the receipt. */
  paymentAccountId?: string
  /** When it was recorded on this phone (ms) - the receipt's time. */
  recordedAt: number
  /** Its charges and taxes (V100), worked out on the till as the server does - for the receipt straight away. */
  charges?: import('@/features/selling/charges').SaleCharge[]
  /** The food and drinks plus the charges added on top. */
  toPay?: number
}

/** One customer's basket. Several can be open at once: one being served, others waiting to pay. */
export interface Basket {
  id: string
  lines: SaleLine[]
  note: string
  /**
   * The area it's sold from (owner, 2026-11-18): a sale stays with its area. Switching from the Bar to the Kitchen
   * leaves the Bar's sale waiting there and shows the Kitchen's. Unset until the till knows its area.
   */
  areaId?: string
}

interface BasketsDraft {
  activeId: string
  baskets: Basket[]
}

/** Every open basket on this phone, under one draft (Step 1 fixes). Before, one basket under `sale:new`. */
export const BASKETS_DRAFT_KEY = 'sale:baskets'
const OLD_DRAFT_KEY = 'sale:new'

function emptyBasket(): Basket {
  return { id: crypto.randomUUID(), lines: [], note: '' }
}

/**
 * The sales being put together at the counter (`SELLING_PRICE_PLAN.md` §6.1, §4.4; selling till Step 1).
 *
 * Several baskets can be open - "+ New sale" while the first customer is still finding their money - and
 * every one is kept as a draft on the phone, so a closed app or a flat battery keeps each customer's items.
 * A sale is recorded LINE BY LINE through the ordinary stock-out - each line keeps the outbox,
 * Idempotency-Key, Undo and conflict handling stock-outs already have - all under one sale id made here,
 * so an offline sale is one sale before it reaches the server. A line refused now (oversold) does not stop
 * the others: the money for them was taken.
 */
export function useSaleBasket(draftKey: string = BASKETS_DRAFT_KEY) {
  const branchPrices = useBranchPrices()
  const { options: catalogue } = useUnitOfMeasureOptions()
  const draft = useDraft<BasketsDraft>(draftKey)
  const [baskets, setBaskets] = useState<Basket[]>(() => [emptyBasket()])
  const [activeId, setActiveId] = useState<string>(() => baskets[0].id)
  const restored = useRef(false)
  // The area the till is selling from; undefined at a branch without areas (every sale shows).
  const [areaKey, setAreaKey] = useState<string | undefined>(undefined)
  const here = (basket: Basket) => areaKey === undefined || basket.areaId === undefined || basket.areaId === areaKey

  useEffect(() => {
    if (restored.current || draft.initial === undefined) return
    restored.current = true
    const saved = draft.initial?.value
    if (saved?.baskets?.some((basket) => basket.lines.length > 0)) {
      const kept = saved.baskets.filter((basket) => basket.lines.length > 0 || basket.id === saved.activeId)
      setBaskets(kept)
      setActiveId(kept.some((basket) => basket.id === saved.activeId) ? saved.activeId : kept[0].id)
      return
    }
    // A basket kept before several could be open: it becomes the first one.
    void loadDraft<{ lines?: SaleLine[]; note?: string }>(OLD_DRAFT_KEY).then((old) => {
      if (!old?.value?.lines?.length) return
      const basket = { id: crypto.randomUUID(), lines: old.value.lines, note: old.value.note ?? '' }
      setBaskets([basket])
      setActiveId(basket.id)
      void deleteDraft(OLD_DRAFT_KEY)
    })
  }, [draft.initial])

  useEffect(() => {
    if (!restored.current) return
    if (baskets.every((basket) => basket.lines.length === 0 && basket.note === '')) void draft.clear()
    else draft.save({ activeId, baskets })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baskets, activeId])

  // The till shows only its area's sales: a sale without an area joins this one; another area's sale waits there,
  // and this area's latest waiting sale - or a fresh one - comes up (owner, 2026-11-18).
  useEffect(() => {
    if (areaKey === undefined) return
    if (baskets.some((basket) => basket.areaId === undefined)) {
      setBaskets((all) => all.map((basket) => (basket.areaId === undefined ? { ...basket, areaId: areaKey } : basket)))
      return
    }
    if (baskets.find((basket) => basket.id === activeId)?.areaId === areaKey) return
    const mine = baskets.filter((basket) => basket.areaId === areaKey && (basket.lines.length > 0 || basket.note !== ''))
    if (mine.length > 0) {
      setActiveId(mine[mine.length - 1].id)
      return
    }
    const fresh = emptyBasket()
    fresh.areaId = areaKey
    setBaskets((all) => [...all.filter((basket) => basket.lines.length > 0 || basket.note !== ''), fresh])
    setActiveId(fresh.id)
  }, [areaKey, baskets, activeId])

  const active = baskets.find((basket) => basket.id === activeId) ?? baskets[0]
  const lines = active.lines
  const note = active.note

  function changeActive(change: (basket: Basket) => Basket) {
    setBaskets((all) => all.map((basket) => (basket.id === active.id ? change(basket) : basket)))
  }
  function setLines(change: (lines: SaleLine[]) => SaleLine[]) {
    changeActive((basket) => ({ ...basket, lines: change(basket.lines) }))
  }
  function setNote(value: string) {
    changeActive((basket) => ({ ...basket, note: value }))
  }

  /**
   * Adds one of the product - or one more, if it is already in the basket in the unit it opens in. A side on a table's
   * bill (V99) counts up only beside the same meal; given `withKey`, it goes with that meal.
   */
  function add(given: Product, withKey?: string): string {
    // Prices per branch (V107): the sale charges the price at the branch it's recorded at.
    const product = branchPrices.atWorking(given)
    const options = unitsFor(product, catalogue)
    const unit = openingUnit(product, options)
    const existing = lines.find(
      (line) => line.product.id === product.id && line.unitLabel === unit.label && line.withKey === withKey && !line.note,
    )
    if (existing) {
      setLines((all) => all.map((line) => (line.key === existing.key ? { ...line, quantity: line.quantity + 1 } : line)))
      return existing.key
    }
    const key = crypto.randomUUID()
    setLines((all) => [...all, { key, product, unitLabel: unit.label, quantity: 1, priceTyped: null, totalTyped: null, withKey }])
    return key
  }

  /**
   * One of a line of several becomes a line of its own (V99): a side goes with one of the two Jollof, so that one is
   * now its own plate. Returns the new line's key.
   */
  function splitOne(key: string): string {
    const original = lines.find((line) => line.key === key)
    if (!original || original.quantity < 2) return key
    const fresh = crypto.randomUUID()
    setLines((all) =>
      all.flatMap((line) =>
        line.key === key ? [{ ...line, quantity: line.quantity - 1 }, { ...line, key: fresh, quantity: 1, note: undefined }] : [line],
      ),
    )
    return fresh
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

  /** Undo sale: its lines come back into the basket being served, or a fresh one beside it if that has items. */
  function restoreSale(sale: RecordedSale) {
    const back = sale.lines.filter((r) => r.status !== 'refused').map((r) => ({ ...r.line, key: crypto.randomUUID() }))
    if (back.length === 0) return
    if (active.lines.length === 0) {
      setLines(() => back)
      return
    }
    const basket = { id: crypto.randomUUID(), lines: back, note: '' }
    setBaskets((all) => [...all, basket])
    setActiveId(basket.id)
  }

  /** "+ New sale": a fresh basket, the one being served waiting beside it. Nothing to do if this one is empty. */
  function newSale() {
    if (active.lines.length === 0) return
    const basket = emptyBasket()
    setBaskets((all) => [...all.filter((b) => b.lines.length > 0 || b.note !== ''), basket])
    setActiveId(basket.id)
  }

  /**
   * Cancel the sale being put together (owner, 2026-11-18; confirmed on the screen first). Nothing was recorded, so
   * nothing is kept: the basket goes, and the next waiting sale - or a fresh empty one - takes its place.
   */
  function cancelSale() {
    const others = baskets.filter((basket) => basket.id !== active.id && (basket.lines.length > 0 || basket.note !== ''))
    const next = others.filter(here)[0] ?? emptyBasket()
    setBaskets(others.length > 0 ? others : [next])
    setActiveId(next.id)
  }

  /** Go back to a waiting basket. An empty one left behind goes away. */
  function switchTo(id: string) {
    if (id === active.id) return
    setBaskets((all) => all.filter((basket) => basket.id === id || basket.lines.length > 0 || basket.note !== ''))
    setActiveId(id)
  }

  function totalOf(basket: Basket): number {
    return basket.lines.reduce((sum, line) => {
      const options = unitsFor(line.product, catalogue)
      return sum + (lineAmount(line, optionOf(line, options), options) ?? 0)
    }, 0)
  }
  const total = totalOf(active)

  /** Records every line under one new sale id, in order; returns how each one stands. */
  /** `areaId`: where in the branch the sale comes from (V60), chosen on the screen; absent without a choice. */
  /** `paymentMethod`: how the customer paid - it rides on every line; the server keeps the first to arrive. */
  async function record(areaId: string | undefined, paymentMethod: SalePaymentMethod, paymentAccountId?: string): Promise<RecordedSale> {
    const basketId = active.id
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
            areaId,
            paymentMethod: paymentMethod as 'CASH' | 'TRANSFER' | 'CARD',
            ...(paymentAccountId ? { paymentAccountId } : {}),
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
    if (refused.size > 0) {
      setBaskets((all) =>
        all.map((basket) =>
          basket.id === basketId
            ? { ...basket, lines: basket.lines.filter((l) => refused.has(l.key)).map((l) => ({ ...l, problem: refused.get(l.key) })) }
            : basket,
        ),
      )
    } else {
      // Paid: that basket goes, and an empty one is ready for the next customer. Waiting ones stay.
      const next = emptyBasket()
      setBaskets((all) => [...all.filter((basket) => basket.id !== basketId), next])
      setActiveId(next.id)
    }
    return { saleId, label, lines: recorded, total, paymentMethod, paymentAccountId, recordedAt: Date.now() }
  }

  /**
   * Sends the new lines to a table's bill (V99, Step 7): each line an ordinary sale line under the bill's id, from the area
   * that makes or keeps it ({@code areaFor}), with no payment - the bill is paid later. Each line carries its key, the
   * meal it goes with and its note. Sent lines leave the basket; a refused one stays to fix.
   */
  async function send(billId: string, label: string, areaFor: (line: SaleLine) => string | undefined): Promise<RecordedLine[]> {
    const basketId = active.id
    const sent: RecordedLine[] = []
    // One Send: its lines gather on one ticket per area (Step 8, V102).
    const sendKey = crypto.randomUUID()
    // Meals before their sides, so a side never arrives before the plate it goes with.
    const ordered = [...lines.filter((line) => !line.withKey), ...lines.filter((line) => line.withKey)]
    for (const line of ordered) {
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
          summary: `${quantityText}${amount != null ? ` · ${formatMoney(amount)}` : ''} · ${label}`,
          payload: {
            quantity: line.quantity,
            unit: option.isStockUnit ? undefined : option.code,
            reason: 'SALE',
            saleId: billId,
            ...(amount != null ? { lineTotal: amount } : {}),
            areaId: areaFor(line),
            billLine: { lineKey: line.key, withKey: line.withKey, note: line.note?.trim() || undefined, sendKey },
          },
          baseDelta: -base,
        })
        sent.push(
          outcome.status === 'sent'
            ? { line, amount, status: 'sent', movementId: outcome.response.movement?.id }
            : { line, amount, status: 'queued', opId: outcome.op.id },
        )
      } catch (err) {
        sent.push({
          line,
          amount,
          status: 'refused',
          message: isAppError(err) ? err.message : 'Not sent. Try again.',
          available: isAppError(err) && err.availableQuantity != null ? err.availableQuantity : undefined,
        })
      }
    }
    const refused = new Map(sent.filter((r) => r.status === 'refused').map((r) => [r.line.key, r.message]))
    setBaskets((all) =>
      all.map((basket) =>
        basket.id === basketId
          ? { ...basket, lines: basket.lines.filter((l) => refused.has(l.key)).map((l) => ({ ...l, problem: refused.get(l.key) })) }
          : basket,
      ),
    )
    return sent
  }

  return {
    lines,
    note,
    setNote,
    add,
    update,
    remove,
    restore,
    restoreSale,
    total,
    record,
    send,
    splitOne,
    catalogue,
    draftSavedAt: draft.savedAt,
    /** Every open basket, in the order started; the one being served is `activeId`. */
    baskets: baskets.filter(here),
    activeId: active.id,
    totalOf,
    newSale,
    cancelSale,
    switchTo,
    /** The till's area: its sales show, the others wait. */
    showArea: setAreaKey,
    /** Sales waiting in each other area - the area chips say so. */
    waitingByArea: baskets.reduce<Record<string, number>>((count, basket) => {
      if (basket.areaId && basket.areaId !== areaKey && basket.lines.length > 0) count[basket.areaId] = (count[basket.areaId] ?? 0) + 1
      return count
    }, {}),
  }
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
