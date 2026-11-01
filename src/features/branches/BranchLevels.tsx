import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Button } from '@/components/Button'
import { useToast } from '@/components/useToast'
import { invalidateInventory, syncProductIntoCache } from '@/data/inventoryCache'
import { useWorkingBranch } from '@/features/branches/useWorkingBranch'
import type { Product } from '@/features/products/types'
import { formatNumber } from '@/features/products/unitCopy'
import { isAppError } from '@/types/api'

/**
 * "Different for each branch" (MULTI_BRANCH_UX_PLAN.md §5.9): a small table of this product's low-stock
 * level at each branch, in its stock unit. Blank is the product's own level. A shared-record edit, so
 * it saves on its own, online (`PUT /api/products/{id}/branch-thresholds`).
 */
export function BranchLevels({ product, unit }: { product: Product; unit: string | undefined }) {
  const { nameOf } = useWorkingBranch()
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const rows = product.branchStock ?? []
  const differs = rows.some((entry) => entry.ownLowStockThreshold != null)
  const [open, setOpen] = useState(differs)
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((entry) => [entry.branchId, entry.ownLowStockThreshold != null ? String(entry.ownLowStockThreshold) : ''])),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (rows.length === 0) return null

  const invalid = Object.values(values).some((value) => value.trim() !== '' && !/^\d+$/.test(value.trim()))
  const own = product.lowStockThreshold

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const saved = await api
        .put<Product>(
          `/api/products/${product.id}/branch-thresholds`,
          rows.map((entry) => {
            const value = values[entry.branchId]?.trim() ?? ''
            return { branchId: entry.branchId, lowStockThreshold: value === '' ? null : Number(value) }
          }),
        )
        .then((response) => response.data)
      syncProductIntoCache(queryClient, saved)
      void invalidateInventory(queryClient)
      showToast('Branch levels saved.', 'success')
    } catch (err) {
      setError(isAppError(err) ? err.message : "Couldn't save the branch levels. Try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="branch-levels"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-11 items-center text-sm font-medium text-primary-700 hover:underline"
      >
        Different for each branch
      </button>
      {open && (
        <div id="branch-levels" className="mt-1 flex flex-col gap-3">
          <table className="w-full text-sm">
            <caption className="sr-only">Low-stock level at each branch</caption>
            <thead>
              <tr className="text-left text-xs text-neutral-500">
                <th scope="col" className="py-1.5 font-medium">Branch</th>
                <th scope="col" className="py-1.5 font-medium">Warn at{unit ? ` (${unit})` : ''}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => {
                const name = nameOf(entry.branchId) ?? 'Closed branch'
                return (
                  <tr key={entry.branchId} className="border-t border-neutral-100">
                    <td className="py-1.5 pr-3 text-neutral-700">{name}</td>
                    <td className="py-1.5">
                      <input
                        inputMode="numeric"
                        aria-label={`Low-stock level at ${name}`}
                        value={values[entry.branchId] ?? ''}
                        placeholder={own != null ? formatNumber(own) : 'None'}
                        onChange={(event) => setValues((prev) => ({ ...prev, [entry.branchId]: event.target.value }))}
                        className="h-10 w-28 rounded-md border border-neutral-300 px-3 tabular-nums"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="text-xs text-neutral-500">Leave a branch blank to use the product's level{own != null ? ` (${formatNumber(own)})` : ''}.</p>
          {error && <p role="alert" className="text-sm text-danger-700">{error}</p>}
          {invalid && <p className="text-sm text-danger-700">Use whole numbers.</p>}
          <div>
            <Button type="button" variant="secondary" loading={saving} disabled={invalid} onClick={() => void save()}>
              Save branch levels
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
