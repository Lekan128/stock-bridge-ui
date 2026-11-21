import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/useToast'
import { isAppError } from '@/types/api'
import { useAuth } from '@/auth/useAuth'
import { PERMISSIONS } from '@/auth/permissions'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { BRANCHES_KEY } from '@/features/branches/BranchProvider'
import { branchesApi } from '@/features/branches/branchesApi'
import { useWorkingBranch } from '@/features/branches/useWorkingBranch'
import type { Branch } from '@/features/branches/types'
import { syncCatalog } from '@/features/catalog/catalogStore'
import { useSellingSettings } from '@/features/selling/useSellingSettings'

/**
 * "Prices at Ikeja" on Branch → Selling (BRANCH_PRICES_PLAN.md, V107; owner 2026-11-21): its own prices, or the same
 * as another branch's. No branch is special - the main branch chooses like any other. Its own starts as a copy of the
 * prices it used, then they're its alone. Only while "Each branch can have its own prices" is on; a choice applies at
 * once, with Undo.
 */
export function BranchPricesChoice({ branch }: { branch: Branch }) {
  const settings = useSellingSettings()
  const { branches, isMultiBranch } = useWorkingBranch()
  const { user } = useAuth()
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const online = useOnlineStatus()
  const [busy, setBusy] = useState(false)

  // With the switch on every branch has prices; none yet means the branch list is still catching up.
  if (!isMultiBranch || settings.data?.branchPrices !== true || !branch.priceListId) return null
  const mayChange = user?.type === 'tenant' && user.permissions.includes(PERMISSIONS.MANAGE_BRANCHES)
  const mayChangePrices = user?.type === 'tenant' && user.permissions.includes(PERMISSIONS.CHANGE_SELLING_PRICES)
  const others = branches.filter((other) => other.id !== branch.id && other.active)
  const sharesWith = others.filter((other) => other.priceListId && other.priceListId === branch.priceListId)
  const own = sharesWith.length === 0
  const count = branch.ownPriceCount ?? 0

  async function apply(next: { own: true } | { own: false; with: Branch }, undo?: { own: true } | { own: false; with: Branch }) {
    setBusy(true)
    try {
      await (next.own ? branchesApi.setPrices(branch.id, 'OWN') : branchesApi.setPrices(branch.id, 'SAME_AS', next.with.id))
      await queryClient.invalidateQueries({ queryKey: BRANCHES_KEY })
      void syncCatalog().catch(() => {})
      const said = next.own
        ? `${branch.name} has its own prices: a copy of the ones it used. Change them on each product.`
        : `${branch.name} uses ${next.with.name}'s prices.`
      showToast(said, 'success', undo ? { action: { label: 'Undo', onAction: () => void apply(undo) } } : undefined)
    } catch (error) {
      showToast(isAppError(error) ? error.message : "Couldn't change that. Try again.", 'error')
    } finally {
      setBusy(false)
    }
  }

  const disabled = busy || !online || !mayChange
  const now: { own: true } | { own: false; with: Branch } = own ? { own: true } : { own: false, with: sharesWith[0] }
  // "Same as": the branch it shares with now, else the main branch, else the first other one.
  const sameAs = own ? (others.find((other) => other.main) ?? others[0]) : sharesWith[0]
  const radio = (checked: boolean) => (
    <span
      aria-hidden="true"
      className={`mt-1 block h-4 w-4 shrink-0 rounded-full border-2 ${checked ? 'border-[5px] border-primary-600' : 'border-neutral-300'}`}
    />
  )

  return (
    <section aria-labelledby={`prices-${branch.id}`} className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3">
      <h3 id={`prices-${branch.id}`} className="font-semibold text-neutral-900">
        Prices at {branch.name}
      </h3>
      <div role="radiogroup" aria-labelledby={`prices-${branch.id}`} className="flex flex-col gap-2">
        <button
          type="button"
          role="radio"
          aria-checked={own}
          disabled={disabled}
          onClick={() => !own && void apply({ own: true }, now)}
          className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left ${
            own ? 'border-primary-300 bg-primary-50' : 'border-neutral-200 hover:bg-neutral-50'
          } ${disabled && !own ? 'cursor-not-allowed opacity-60' : ''}`}
        >
          {radio(own)}
          <span className="min-w-0">
            <span className="block text-sm font-medium text-neutral-900">Its own prices</span>
            <span className="block text-sm text-neutral-500">
              {own
                ? `${count} ${count === 1 ? 'product has a' : 'products have a'} price here. Changing one changes no other branch.`
                : 'Starts as a copy of the prices it uses now. Then changing one changes no other branch.'}
            </span>
          </span>
        </button>
        {sameAs && (
          <div className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${!own ? 'border-primary-300 bg-primary-50' : 'border-neutral-200'}`}>
            <button
              type="button"
              role="radio"
              aria-checked={!own}
              aria-label={`Same as ${sameAs.name}`}
              disabled={disabled}
              onClick={() => own && void apply({ own: false, with: sameAs }, now)}
              className="shrink-0"
            >
              {radio(!own)}
            </button>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-neutral-900">
                Same as
                <select
                  aria-label="Branch whose prices it uses"
                  value={sameAs.id}
                  disabled={disabled}
                  onChange={(event) => {
                    const target = others.find((other) => other.id === event.target.value)
                    if (target) void apply({ own: false, with: target }, now)
                  }}
                  className="rounded-md border border-neutral-300 bg-white px-2 py-0.5 text-sm"
                >
                  {others.map((other) => (
                    <option key={other.id} value={other.id}>
                      {other.name}
                    </option>
                  ))}
                </select>
              </span>
              <span className="block text-sm text-neutral-500">
                {branch.name} and {sameAs.name} share one set of prices. A change at either applies at both.
              </span>
            </span>
          </div>
        )}
      </div>
      {mayChangePrices && (
        <Link
          to={`/app/products/prices?prices=${branch.priceListId}`}
          className="self-start rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-primary-700 hover:bg-neutral-50"
        >
          Open price sheet
        </Link>
      )}
      {!mayChange && <p className="text-xs text-neutral-500">People who manage branches can change this.</p>}
    </section>
  )
}
