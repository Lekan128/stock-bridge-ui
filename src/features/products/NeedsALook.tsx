import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useApiQuery } from '@/data/useApiQuery'
import { useToast } from '@/components/useToast'
import { isAppError } from '@/types/api'
import { useAuth } from '@/auth/useAuth'
import { PERMISSIONS } from '@/auth/permissions'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { BRANCHES_KEY } from '@/features/branches/BranchProvider'
import { useWorkingBranch } from '@/features/branches/useWorkingBranch'

/** One thing on the small line (BRANCH_PRICES_PLAN.md 9.2): to fix, or to check once. */
export interface LookItem {
  productId: string
  productName: string
  branchId: string
  branchName: string
  kind: 'FIX' | 'CHECK'
  reason: 'NO_AREA' | 'NO_PRICE' | 'ADDED_AS_INGREDIENT'
  madeIn?: string
  aboutProductId?: string
  aboutName?: string
}

export interface LookAnswer {
  items: LookItem[]
  toFix: number
  toCheck: number
}

const LOOK_KEY = 'needs-a-look'
/** As long as a toast with Undo stays up. */
const UNDO_MS = 8000

/** What to look at, at a branch (absent: every branch the person sees), or for one product. Online only. */
export function useNeedsALook(branchId: string | undefined, productId?: string, enabled = true) {
  return useApiQuery<LookAnswer>({
    queryKey: [LOOK_KEY, branchId ?? 'all', productId ?? 'all'],
    queryFn: () =>
      api
        .get<LookAnswer>('/api/products/needs-a-look', { params: { branchId, productId } })
        .then((response) => response.data),
    fallbackError: "Couldn't load what needs a look.",
    enabled,
    // Asked afresh each time a screen shows it: a fix made anywhere (a price, an area) clears it at once.
    staleTime: 0,
  })
}

/** "3 products at Ikeja to look at · 2 to fix, 1 to check". */
export function lookSummary(answer: LookAnswer, where: string | undefined): string {
  const products = new Set(answer.items.map((item) => `${item.productId}:${item.branchId}`)).size
  const parts = [answer.toFix > 0 ? `${answer.toFix} to fix` : null, answer.toCheck > 0 ? `${answer.toCheck} to check` : null]
  return `${products} ${products === 1 ? 'product' : 'products'}${where ? ` at ${where}` : ''} to look at · ${parts.filter(Boolean).join(', ')}`
}

/**
 * The things to look at, each with its fix right there: "Add a Kitchen at Ikeja" (one tap, Undo on a timer) or one of
 * its areas; a price at the branch; "Looks right" for something added. Names the branch on each when it covers several.
 */
export function NeedsALookList({ answer, showBranch, inSheet = false }: { answer: LookAnswer; showBranch: boolean; inSheet?: boolean }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  // Inside a sheet everything behind it is inert, so the message and its Undo show here, on the same timer as a toast.
  const [said, setSaid] = useState<{ text: string; undo?: () => void } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const showToast: typeof toast.showToast = (text, variant, options) => {
    if (!inSheet || variant === 'error') return toast.showToast(text, variant, options)
    window.clearTimeout(timer.current)
    setSaid({ text, undo: options?.action?.onAction })
    timer.current = window.setTimeout(() => setSaid(null), options?.action ? UNDO_MS : 4000)
  }
  const { user } = useAuth()
  const online = useOnlineStatus()
  const { branches } = useWorkingBranch()
  const [busy, setBusy] = useState<string | null>(null)
  const permissions = user?.type === 'tenant' ? user.permissions : []
  const mayAddArea = permissions.includes(PERMISSIONS.MANAGE_BRANCHES)
  const mayEdit = permissions.includes(PERMISSIONS.MANAGE_PRODUCTS)

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [LOOK_KEY] }),
      queryClient.invalidateQueries({ queryKey: BRANCHES_KEY }),
    ])
  }

  async function run(key: string, work: () => Promise<unknown>) {
    setBusy(key)
    try {
      await work()
      await refresh()
      return true
    } catch (error) {
      showToast(isAppError(error) ? error.message : "Couldn't do that. Try again.", 'error')
      return false
    } finally {
      setBusy(null)
    }
  }

  /** One tap: the area, named as the item's "Made in", at that branch - then Undo, on the toast's timer. */
  async function addArea(item: LookItem) {
    const name = item.madeIn as string
    let created: string | undefined
    const ok = await run(`area:${item.branchId}`, async () => {
      const added = await api.post<{ id: string }[]>(`/api/branches/${item.branchId}/areas`, { areas: [{ name, keepsStock: true }] })
      created = added.data[0]?.id
    })
    if (!ok || !created) return
    const areaId = created
    showToast(`${name} added to ${item.branchName}.`, 'success', {
      action: {
        label: 'Undo',
        onAction: () =>
          void run(`undo:${areaId}`, () => api.delete(`/api/areas/${areaId}`)).then((undone) => {
            if (undone) {
              showToast(`${name} removed from ${item.branchName}.`, 'info', { action: { label: 'Undo', onAction: () => void addArea(item) } })
            }
          }),
      },
    })
  }

  // One line per product and branch; a product can be to fix and to check at once.
  const rows = new Map<string, LookItem[]>()
  for (const item of answer.items) rows.set(`${item.productId}:${item.branchId}`, [...(rows.get(`${item.productId}:${item.branchId}`) ?? []), item])

  return (
    <div className="flex flex-col gap-2">
      {said && (
        <p role="status" className="flex flex-wrap items-center gap-2 rounded-md bg-accent-50 px-3 py-2 text-sm text-accent-800">
          {said.text}
          {said.undo && (
            <button
              type="button"
              onClick={() => {
                const undo = said.undo
                setSaid(null)
                undo?.()
              }}
              className="font-semibold underline"
            >
              Undo
            </button>
          )}
        </p>
      )}
    <ul className="flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
      {[...rows.entries()].map(([key, items]) => {
        const first = items[0]
        const areas = (branches.find((branch) => branch.id === first.branchId)?.areas ?? []).filter((area) => area.active)
        return (
          <li key={key} className="flex flex-col gap-2 px-3 py-2.5">
            <span className="flex flex-wrap items-baseline gap-x-2 text-sm">
              <Link to={`/app/products/${first.productId}`} className="font-medium text-neutral-900 hover:underline">
                {first.productName}
              </Link>
              {showBranch && <span className="text-xs text-neutral-500">at {first.branchName}</span>}
            </span>
            {items.map((item) => (
              <div key={item.reason} className="flex flex-wrap items-center gap-2 text-sm">
                {item.reason === 'NO_AREA' && (
                  <>
                    <span className="font-medium text-warning-800">
                      No {item.madeIn} at {item.branchName}
                    </span>
                    {mayAddArea && item.madeIn && (
                      <button
                        type="button"
                        disabled={!online || busy != null}
                        onClick={() => void addArea(item)}
                        className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-sm font-semibold text-primary-700 hover:bg-neutral-50 disabled:opacity-50"
                      >
                        Add a {item.madeIn} at {item.branchName}
                      </button>
                    )}
                    {mayEdit && areas.length > 0 && (
                      <label className="flex items-center gap-1.5 text-neutral-600">
                        or made in
                        <select
                          aria-label={`Where ${item.productName} is made at ${item.branchName}`}
                          defaultValue=""
                          disabled={!online || busy != null}
                          onChange={(event) =>
                            event.target.value &&
                            void run(`made:${key}`, () =>
                              api.put(`/api/products/${item.productId}/made-in/${item.branchId}`, { areaId: event.target.value }),
                            )
                          }
                          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
                        >
                          <option value="">Choose an area</option>
                          {areas.map((area) => (
                            <option key={area.id} value={area.id}>
                              {area.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </>
                )}
                {item.reason === 'NO_PRICE' && (
                  <>
                    <span className="font-medium text-warning-800">No price at {item.branchName} yet</span>
                    <Link
                      to={`/app/products/${item.productId}/edit#price`}
                      className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-sm font-semibold text-primary-700 hover:bg-neutral-50"
                    >
                      Set its price
                    </Link>
                  </>
                )}
                {item.reason === 'ADDED_AS_INGREDIENT' && (
                  <>
                    <span className="font-medium text-primary-700">
                      Added to {item.branchName}
                      {item.aboutName ? ` for ${item.aboutName}` : ''}
                    </span>
                    <span className="text-xs text-neutral-500">It doesn&apos;t need stock to be an ingredient.</span>
                    {mayEdit && (
                      <button
                        type="button"
                        disabled={!online || busy != null}
                        onClick={() =>
                          void run(`ok:${key}`, () => api.post(`/api/products/${item.productId}/looks-right`, null, { params: { branchId: item.branchId } }))
                        }
                        className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
                      >
                        Looks right
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}
          </li>
        )
      })}
    </ul>
    </div>
  )
}
