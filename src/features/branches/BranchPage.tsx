import { BranchSellingPanel } from '@/features/selling/bills/BranchSellingPanel'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/Button'
import { api } from '@/api/client'
import { useApiQuery } from '@/data/useApiQuery'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { isAppError } from '@/types/api'
import { formatNairaWhole } from '@/utils/money'
import { formatNumber } from '@/features/products/unitCopy'
import type { PageResponse, Product } from '@/features/products/types'
import { branchesApi } from '@/features/branches/branchesApi'
import { BRANCHES_KEY } from '@/features/branches/BranchProvider'
import { useWorkingBranch } from '@/features/branches/useWorkingBranch'
import { AddBranchFlow } from '@/features/branches/AddBranchFlow'
import { AddAreasSheet } from '@/features/branches/AddAreasSheet'
import { AddBranchProductsSheet } from '@/features/branches/BranchProductPicker'
import { BranchAreas } from '@/features/branches/BranchAreas'
import { PaymentAccountsPanel } from '@/features/branches/PaymentAccountsPanel'
import { BranchEditor } from '@/features/branches/BranchesPage'

type Tab = 'areas' | 'accounts' | 'products' | 'selling'
const TABS: Tab[] = ['areas', 'accounts', 'products', 'selling']

/**
 * One branch's own page (owner, 2026-11-18: the Branches list was "one big list"): its figures, then Areas, Accounts
 * and Products as tabs. Edit, Make main and Close sit under its name. Opened from the Branches list, from the branch
 * chip's "Branch settings", and straight from Company at a company with one branch. `?tab=` opens a tab, so a link
 * from elsewhere lands where it means.
 */
export function BranchPage() {
  const { branchId } = useParams<{ branchId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { branches, isMultiBranch, mayAddBranch, mayAddArea, recordable, choose } = useWorkingBranch()
  const navigate = useNavigate()
  const online = useOnlineStatus()
  const queryClient = useQueryClient()
  const branch = branches.find((candidate) => candidate.id === branchId)
  const requested = searchParams.get('tab') as Tab | null
  const tab: Tab = requested && TABS.includes(requested) ? requested : 'areas'
  const [editing, setEditing] = useState(false)
  const [addingAreas, setAddingAreas] = useState(false)
  const [addingProducts, setAddingProducts] = useState(false)
  const [addingBranch, setAddingBranch] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const products = useApiQuery<PageResponse<Product>>({
    queryKey: ['branch-page-products', branchId],
    queryFn: () =>
      api
        .get<PageResponse<Product>>('/api/products', { params: { branchId, active: true, size: 100, page: 0, sort: 'name,asc' } })
        .then((r) => r.data),
    fallbackError: "Couldn't load the products.",
    enabled: !!branchId && tab === 'products',
  })

  if (branches.length > 0 && !branch) return <Navigate to="/app/company/branches" replace />
  if (!branch) return null

  async function act(action: () => Promise<unknown>) {
    setBusy(true)
    setProblem(null)
    try {
      await action()
      await queryClient.invalidateQueries({ queryKey: BRANCHES_KEY })
      setEditing(false)
    } catch (error) {
      setProblem(isAppError(error) ? error.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const accountCount = branch.paymentAccounts?.length ?? 0
  const areaCount = branch.areas?.filter((area) => area.active).length ?? 0
  const tabLabel: Record<Tab, string> = {
    areas: `Areas${areaCount > 1 ? ` · ${areaCount}` : ''}`,
    accounts: `Accounts${accountCount ? ` · ${accountCount}` : ''}`,
    products: `Products${products.data ? ` · ${formatNumber(products.data.totalElements)}` : ''}`,
    selling: 'Selling',
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {isMultiBranch && (
            <Link to="/app/company/branches" aria-label="All branches" className="mt-0.5 rounded-md p-1.5 text-neutral-600 hover:bg-neutral-100">
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </Link>
          )}
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-neutral-900">
              <span className="truncate">{branch.name}</span>
              {branch.main && isMultiBranch && <span className="rounded bg-primary-100 px-1.5 text-xs font-medium text-primary-800">Main</span>}
              {!branch.active && <span className="rounded bg-neutral-100 px-1.5 text-xs font-medium text-neutral-600">Closed</span>}
            </h1>
            {(branch.address || branch.phone) && (
              <p className="text-sm text-neutral-500">{[branch.address, branch.phone].filter(Boolean).join(' · ')}</p>
            )}
          </div>
        </div>
        {/* One branch: adding the second starts here - there is no list to start it from. */}
        {!isMultiBranch && mayAddBranch && (
          <Button variant="secondary" onClick={() => setAddingBranch(true)} disabled={!online}>
            Add a branch
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setEditing(true)} disabled={!online}>
          Edit
        </Button>
        {branch.active && !branch.main && (
          <Button variant="secondary" loading={busy} disabled={!online} onClick={() => void act(() => branchesApi.makeMain(branch.id))}>
            Make main branch
          </Button>
        )}
        {branch.active && !branch.main && (
          <Button variant="secondary" loading={busy} disabled={!online} onClick={() => void act(() => branchesApi.close(branch.id))}>
            Close branch
          </Button>
        )}
        {!branch.active && (
          <Button variant="secondary" loading={busy} disabled={!online} onClick={() => void act(() => branchesApi.reopen(branch.id))}>
            Reopen
          </Button>
        )}
      </div>
      {problem && (
        <p role="alert" className="text-sm text-danger-700">
          {problem}
          {/* A branch that still holds stock can't close (UX §5.11): send it all elsewhere, or count it to zero. */}
          {(branch.productsInStock ?? 0) > 0 && (
            <>
              {' '}
              <Link to={`/app/transfers/send?all=${branch.id}`} className="font-medium text-primary-700 hover:underline">
                Send all stock
              </Link>
              {recordable.some((entry) => entry.id === branch.id) && (
                <>
                  {' · '}
                  <button
                    type="button"
                    onClick={() => {
                      choose(branch.id)
                      navigate('/app/quick')
                    }}
                    className="font-medium text-primary-700 hover:underline"
                  >
                    Count
                  </button>
                </>
              )}
            </>
          )}
        </p>
      )}

      {/* Its figures, each saying what it is. */}
      {branch.productsInStock != null && (
        <dl className="grid grid-cols-3 overflow-hidden rounded-lg border border-neutral-200 bg-white tabular-nums">
          {[
            ['Products in stock', formatNumber(branch.productsInStock)],
            ['Stock worth', formatNairaWhole(branch.stockWorth ?? 0)],
            ['People', formatNumber(branch.people ?? 0)],
          ].map(([label, value], index) => (
            <div key={label} className={`px-3 py-2.5 ${index < 2 ? 'border-r border-neutral-200' : ''}`}>
              <dt className="text-xs text-neutral-500">{label}</dt>
              <dd className="text-base font-semibold text-neutral-900">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {branch.active && (
        <>
          <div role="tablist" aria-label={`${branch.name} settings`} className="flex gap-1 overflow-x-auto border-b border-neutral-200">
            {TABS.map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => setSearchParams({ tab: value }, { replace: true })}
                className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold ${
                  tab === value ? 'border-primary-600 text-primary-700' : 'border-transparent text-neutral-500 hover:text-neutral-800'
                }`}
              >
                {tabLabel[value]}
              </button>
            ))}
          </div>

          {tab === 'areas' && (
            <BranchAreas branch={branch} online={online} mayAddArea={mayAddArea} onAddAreas={() => setAddingAreas(true)} />
          )}

          {tab === 'accounts' && <PaymentAccountsPanel branch={branch} />}
          {/* Stage C (V99): its tables; charges and taxes join them in Step 10. */}
          {tab === 'selling' && <BranchSellingPanel branch={branch} />}

          {tab === 'products' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-neutral-600">What {branch.name} has. Take one off on the product itself.</p>
                {isMultiBranch && (
                  <Button variant="secondary" onClick={() => setAddingProducts(true)} disabled={!online} className="shrink-0 whitespace-nowrap">
                    Add products
                  </Button>
                )}
              </div>
              {products.error && <p role="alert" className="text-sm text-danger-700">{products.error}</p>}
              {products.data && products.data.content.length === 0 && (
                <p className="rounded-lg border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500">
                  No products at {branch.name} yet.
                </p>
              )}
              {products.data && products.data.content.length > 0 && (
                <ul className="divide-y divide-neutral-100 overflow-hidden rounded-lg border border-neutral-200 bg-white" aria-label={`Products at ${branch.name}`}>
                  {products.data.content.map((product) => (
                    <li key={product.id}>
                      <Link to={`/app/products/${product.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-neutral-50">
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-neutral-900">{product.name}</span>
                          <span className="block text-xs text-neutral-500">{product.madeHere ? 'Made here' : 'Kept in stock'}</span>
                        </span>
                        {!product.madeHere && (
                          <span className="shrink-0 tabular-nums text-neutral-700">
                            {formatNumber(product.quantityOnHand)}
                            {product.unitOfMeasure && product.unitOfMeasure !== 'PIECE' ? ` ${product.unitOfMeasure.toLowerCase()}` : ''}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {products.data && products.data.totalElements > products.data.content.length && (
                <p className="text-xs text-neutral-500">
                  Showing {products.data.content.length} of {formatNumber(products.data.totalElements)}. Inventory at {branch.name} has them all.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {editing && (
        <BranchEditor
          branch={branch}
          busy={busy}
          problem={problem}
          onCancel={() => {
            setEditing(false)
            setProblem(null)
          }}
          onSave={(name, phone, address) => void act(() => branchesApi.update(branch.id, { name, phone, address }))}
        />
      )}
      {addingAreas && <AddAreasSheet branch={branch} onClose={() => setAddingAreas(false)} />}
      {addingProducts && (
        <AddBranchProductsSheet
          branchId={branch.id}
          branchName={branch.name}
          onClose={() => {
            setAddingProducts(false)
            void products.refetch()
          }}
        />
      )}
      {addingBranch && <AddBranchFlow onDone={() => setAddingBranch(false)} />}
    </div>
  )
}
