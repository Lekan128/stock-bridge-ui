import { useEffect, useState, type ReactNode } from 'react'
import { ArrowLeft, Minus, Pencil, Plus } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { PERMISSIONS } from '@/auth/permissions'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { SavedDataNote } from '@/components/SavedDataNote'
import { useOutboxState } from '@/features/outbox/useOutbox'
import { useToast } from '@/components/useToast'
import { productsApi } from '@/features/products/api/productsApi'
import { ProductActionBar } from '@/features/products/components/ProductActionBar'
import { ProductDetailSkeleton } from '@/features/products/components/ProductDetailSkeleton'
import { ProductImage } from '@/features/products/components/ProductImage'
import { StatusBadge } from '@/features/products/components/StatusBadge'
import { StockBreakdownPanel } from '@/features/products/components/StockBreakdownPanel'
import { StockHistoryTable } from '@/features/products/components/StockHistoryTable'
import { useLowStockAlerts } from '@/features/products/hooks/useLowStockAlerts'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import { useProduct } from '@/features/products/hooks/useProduct'
import { useProductIncoming } from '@/features/products/hooks/useProductIncoming'
import { useStockActions } from '@/features/products/hooks/useStockActions'
import { useStockHistory } from '@/features/products/hooks/useStockHistory'
import {
  UNIT_COPY,
  formatPackCostEcho,
  formatPricePer,
  packPhrase,
  stockUnitSymbol,
} from '@/features/products/unitCopy'
import type { StockMovement } from '@/features/products/types'
import { buildPackOption } from '@/features/products/unitSet'
import { VendorsTab } from '@/features/products/vendors/components/VendorsTab'
import { isAppError } from '@/types/api'
import { OverflowMenu, type OverflowMenuItem } from '@/components/OverflowMenu'


type ProductDetailTab = 'overview' | 'vendors'

const DETAIL_TABS: { value: ProductDetailTab; label: string }[] = [
  { value: 'overview', label: 'Details and history' },
  { value: 'vendors', label: UNIT_COPY.SUPPLIERS },
]

function parseDetailTab(value: string | null): ProductDetailTab {
  return value === 'vendors' ? 'vendors' : 'overview'
}

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = parseDetailTab(searchParams.get('tab'))
  const { product, setProduct, loading, error, showingSaved, updatedAt, refetch: refetchProduct } = useProduct(id)
  const { options: unitOfMeasureOptions } = useUnitOfMeasureOptions()
  const { refetch: refetchLowStockAlerts } = useLowStockAlerts()
  // A single-element array so the hook's "does the API send incomingQuantity?" check works the
  // same way here as it does on the list.
  const { incomingFor } = useProductIncoming(product ? [product] : undefined)
  const [historyPage, setHistoryPage] = useState(0)
  const { data: history, loading: historyLoading, error: historyError, refetch: refetchHistory } = useStockHistory(
    id,
    historyPage,
  )
  // Stock in / out / count, and the toast with Undo after — shared with the Inventory list (C1).
  const stockActions = useStockActions({
    onChanged: (changed) => {
      setProduct(changed)
      setHistoryPage(0)
      refetchHistory()
      refetchLowStockAlerts()
    },
  })
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)
  const [deactivating, setDeactivating] = useState(false)
  /**
   * No confirmation dialog on the way back in, unlike deactivation. Putting a product back into
   * circulation is not destructive and is itself trivially undoable by the button that replaces
   * this one, so a modal would only be a speed bump in front of a reversible act.
   */
  const [activating, setActivating] = useState(false)

  // A duplicate-nudge match ("pick a match" on product creation) links here with
  // ?action=stock-in to jump straight into Stock In instead of leaving the user to find the
  // button themselves. Consumed once, then stripped from the URL so it doesn't reopen on a
  // back-navigation or refresh.
  useEffect(() => {
    if (searchParams.get('action') !== 'stock-in' || !product) return
    stockActions.open('in', product)
    setSearchParams(
      (previous) => {
        const params = new URLSearchParams(previous)
        params.delete('action')
        return params
      },
      { replace: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, product?.id])

  const canManageInventory = user?.type === 'tenant' && user.permissions.includes(PERMISSIONS.MANAGE_INVENTORY)
  const canManageProducts = user?.type === 'tenant' && user.permissions.includes(PERMISSIONS.MANAGE_PRODUCTS)
  // Independently grantable since V27 — a role may receive stock, issue it, both or neither,
  // separately from MANAGE_INVENTORY (which still gates Adjust below). See StockController.
  const canStockIn = user?.type === 'tenant' && user.permissions.includes(PERMISSIONS.STOCK_IN)
  const canStockOut = user?.type === 'tenant' && user.permissions.includes(PERMISSIONS.STOCK_OUT)

  /**
   * Back to wherever the user came from — usually the Inventory list WITH its search, filters
   * and page, which now live in that page's URL. Navigating to a fresh `/app/products` instead
   * threw all of that away on the most common round trip on the screen. A product opened directly
   * (a pasted link, a new tab) has nothing to go back to inside the app, so it falls back to the
   * list; react-router marks that first entry with the key "default".
   */
  function goBack() {
    if (location.key !== 'default') navigate(-1)
    else navigate('/app/products')
  }

  function setTab(next: ProductDetailTab) {
    setSearchParams(
      (previous) => {
        const params = new URLSearchParams(previous)
        if (next === 'overview') params.delete('tab')
        else params.set('tab', next)
        return params
      },
      { replace: true },
    )
  }

  async function handleDeactivate() {
    if (!id) return
    setDeactivating(true)
    try {
      await productsApi.deactivate(id)
      setProduct((prev) => (prev ? { ...prev, active: false } : prev))
      setConfirmDeactivate(false)
      showToast('Product deactivated.', 'success')
    } catch (err) {
      showToast(isAppError(err) ? err.message : 'Could not deactivate the product.', 'error')
    } finally {
      setDeactivating(false)
    }
  }

  async function handleActivate() {
    if (!id) return
    setActivating(true)
    try {
      await productsApi.activate(id)
      setProduct((prev) => (prev ? { ...prev, active: true } : prev))
      showToast('Product activated.', 'success')
    } catch (err) {
      showToast(isAppError(err) ? err.message : 'Could not activate the product.', 'error')
    } finally {
      setActivating(false)
    }
  }

  // The newest movement, for the hero's "last movement" line: page one's first row, kept while
  // the history is paged further back.
  const [lastMovement, setLastMovement] = useState<StockMovement | null>(null)
  useEffect(() => {
    if (historyPage === 0 && history) setLastMovement(history.content[0] ?? null)
  }, [history, historyPage])
  // This product's writes still waiting on this phone, shown first in the history (C2).
  const { ops } = useOutboxState()
  const pending = ops.filter((op) => op.productId === id)

  if (loading) return <ProductDetailSkeleton />

  if (error || !product) {
    return (
      <div className="rounded-md border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
        {error ?? 'Product not found.'}
      </div>
    )
  }

  const incoming = incomingFor(product)

  // `unitOfMeasure`/`packagingUnit` are wire CODEs ("KG", "BAG"), never something to show a reader,
  // so each is resolved to its label against the same static list the form's pickers use. The two
  // are then rendered as UNIT_UX_CONTRACT.md §1's TWO concepts — Stock unit, and the Pack phrase
  // "Bag of 50 kg" — rather than run together into one "Unit of measure" line. That collapse is
  // exactly what the remediation plan's §2 vocabulary table records: one row that means the stock
  // unit on some products and the pack on others, under a name §1 bans.
  const stockUnitLabel = unitOfMeasureOptions.find((option) => option.code === product.unitOfMeasure)?.label
  const stockUnitText = stockUnitSymbol(stockUnitLabel)
  const packLabel = packPhrase(
    unitOfMeasureOptions.find((option) => option.code === product.packagingUnit)?.label,
    product.packagingSize,
    stockUnitText,
  )
  /**
   * This product's pack as a `UnitOption`, for `UNIT_UX_CONTRACT.md` §9.2's per-pack cost echo on
   * the two price rows below. `null` for a product sold loose, which is the case the echo has
   * nothing to add to — see `unitCopy.formatPackCostEcho`.
   */
  const packOption = buildPackOption(product, stockUnitText, unitOfMeasureOptions)
  const unitPricePackEcho = formatPackCostEcho(product.unitPrice, packOption)
  const costPricePackEcho = formatPackCostEcho(product.costPrice, packOption)

  // Stock in / out / count: inside the hero from a laptop up, in a bar pinned to the bottom on a phone.
  const stockButtons =
    canStockIn || canStockOut || canManageInventory ? (
      <>
        {canStockIn && (
          <Button variant="action" onClick={() => stockActions.open('in', product)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Stock in
          </Button>
        )}
        {canStockOut && (
          <Button variant="secondary" onClick={() => stockActions.open('out', product)}>
            <Minus className="h-4 w-4" aria-hidden="true" />
            Stock out
          </Button>
        )}
        {canManageInventory && (
          <Button variant="secondary" onClick={() => stockActions.open('count', product)}>
            Count
          </Button>
        )}
      </>
    ) : null

  // Edit and the rare, destructive things live in "⋯" (C2, finding U3); Deactivate behind its confirmation.
  const menuItems: OverflowMenuItem[] = canManageProducts
    ? [
        {
          label: 'Edit product',
          icon: <Pencil className="h-4 w-4 text-neutral-500" aria-hidden="true" />,
          onSelect: () => navigate(`/app/products/${product.id}/edit`),
        },
        product.active
          ? { label: 'Deactivate', tone: 'danger', onSelect: () => setConfirmDeactivate(true) }
          : { label: activating ? 'Activating…' : 'Activate', onSelect: () => void handleActivate(), disabled: activating },
      ]
    : []

  return (
    // Room at the bottom on a phone for the action bar pinned there.
    <div className={`flex flex-col gap-6 ${stockButtons ? 'pb-20 md:pb-0' : ''}`}>
      {/* The name, small: the photo is a thumbnail beside it now (C2), not a 160px block above the stock. */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <button
            type="button"
            onClick={goBack}
            aria-label="Back"
            className="mt-1 rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <ProductImage src={product.imageUrl} alt={product.name} className="h-12 w-12 shrink-0 rounded-md" iconClassName="h-5 w-5" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-neutral-900 sm:text-2xl">{product.name}</h1>
              {!product.active && <StatusBadge active={false} />}
            </div>
            <p className="mt-0.5 truncate text-sm text-neutral-500">
              SKU: {product.sku}
              {product.categoryName != null && ` · ${product.categoryName}`}
            </p>
          </div>
        </div>
        {menuItems.length > 0 && <OverflowMenu label={`More actions for ${product.name}`} items={menuItems} />}
      </div>

      <SavedDataNote showing={showingSaved} updatedAt={updatedAt} subject="this product" onRetry={refetchProduct} />

      {/* The hero, first (C2; plan §2 "the number is the hero"): on hand with its packs and anything
          waiting on this phone, the bar against the alert level, what is on the way, the last
          movement — and the stock actions beside it. */}
      <StockBreakdownPanel product={product} incoming={incoming} actions={stockButtons ?? undefined} lastMovement={lastMovement} />

      <div role="tablist" aria-label="Product detail" className="flex gap-1 border-b border-neutral-200">
        {DETAIL_TABS.map((option) => {
          const selected = option.value === tab
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              id={`product-detail-tab-${option.value}`}
              aria-selected={selected}
              aria-controls={`product-detail-panel-${option.value}`}
              onClick={() => setTab(option.value)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none ${
                selected
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      {tab === 'overview' && (
        <div
          role="tabpanel"
          id="product-detail-panel-overview"
          aria-labelledby="product-detail-tab-overview"
          className="flex flex-col gap-8"
        >
          {/* Prices, units, pack and supplier: needed, but not the reason anyone opened this page —
              so a quiet ruled list below the stock, not a card above it (C2). */}
          <section aria-labelledby="product-details-heading" className="flex flex-col gap-3">
            <h2 id="product-details-heading" className="text-base font-semibold text-neutral-900">
              Details
            </h2>
            <dl className="grid grid-cols-1 gap-x-8 border-t border-neutral-200 text-sm sm:grid-cols-2">
              {/* A buying company's unit price is always null (a marketplace selling price), so the
                  row is absent rather than an em dash on every product. */}
              {product.unitPrice != null && (
                <DetailRow label="Unit price">
                  <span className="font-medium text-neutral-900">{formatPricePer(product.unitPrice, stockUnitText)}</span>
                  {unitPricePackEcho && <span className="block text-xs text-neutral-500">{unitPricePackEcho}</span>}
                </DetailRow>
              )}
              {/* `costPrice` is a weighted average per ONE stock unit (§9.2), so the row names its
                  basis and echoes the pack equivalent — "₦1,463.20 / kg, = ₦73,160 / bag". */}
              <DetailRow label="Cost price">
                <span className="font-medium text-neutral-900">{formatPricePer(product.costPrice, stockUnitText)}</span>
                {costPricePackEcho && <span className="block text-xs text-neutral-500">{costPricePackEcho}</span>}
              </DetailRow>
              {stockUnitLabel && (
                <DetailRow label={UNIT_COPY.STOCK_UNIT}>
                  <span className="font-medium text-neutral-900">{stockUnitLabel}</span>
                </DetailRow>
              )}
              {packLabel && (
                <DetailRow label={UNIT_COPY.PACK}>
                  <span className="font-medium text-neutral-900">
                    {packLabel}
                    {product.hasMultiplePacks && <span className="font-normal text-neutral-500"> (default)</span>}
                  </span>
                  {product.hasMultiplePacks && (
                    <Link to={{ search: '?tab=vendors' }} className="ml-2 text-xs font-medium text-primary-600 hover:underline">
                      View packs
                    </Link>
                  )}
                </DetailRow>
              )}
              {/* An em dash, not an absent row: "nobody has said yet" is the true reading. Only the
                  preferred supplier; the Suppliers tab has the rest. */}
              <DetailRow label={`Preferred ${UNIT_COPY.SUPPLIER.toLowerCase()}`}>
                {product.preferredVendorName ? (
                  <span className="font-medium text-neutral-900">{product.preferredVendorName}</span>
                ) : (
                  <span className="text-neutral-500">—</span>
                )}
                <Link to={{ search: '?tab=vendors' }} className="ml-2 text-xs font-medium text-primary-600 hover:underline">
                  View {UNIT_COPY.SUPPLIERS.toLowerCase()}
                </Link>
              </DetailRow>
              <DetailRow label="Description" wide>
                <span className="text-neutral-700">{product.description || 'No description provided.'}</span>
              </DetailRow>
            </dl>
          </section>

          <section aria-labelledby="product-history-heading" className="flex flex-col gap-3">
            <h2 id="product-history-heading" className="text-base font-semibold text-neutral-900">
              Movement history
            </h2>
            <StockHistoryTable
              data={history}
              loading={historyLoading}
              error={historyError}
              page={historyPage}
              onPageChange={setHistoryPage}
              stockUnit={stockUnitText}
              unitOfMeasureOptions={unitOfMeasureOptions}
              pending={pending}
            />
          </section>
        </div>
      )}

      {tab === 'vendors' && (
        <div
          role="tabpanel"
          id="product-detail-panel-vendors"
          aria-labelledby="product-detail-tab-vendors"
          className="flex flex-col gap-4"
        >
          <VendorsTab product={product} canManage={canManageInventory} />
        </div>
      )}

      {stockButtons && <ProductActionBar>{stockButtons}</ProductActionBar>}

      {stockActions.sheet}

      <ConfirmDialog
        open={confirmDeactivate}
        title="Deactivate product"
        message={`Are you sure you want to deactivate ${product.name}? It will no longer appear in active product lists.`}
        confirmLabel="Deactivate"
        loading={deactivating}
        onConfirm={() => void handleDeactivate()}
        onCancel={() => setConfirmDeactivate(false)}
      />
    </div>
  )
}

/** One ruled line of the Details list: label above, value below. */
function DetailRow({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={`border-b border-neutral-100 py-3 ${wide ? 'sm:col-span-2' : ''}`}>
      <dt className="text-neutral-500">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  )
}
