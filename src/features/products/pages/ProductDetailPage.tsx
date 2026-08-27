import { useEffect, useState } from 'react'
import { ArrowLeft, Pencil } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { PERMISSIONS } from '@/auth/permissions'
import { Button, buttonClassName } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useToast } from '@/components/useToast'
import { productsApi } from '@/features/products/api/productsApi'
import { IncomingStockBadge } from '@/features/products/components/IncomingStockBadge'
import { LowStockBadge } from '@/features/products/components/LowStockBadge'
import { ProductDetailSkeleton } from '@/features/products/components/ProductDetailSkeleton'
import { ProductImage } from '@/features/products/components/ProductImage'
import { StatusBadge } from '@/features/products/components/StatusBadge'
import { StockAdjustmentModal } from '@/features/products/components/StockAdjustmentModal'
import { StockBreakdownPanel } from '@/features/products/components/StockBreakdownPanel'
import { StockHistoryTable } from '@/features/products/components/StockHistoryTable'
import { StockInModal } from '@/features/products/components/StockInModal'
import { StockOutModal } from '@/features/products/components/StockOutModal'
import { formatCurrency, formatUnitOfMeasure } from '@/features/products/formatters'
import { useLowStockAlerts } from '@/features/products/hooks/useLowStockAlerts'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import { useProduct } from '@/features/products/hooks/useProduct'
import { useProductIncoming } from '@/features/products/hooks/useProductIncoming'
import { useStockHistory } from '@/features/products/hooks/useStockHistory'
import type { StockMutationResponse } from '@/features/products/types'
import { VendorsTab } from '@/features/products/vendors/components/VendorsTab'
import { isAppError } from '@/types/api'

type StockAction = 'in' | 'out' | 'adjustment' | null

type ProductDetailTab = 'overview' | 'vendors'

const DETAIL_TABS: { value: ProductDetailTab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'vendors', label: 'Vendors' },
]

function parseDetailTab(value: string | null): ProductDetailTab {
  return value === 'vendors' ? 'vendors' : 'overview'
}

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = parseDetailTab(searchParams.get('tab'))
  const { product, setProduct, loading, error } = useProduct(id)
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
  const [activeAction, setActiveAction] = useState<StockAction>(null)
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)
  const [deactivating, setDeactivating] = useState(false)

  // A duplicate-nudge match ("pick a match" on product creation) links here with
  // ?action=stock-in to jump straight into Stock In instead of leaving the user to find the
  // button themselves. Consumed once, then stripped from the URL so it doesn't reopen on a
  // back-navigation or refresh.
  useEffect(() => {
    if (searchParams.get('action') !== 'stock-in') return
    setActiveAction('in')
    setSearchParams(
      (previous) => {
        const params = new URLSearchParams(previous)
        params.delete('action')
        return params
      },
      { replace: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const canManageInventory = user?.type === 'tenant' && user.permissions.includes(PERMISSIONS.MANAGE_INVENTORY)
  const canManageProducts = user?.type === 'tenant' && user.permissions.includes(PERMISSIONS.MANAGE_PRODUCTS)

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

  function handleMutationSuccess(result: StockMutationResponse) {
    setProduct(result.product)
    setActiveAction(null)
    setHistoryPage(0)
    refetchHistory()
    refetchLowStockAlerts()
    showToast('Stock updated.', 'success')
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

  if (loading) return <ProductDetailSkeleton />

  if (error || !product) {
    return (
      <div className="rounded-md border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
        {error ?? 'Product not found.'}
      </div>
    )
  }

  const incoming = incomingFor(product)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => navigate('/app/products')}
            aria-label="Back to inventory"
            className="mt-0.5 rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-neutral-900">{product.name}</h1>
              <StatusBadge active={product.active} />
              {product.isLowStock && <LowStockBadge />}
              <IncomingStockBadge quantity={incoming.quantity} />
            </div>
            <p className="mt-0.5 text-sm text-neutral-500">SKU: {product.sku}</p>
          </div>
        </div>
        {canManageProducts && (
          <div className="flex items-center gap-2">
            <Link to={`/app/products/${product.id}/edit`} className={buttonClassName('secondary')}>
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
            {product.active && (
              <Button variant="danger" onClick={() => setConfirmDeactivate(true)}>
                Deactivate
              </Button>
            )}
          </div>
        )}
      </div>

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
          className="flex flex-col gap-6"
        >
          <div className="grid grid-cols-1 gap-6 rounded-lg border border-neutral-200 bg-white p-5 md:grid-cols-3">
            <ProductImage
              src={product.imageUrl}
              alt={product.name}
              className="h-40 w-40 rounded-lg"
              iconClassName="h-10 w-10"
            />
            <div className="md:col-span-2">
              <dl className="grid grid-cols-2 gap-4 text-sm">
            {/* Structurally absent, not blank, for a buying company: `unitPrice` is `null` on
                every one of their products (it is a marketplace selling price, meaningless for
                private stock), and a "Unit price" row rendering an em dash on every product
                would read as broken rather than as "not applicable". `isVendor` and "value
                present" agree in practice — a company's is always null — so gating on the
                value is enough and needs no extra import here. */}
            {product.unitPrice != null && (
              <div>
                <dt className="text-neutral-500">Unit price</dt>
                <dd className="mt-0.5 font-medium text-neutral-900">{formatCurrency(product.unitPrice)}</dd>
              </div>
            )}
            <div>
              <dt className="text-neutral-500">Cost price</dt>
              <dd className="mt-0.5 font-medium text-neutral-900">{formatCurrency(product.costPrice)}</dd>
            </div>
            {/* How this product is measured and — optionally — packaged, shown for BOTH tenant
                types when set, unlike unit price. `unitOfMeasure`/`packagingUnit` on the product
                are wire CODEs ("KG", "BAG"), not something to show a reader directly, so each is
                resolved to its label via the same static list the form's pickers use before
                formatting. */}
            {(product.unitOfMeasure || product.packagingUnit || product.packagingSize != null) && (
              <div className="col-span-2">
                <dt className="text-neutral-500">Unit of measure</dt>
                <dd className="mt-0.5 font-medium text-neutral-900">
                  {formatUnitOfMeasure(
                    unitOfMeasureOptions.find((option) => option.code === product.unitOfMeasure)?.label,
                    unitOfMeasureOptions.find((option) => option.code === product.packagingUnit)?.label,
                    product.packagingSize,
                  )}
                </dd>
              </div>
            )}
            {/* Where this stock comes from. Rendered even when unset, as an em dash, rather than
                hidden: an absent row reads as "this product has no supplier concept", where a dash
                reads as "nobody has said yet" — and the second is the true one.

                A product can now have many vendors (see the Vendors tab), so this row shows only
                the preferred one — `preferredVendorName` has no id/kind alongside it (unlike the
                old single `companyVendorId`/`companyVendorName`/`companyVendorKind` trio), so it
                renders as plain text with a link into the Vendors tab for the full picture, rather
                than linking straight to a vendor detail page it no longer has an id for. */}
            <div className="col-span-2">
              <dt className="text-neutral-500">Preferred vendor</dt>
              <dd className="mt-0.5 flex flex-wrap items-center gap-2">
                {product.preferredVendorName ? (
                  <span className="font-medium text-neutral-900">{product.preferredVendorName}</span>
                ) : (
                  <span className="text-neutral-400">—</span>
                )}
                <Link
                  to={{ search: '?tab=vendors' }}
                  className="text-xs font-medium text-primary-600 hover:underline"
                >
                  View vendors
                </Link>
              </dd>
            </div>
          </dl>
          <div className="mt-4">
            <p className="text-sm text-neutral-500">Description</p>
            <p className="mt-0.5 text-sm text-neutral-700">{product.description || 'No description provided.'}</p>
          </div>
        </div>
      </div>

      <StockBreakdownPanel
        product={product}
        incoming={incoming}
        actions={
          canManageInventory ? (
            <>
              <Button variant="secondary" onClick={() => setActiveAction('in')}>
                Stock In
              </Button>
              <Button variant="secondary" onClick={() => setActiveAction('out')}>
                Stock Out
              </Button>
              <Button variant="secondary" onClick={() => setActiveAction('adjustment')}>
                Adjust
              </Button>
            </>
          ) : undefined
        }
      />

      <div>
        <h2 className="mb-3 text-base font-semibold text-neutral-900">Movement history</h2>
        <StockHistoryTable
          data={history}
          loading={historyLoading}
          error={historyError}
          page={historyPage}
          onPageChange={setHistoryPage}
        />
      </div>
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

      {activeAction === 'in' && (
        <StockInModal product={product} onClose={() => setActiveAction(null)} onSuccess={handleMutationSuccess} />
      )}
      {activeAction === 'out' && (
        <StockOutModal product={product} onClose={() => setActiveAction(null)} onSuccess={handleMutationSuccess} />
      )}
      {activeAction === 'adjustment' && (
        <StockAdjustmentModal
          productId={product.id}
          currentQuantity={product.quantityOnHand}
          onClose={() => setActiveAction(null)}
          onSuccess={handleMutationSuccess}
        />
      )}

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
