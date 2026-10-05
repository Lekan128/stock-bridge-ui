import { useState, type ReactNode } from 'react'
import { useToast } from '@/components/useToast'
import { applyStockResult, discardOp, getOutboxState, isInFlight } from '@/features/outbox/outboxStore'
import { stockApi } from '@/features/products/api/stockApi'
import { StockAdjustmentModal } from '@/features/products/components/StockAdjustmentModal'
import { StockInModal } from '@/features/products/components/StockInModal'
import { StockOutModal } from '@/features/products/components/StockOutModal'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import type { Product, StockMutationResponse } from '@/features/products/types'
import { formatNumber, stockUnitWord } from '@/features/products/unitCopy'
import { resolveUnitSymbol } from '@/features/products/unitSet'
import { isAppError } from '@/types/api'

export type StockActionKind = 'in' | 'out' | 'count'

const KIND_LABEL: Record<StockActionKind, string> = { in: 'Stock in', out: 'Stock out', count: 'Count' }

export interface StockActions {
  /** Opens the stock-in, stock-out or count sheet for a product. */
  open: (kind: StockActionKind, product: Product) => void
  /** Render this once on the screen; it is the open sheet, or nothing. */
  sheet: ReactNode
}

/**
 * Recording stock, the same way from anywhere (C1): the product page's buttons and the Inventory
 * list's quick +/− both open the same sheets, and both end the same way — a toast with the new
 * figure and Undo (B2, decision D8), or, saved on this phone, a toast whose Undo means it is
 * never sent.
 *
 * `onChanged` hears the product's new state after a write or an undo, for whatever else on the
 * screen shows it (the product page's history, its low-stock alerts). The caches and the device
 * catalogue are already brought up to date by the outbox (`applyStockResult`).
 */
export function useStockActions({ onChanged }: { onChanged?: (product: Product) => void } = {}): StockActions {
  const { showToast } = useToast()
  const { options } = useUnitOfMeasureOptions()
  const [active, setActive] = useState<{ kind: StockActionKind; product: Product } | null>(null)

  /** "1,020 kg", "96 pieces" — a figure in the product's own unit. */
  function figure(product: Product, quantity: number): string {
    return `${formatNumber(quantity)} ${stockUnitWord(resolveUnitSymbol(product.unitOfMeasure, options), quantity)}`
  }

  function close() {
    setActive(null)
  }

  function succeeded(kind: StockActionKind, result: StockMutationResponse) {
    close()
    onChanged?.(result.product)
    if (kind === 'count' && result.movement == null) {
      showToast('A newer count was already recorded, so nothing changed.', 'info')
      return
    }
    const movement = result.movement
    showToast(
      `${KIND_LABEL[kind]} recorded · ${result.product.name} now ${figure(result.product, result.product.quantityOnHand)}`,
      'success',
      movement ? { action: { label: 'Undo', onAction: () => void undoWrite(result.product, movement.id) } } : undefined,
    )
  }

  /** Undo a write that reached the server: voided as if never made, or refused with the reason. */
  async function undoWrite(product: Product, movementId: string) {
    try {
      const restored = await stockApi.voidWrite(product.id, movementId)
      applyStockResult(product.id, restored)
      onChanged?.(restored.product)
      showToast(
        `Undone · ${restored.product.name} is back to ${figure(restored.product, restored.product.quantityOnHand)}`,
        'info',
      )
    } catch (err) {
      showToast(isAppError(err) ? err.message : "Couldn't undo that. Record a count to correct the figure.", 'error')
    }
  }

  /** Saved on this phone (A4): the pending line beside the figure takes it from here. */
  function queued(opId: string) {
    close()
    showToast("Saved on this phone. It will be sent when you're back online.", 'info', {
      action: { label: 'Undo', onAction: () => undoQueued(opId) },
    })
  }

  /** Undo a write still waiting on this phone: it is simply never sent. */
  function undoQueued(opId: string) {
    if (isInFlight(opId)) {
      showToast("It's being sent right now, so it can't be taken back. Record a count to correct the figure.", 'info')
      return
    }
    if (!getOutboxState().ops.some((op) => op.id === opId)) {
      showToast("It has already been sent, so it can't be taken back here. Record a count to correct the figure.", 'info')
      return
    }
    void discardOp(opId)
    showToast('Taken back. Nothing was sent.', 'info')
  }

  let sheet: ReactNode = null
  if (active?.kind === 'in') {
    sheet = (
      <StockInModal
        product={active.product}
        onClose={close}
        onSuccess={(result) => succeeded('in', result)}
        onQueued={queued}
      />
    )
  } else if (active?.kind === 'out') {
    sheet = (
      <StockOutModal
        product={active.product}
        onClose={close}
        onSuccess={(result) => succeeded('out', result)}
        onQueued={queued}
      />
    )
  } else if (active?.kind === 'count') {
    sheet = (
      <StockAdjustmentModal
        productId={active.product.id}
        productName={active.product.name}
        currentQuantity={active.product.quantityOnHand}
        stockUnit={resolveUnitSymbol(active.product.unitOfMeasure, options)}
        onClose={close}
        onSuccess={(result) => succeeded('count', result)}
        onQueued={queued}
      />
    )
  }

  return { open: (kind, product) => setActive({ kind, product }), sheet }
}
