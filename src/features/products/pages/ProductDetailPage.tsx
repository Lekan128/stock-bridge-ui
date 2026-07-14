import { useState } from 'react'
import { ArrowLeft, Pencil } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { PERMISSIONS } from '@/auth/permissions'
import { Button, buttonClassName } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useToast } from '@/components/useToast'
import { productsApi } from '@/features/products/api/productsApi'
import { LowStockBadge } from '@/features/products/components/LowStockBadge'
import { ProductDetailSkeleton } from '@/features/products/components/ProductDetailSkeleton'
import { ProductImage } from '@/features/products/components/ProductImage'
import { StatusBadge } from '@/features/products/components/StatusBadge'
import { StockAdjustmentModal } from '@/features/products/components/StockAdjustmentModal'
import { StockHistoryTable } from '@/features/products/components/StockHistoryTable'
import { StockQuantityModal } from '@/features/products/components/StockQuantityModal'
import { formatCurrency } from '@/features/products/formatters'
import { useLowStockAlerts } from '@/features/products/hooks/useLowStockAlerts'
import { useProduct } from '@/features/products/hooks/useProduct'
import { useStockHistory } from '@/features/products/hooks/useStockHistory'
import type { StockMutationResponse } from '@/features/products/types'
import { isAppError } from '@/types/api'

type StockAction = 'in' | 'out' | 'adjustment' | null

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { product, setProduct, loading, error } = useProduct(id)
  const { refetch: refetchLowStockAlerts } = useLowStockAlerts()
  const [historyPage, setHistoryPage] = useState(0)
  const { data: history, loading: historyLoading, error: historyError, refetch: refetchHistory } = useStockHistory(
    id,
    historyPage,
  )
  const [activeAction, setActiveAction] = useState<StockAction>(null)
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)
  const [deactivating, setDeactivating] = useState(false)

  const canManageInventory = user?.type === 'tenant' && user.permissions.includes(PERMISSIONS.MANAGE_INVENTORY)

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => navigate('/products')}
            aria-label="Back to products"
            className="mt-0.5 rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-neutral-900">{product.name}</h1>
              <StatusBadge active={product.active} />
              {product.isLowStock && <LowStockBadge />}
            </div>
            <p className="mt-0.5 text-sm text-neutral-500">SKU: {product.sku}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/products/${product.id}/edit`} className={buttonClassName('secondary')}>
            <Pencil className="h-4 w-4" />
            Edit
          </Link>
          {product.active && (
            <Button variant="danger" onClick={() => setConfirmDeactivate(true)}>
              Deactivate
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 rounded-lg border border-neutral-200 bg-white p-5 md:grid-cols-3">
        <ProductImage src={product.imageUrl} alt={product.name} className="h-40 w-40 rounded-lg" iconClassName="h-10 w-10" />
        <div className="md:col-span-2">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-neutral-500">Unit price</dt>
              <dd className="mt-0.5 font-medium text-neutral-900">{formatCurrency(product.unitPrice)}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Cost price</dt>
              <dd className="mt-0.5 font-medium text-neutral-900">{formatCurrency(product.costPrice)}</dd>
            </div>
          </dl>
          <div className="mt-4">
            <p className="text-sm text-neutral-500">Description</p>
            <p className="mt-0.5 text-sm text-neutral-700">{product.description || 'No description provided.'}</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-neutral-500">Quantity on hand</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-3xl font-semibold text-neutral-900">{product.quantityOnHand}</span>
              {product.isLowStock && <LowStockBadge />}
            </div>
          </div>
          {canManageInventory && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setActiveAction('in')}>
                Stock In
              </Button>
              <Button variant="secondary" onClick={() => setActiveAction('out')}>
                Stock Out
              </Button>
              <Button variant="secondary" onClick={() => setActiveAction('adjustment')}>
                Adjust
              </Button>
            </div>
          )}
        </div>
      </div>

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

      {(activeAction === 'in' || activeAction === 'out') && (
        <StockQuantityModal
          direction={activeAction}
          productId={product.id}
          currentQuantity={product.quantityOnHand}
          onClose={() => setActiveAction(null)}
          onSuccess={handleMutationSuccess}
        />
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
