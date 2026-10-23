import { useState, type ReactNode } from 'react'
import { useAuth } from '@/auth/useAuth'
import { useWorkingBranch } from '@/features/branches/useWorkingBranch'

function lastUsedKey(userId: string) {
  return `pp.sheet-branch.${userId}`
}

function readLastUsed(userId: string | undefined): string | null {
  if (!userId) return null
  try {
    return window.localStorage.getItem(lastUsedKey(userId))
  } catch {
    return null
  }
}

export interface SheetBranch {
  /** " · Oshodi" for the sheet's title at a multi-branch company (rule 3); empty otherwise. */
  titleSuffix: string
  /** The "Which branch?" field, first on the sheet, in "All branches" only (UX §4.3); else null. */
  field: ReactNode
  /** The branch the sheet itself chose ("All branches"); undefined when the phone's branch applies. */
  branchId: string | undefined
  /** "All branches" with nothing chosen: the write can't be made yet. */
  missing: boolean
  /** Remember the choice for the next sheet, once the write is made. */
  remember: () => void
}

/**
 * Where a stock sheet records (MULTI_BRANCH_UX_PLAN.md §5.2, rule 3). At a branch, the sheet says so in
 * its title and the write is stamped with that branch by `submitStockWrite`. In "All branches" the sheet
 * asks first: a segmented choice up to four branches, a select above that, the last one used preselected.
 * At a one-branch company: nothing at all.
 */
export function useSheetBranch(): SheetBranch {
  const { user } = useAuth()
  const { isMultiBranch, isAll, working, recordable } = useWorkingBranch()
  const [chosen, setChosen] = useState<string | null>(() => {
    const last = readLastUsed(user?.id)
    return last && recordable.some((branch) => branch.id === last) ? last : (recordable.length === 1 ? recordable[0].id : null)
  })

  if (!isMultiBranch) {
    return { titleSuffix: '', field: null, branchId: undefined, missing: false, remember: () => {} }
  }
  if (!isAll) {
    return {
      titleSuffix: working ? ` · ${working.name}` : '',
      field: null,
      branchId: undefined,
      missing: !working?.canRecord,
      remember: () => {},
    }
  }

  const chosenName = recordable.find((branch) => branch.id === chosen)?.name
  const field = (
    <div>
      <p id="sheet-branch-label" className="mb-1.5 text-sm font-medium text-neutral-800">
        Which branch?
      </p>
      {recordable.length <= 4 ? (
        <div role="radiogroup" aria-labelledby="sheet-branch-label" className="flex flex-wrap gap-2">
          {recordable.map((branch) => (
            <button
              key={branch.id}
              type="button"
              role="radio"
              aria-checked={chosen === branch.id}
              onClick={() => setChosen(branch.id)}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                chosen === branch.id
                  ? 'border-primary-600 bg-primary-50 font-medium text-primary-700'
                  : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              {branch.name}
            </button>
          ))}
        </div>
      ) : (
        <select
          aria-labelledby="sheet-branch-label"
          value={chosen ?? ''}
          onChange={(event) => setChosen(event.target.value || null)}
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Choose a branch</option>
          {recordable.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      )}
    </div>
  )

  return {
    titleSuffix: chosenName ? ` · ${chosenName}` : '',
    field,
    branchId: chosen ?? undefined,
    missing: chosen == null,
    remember: () => {
      if (!user?.id || !chosen) return
      try {
        window.localStorage.setItem(lastUsedKey(user.id), chosen)
      } catch {
        // Storage blocked: the next sheet simply asks again.
      }
    },
  }
}
