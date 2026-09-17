import { useState, type FormEvent, type ReactNode } from 'react'
import { ArrowLeft, PackageCheck, Pencil } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { Button, buttonClassName } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/Skeleton'
import { TextField } from '@/components/TextField'
import { useToast } from '@/components/useToast'
import { productsApi } from '@/features/products/api/productsApi'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import {
  productDataIssuesApi,
  type ProductDataIssue,
  type ProductDataIssueCode,
  type ProductDataIssueDetail,
} from '@/features/products/quality/api'
import { useProductDataIssues } from '@/features/products/quality/useProductDataIssues'
import { formatNumber, UNIT_COPY } from '@/features/products/unitCopy'
import { resolveUnitSymbol } from '@/features/products/unitSet'
import { isAppError } from '@/types/api'

function errorMessage(err: unknown): string {
  return isAppError(err) ? err.message : 'Something went wrong. Please try again.'
}

/**
 * The one-time cleanup screen behind the product list's "Fix them" banner (plan task 1.8). Each
 * fix drops its issue locally rather than refetching, so the card the owner is looking at never
 * jumps; a product with nothing left leaves the list.
 *
 * The route needs only VIEW_PRODUCTS, like the list that links here. Without MANAGE_PRODUCTS the
 * same cards render with no controls, since the server would refuse every save anyway.
 */
export function FixProductDetailsPage() {
  const { user } = useAuth()
  const permissions = user?.type === 'tenant' ? user.permissions : []
  const canManageProducts = permissions.includes(PERMISSIONS.MANAGE_PRODUCTS)
  const { issues, setIssues, loading, error, refetch } = useProductDataIssues()

  function handleFixed(productId: string, code: ProductDataIssueCode, sku?: string) {
    setIssues((current) =>
      current
        .map((product) =>
          product.productId === productId
            ? {
                ...product,
                sku: sku ?? product.sku,
                issues: product.issues.filter((issue) => issue.code !== code),
              }
            : product,
        )
        .filter((product) => product.issues.length > 0),
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link
          to="/app/products"
          aria-label="Back to inventory"
          className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Fix product details</h1>
          <p className="text-sm text-neutral-500">A few products were saved in a way that needs a quick fix.</p>
        </div>
      </div>

      {loading && (
        <div className="flex flex-col gap-3" aria-hidden="true">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-32 w-full" />
          ))}
        </div>
      )}

      {!loading && error && <ErrorState message={error} onRetry={refetch} />}

      {!loading && !error && issues.length === 0 && (
        <EmptyState
          icon={PackageCheck}
          tone="positive"
          title="All your products look right."
          description="There's nothing left to fix."
          action={
            <Link to="/app/products" className={buttonClassName('secondary')}>
              Back to inventory
            </Link>
          }
        />
      )}

      {!loading && !error && issues.length > 0 && (
        <>
          {!canManageProducts && (
            <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
              You can see what needs fixing, but not change it. Ask someone who manages products to fix these.
            </p>
          )}
          <ul className="flex flex-col gap-3">
            {issues.map((product) => (
              <li key={product.productId}>
                <ProductIssuesCard product={product} canManageProducts={canManageProducts} onFixed={handleFixed} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

interface ProductIssuesCardProps {
  product: ProductDataIssue
  canManageProducts: boolean
  onFixed: (productId: string, code: ProductDataIssueCode, sku?: string) => void
}

function ProductIssuesCard({ product, canManageProducts, onFixed }: ProductIssuesCardProps) {
  return (
    <section
      aria-labelledby={`fix-${product.productId}-name`}
      className="rounded-lg border border-neutral-200 bg-white p-4"
    >
      <h2 id={`fix-${product.productId}-name`} className="text-base font-semibold text-neutral-900">
        {product.name}
      </h2>
      <p className="text-sm text-neutral-500">Code: {product.sku}</p>

      <div className="mt-3 flex flex-col divide-y divide-neutral-100">
        {product.issues.map((issue) => (
          <div key={issue.code} className="py-3 first:pt-0 last:pb-0">
            <IssueFix product={product} issue={issue} canManageProducts={canManageProducts} onFixed={onFixed} />
          </div>
        ))}
      </div>
    </section>
  )
}

interface IssueFixProps extends ProductIssuesCardProps {
  issue: ProductDataIssueDetail
}

function IssueFix({ product, issue, canManageProducts, onFixed }: IssueFixProps) {
  const message = <p className="text-sm text-neutral-700">{issue.message}</p>

  if (!canManageProducts) {
    return (
      <div className="flex flex-col gap-1">
        {message}
        {issue.code === 'DAMAGED_CODE' && issue.suggestedCode != null && (
          <p className="text-sm text-neutral-500">Suggested code: {issue.suggestedCode}</p>
        )}
      </div>
    )
  }

  switch (issue.code) {
    case 'DAMAGED_CODE':
      return (
        <DamagedCodeFix
          product={product}
          suggestedCode={issue.suggestedCode ?? undefined}
          message={message}
          onFixed={(sku) => onFixed(product.productId, issue.code, sku)}
        />
      )
    case 'NO_STOCK_UNIT':
      return <NoUnitFix product={product} message={message} onFixed={() => onFixed(product.productId, issue.code)} />
    default:
      // A wrong-looking unit or pack size needs the owner's judgement, not a one-click fix.
      return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {message}
          <Link
            to={`/app/products/${product.productId}/edit`}
            className={buttonClassName('secondary', 'shrink-0 py-2')}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Edit product
          </Link>
        </div>
      )
  }
}

interface DamagedCodeFixProps {
  product: ProductDataIssue
  suggestedCode: string | undefined
  message: ReactNode
  onFixed: (sku: string) => void
}

function DamagedCodeFix({ product, suggestedCode, message, onFixed }: DamagedCodeFixProps) {
  const { showToast } = useToast()
  const [code, setCode] = useState(suggestedCode ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      // Blank means "you pick": the server uses its suggestion or generates one.
      const updated = await productDataIssuesApi.fixCode(product.productId, code.trim() || undefined)
      showToast(`${product.name}'s code is now ${updated.sku}.`, 'success')
      onFixed(updated.sku)
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} noValidate className="flex flex-col gap-3">
      {message}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="sm:w-64">
          <TextField
            id={`fix-code-${product.productId}`}
            label="New code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            hint={suggestedCode == null && code.trim() === '' ? "We'll generate a new code for you." : undefined}
            error={error ?? undefined}
            autoComplete="off"
          />
        </div>
        <Button type="submit" loading={saving} className="sm:mt-7">
          Save code
        </Button>
      </div>
    </form>
  )
}

interface NoUnitFixProps {
  product: ProductDataIssue
  message: ReactNode
  onFixed: () => void
}

function NoUnitFix({ product, message, onFixed }: NoUnitFixProps) {
  const { showToast } = useToast()
  const { options, baseOptions, loading: unitsLoading, error: unitsError } = useUnitOfMeasureOptions()
  const [unit, setUnit] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectId = `fix-unit-${product.productId}`
  const quantity = formatNumber(product.quantityOnHand)
  const symbol = unit ? resolveUnitSymbol(unit, options) : ''

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!unit) return
    setSaving(true)
    setError(null)
    try {
      await productsApi.update(product.productId, { unitOfMeasure: unit })
      showToast(`${product.name} is now counted in ${symbol}.`, 'success')
      onFixed()
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} noValidate className="flex flex-col gap-3">
      {message}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-64">
          <label htmlFor={selectId} className="mb-1.5 block text-sm font-medium text-neutral-700">
            {UNIT_COPY.STOCK_UNIT}
          </label>
          <select
            id={selectId}
            value={unit}
            onChange={(event) => {
              setUnit(event.target.value)
              setError(null)
            }}
            disabled={unitsLoading || saving}
            aria-describedby={`${selectId}-effect`}
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400"
          >
            <option value="">{unitsLoading ? 'Loading units…' : 'Choose a unit'}</option>
            {baseOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" loading={saving} disabled={!unit}>
          Save unit
        </Button>
      </div>
      {/* Choosing a unit decides what the existing number means, so say so before saving. */}
      <p id={`${selectId}-effect`} aria-live="polite" className="text-sm text-neutral-600">
        {unit
          ? `Your ${quantity} in stock will be ${quantity} ${symbol}.`
          : `Choose the unit your ${quantity} in stock is counted in.`}
      </p>
      {unitsError && <p className="text-sm text-danger-600">{unitsError}</p>}
      {error && (
        <p role="alert" className="text-sm text-danger-600">
          {error}
        </p>
      )}
    </form>
  )
}
