import { useEffect, useState, type ReactNode } from 'react'
import { CheckCircle2, ClipboardList, PackageX, Plus, TriangleAlert, Truck, Wrench } from 'lucide-react'
import { Link } from 'react-router-dom'
import { buttonClassName } from '@/components/Button'
import { Stamp } from '@/components/Stamp'
import { useCatalogList, useCatalogState } from '@/features/catalog/useCatalog'
import { describeDraft } from '@/features/drafts/describeDraft'
import { listDrafts, type StoredDraft } from '@/features/drafts/draftStore'
import { useDraftCount } from '@/features/drafts/useDraft'
import { useExpectedDeliveries } from '@/features/expected/hooks/useExpectedDeliveries'
import { useOutboxState } from '@/features/outbox/useOutbox'
import { StockFigure } from '@/features/products/components/StockFigure'
import { useProducts } from '@/features/products/hooks/useProducts'
import { useStockActions } from '@/features/products/hooks/useStockActions'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import { useDataIssuesNotice } from '@/features/products/quality/useDataIssuesNotice'
import type { Product } from '@/features/products/types'
import { resolveUnitSymbol } from '@/features/products/unitSet'
import { SyncCentre } from '@/features/sync/SyncCentre'

const SHOWN_PER_KIND = 4

export interface NeedsYouTodayProps {
  canStockIn: boolean
  /** May record a delivery (MANAGE_INVENTORY): offered "Receive" on one that is due. */
  canReceive: boolean
}

/** Today's date as the API writes it, in the phone's own day. */
function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/**
 * "Needs you today" (C5, finding U7: nothing on the dashboard told anyone what to DO). Every item
 * is a sentence with its action beside it, most urgent first: changes the server refused, deliveries
 * due, stock that has run out or is running low (with Stock in right there), forms left half-done
 * on this phone, products whose details need a fix. Everything except the deliveries and the data
 * issues is read from the phone, so the list still answers offline.
 */
export function NeedsYouToday({ canStockIn, canReceive }: NeedsYouTodayProps) {
  const { options } = useUnitOfMeasureOptions()
  const stockActions = useStockActions()
  const [syncOpen, setSyncOpen] = useState(false)

  // Refused by the server once they arrived (A4) — the only things here nobody else can fix.
  const { ops } = useOutboxState()
  const refused = ops.filter((op) => op.status === 'needs_attention').length

  // Deliveries promised for today or earlier and still owed.
  const expected = useExpectedDeliveries('OPEN', 0, 50, { enabled: canReceive })
  const today = todayIso()
  const due = (expected.data?.content ?? []).filter((d) => d.receivable && d.expectedDate != null && d.expectedDate <= today)

  // Out of stock and low, lowest first — from the device catalogue when it is there.
  const catalog = useCatalogState()
  const onDevice = catalog.phase === 'ready'
  const out = useWorstStock('OUT', onDevice)
  const low = useWorstStock('LOW', onDevice)

  const [drafts, setDrafts] = useState<StoredDraft[]>([])
  const draftCount = useDraftCount()
  useEffect(() => {
    let cancelled = false
    void listDrafts().then((found) => {
      if (!cancelled) setDrafts(found)
    })
    return () => {
      cancelled = true
    }
  }, [draftCount])

  const dataIssues = useDataIssuesNotice()

  const rows: ReactNode[] = []
  if (refused > 0) {
    rows.push(
      <NeedRow
        key="refused"
        icon={<TriangleAlert className="h-5 w-5 text-warning-700" aria-hidden="true" />}
        title={`${refused} stock ${refused === 1 ? 'change' : 'changes'} the server refused`}
        detail="Recorded on this phone, refused when it arrived. Decide what to do with each."
        badge={<Stamp kind="check" />}
        action={
          <button type="button" onClick={() => setSyncOpen(true)} className={buttonClassName('secondary', 'whitespace-nowrap')}>
            Review
          </button>
        }
      />,
    )
  }
  for (const delivery of due.slice(0, SHOWN_PER_KIND)) {
    rows.push(
      <NeedRow
        key={`delivery-${delivery.id}`}
        icon={<Truck className="h-5 w-5 text-neutral-500" aria-hidden="true" />}
        title={delivery.title}
        detail={
          delivery.expectedDate != null && delivery.expectedDate < today
            ? `Overdue · ${delivery.outstandingLines} ${delivery.outstandingLines === 1 ? 'line' : 'lines'} still to come`
            : `Due today · ${delivery.outstandingLines} ${delivery.outstandingLines === 1 ? 'line' : 'lines'}`
        }
        action={
          <Link to={`/app/products/receive?expected=${delivery.id}`} className={buttonClassName('secondary', 'whitespace-nowrap')}>
            Receive
          </Link>
        }
      />,
    )
  }
  for (const [kind, products] of [
    ['OUT', out.products],
    ['LOW', low.products],
  ] as const) {
    for (const product of products) {
      rows.push(
        <NeedRow
          key={`${kind}-${product.id}`}
          icon={<PackageX className={`h-5 w-5 ${kind === 'OUT' ? 'text-danger-600' : 'text-warning-600'}`} aria-hidden="true" />}
          title={
            <Link to={`/app/products/${product.id}`} className="hover:underline">
              {product.name}
            </Link>
          }
          detail={kind === 'OUT' ? 'Out of stock' : 'Running low'}
          figure={<StockFigure quantity={product.quantityOnHand} unit={resolveUnitSymbol(product.unitOfMeasure, options)} align="end" />}
          action={
            canStockIn ? (
              <button
                type="button"
                onClick={() => stockActions.open('in', product)}
                className={buttonClassName('secondary', 'whitespace-nowrap')}
                aria-label={`Stock in ${product.name}`}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                {/* On a phone the "+" alone, so the product's name keeps the room. */}
                <span className="hidden sm:inline">Stock in</span>
              </button>
            ) : null
          }
        />,
      )
    }
  }
  for (const draft of drafts) {
    const summary = describeDraft(draft)
    rows.push(
      <NeedRow
        key={`draft-${draft.key}`}
        icon={<ClipboardList className="h-5 w-5 text-neutral-500" aria-hidden="true" />}
        title={`Unfinished: ${summary.title.toLowerCase()}`}
        detail={summary.detail ?? 'Saved on this phone'}
        action={
          <Link to={summary.to} className={buttonClassName('secondary', 'whitespace-nowrap')}>
            Continue
          </Link>
        }
      />,
    )
  }
  if (dataIssues.issues.length > 0) {
    const count = dataIssues.issues.length
    rows.push(
      <NeedRow
        key="data-issues"
        icon={<Wrench className="h-5 w-5 text-warning-700" aria-hidden="true" />}
        title={`${count} ${count === 1 ? 'product needs' : 'products need'} a quick fix`}
        detail="A damaged code, a missing unit, or a pack size that looks wrong."
        action={
          <Link to="/app/products/fix" className={buttonClassName('secondary', 'whitespace-nowrap')}>
            Fix them
          </Link>
        }
      />,
    )
  }

  const moreLow = low.total > low.products.length || out.total > out.products.length
  return (
    <section aria-labelledby="needs-you-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="needs-you-heading" className="text-base font-semibold text-neutral-900">
          Needs you today
        </h2>
        {moreLow && (
          <Link to="/app/products?stockStatus=LOW" className="text-sm font-medium text-primary-700 hover:underline">
            All {low.total} low · {out.total} out
          </Link>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-5 py-4 text-sm text-neutral-700">
          <CheckCircle2 className="h-5 w-5 text-accent-600" aria-hidden="true" />
          Nothing needs you right now.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">{rows}</ul>
      )}
      {stockActions.sheet}
      <SyncCentre open={syncOpen} onClose={() => setSyncOpen(false)} />
    </section>
  )
}

function NeedRow({
  icon,
  title,
  detail,
  badge,
  figure,
  action,
}: {
  icon: ReactNode
  title: ReactNode
  detail: string
  badge?: ReactNode
  figure?: ReactNode
  action: ReactNode
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3" data-need>
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-neutral-900">
          {title}
          {badge}
        </p>
        <p className="text-xs text-neutral-500">{detail}</p>
      </div>
      {figure && <div className="shrink-0">{figure}</div>}
      {action && <div className="shrink-0">{action}</div>}
    </li>
  )
}

/** The few products in one stock state with the least on hand, and how many there are in all. */
function useWorstStock(status: 'OUT' | 'LOW', onDevice: boolean): { products: Product[]; total: number } {
  const list = useCatalogList(
    { search: '', status: 'active', categoryId: '', stockStatus: status, sort: { field: 'quantityOnHand', direction: 'asc' } },
    onDevice,
  )
  const server = useProducts(
    { active: true, stockStatus: status, page: 0, size: SHOWN_PER_KIND, sort: 'quantityOnHand,asc' },
    { enabled: !onDevice },
  )
  const { loadRange } = list
  useEffect(() => {
    if (onDevice) loadRange(0, SHOWN_PER_KIND - 1)
  }, [onDevice, loadRange])
  if (!onDevice) return { products: server.data?.content ?? [], total: server.data?.totalElements ?? 0 }
  const products: Product[] = []
  for (let i = 0; i < Math.min(SHOWN_PER_KIND, list.total); i++) {
    const row = list.rowAt(i)
    if (row) products.push(row)
  }
  return { products, total: list.total }
}
