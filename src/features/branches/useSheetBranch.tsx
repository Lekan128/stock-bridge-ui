import { useState, type ReactNode } from 'react'
import { useAuth } from '@/auth/useAuth'
import { useWorkingBranch } from '@/features/branches/useWorkingBranch'
import { deliveryArea, figureInArea, hasAreas, stockAreas } from '@/features/branches/areas'
import { useWorkArea } from '@/features/branches/workArea'
import type { Branch } from '@/features/branches/types'
import { SheetChoices } from '@/features/branches/SheetChoices'
import type { Product } from '@/features/products/types'

function lastUsedKey(userId: string) {
  return `pp.sheet-branch.${userId}`
}

function lastAreaKey(userId: string, branchId: string) {
  return `pp.sheet-area.${userId}.${branchId}`
}

function read(key: string | null): string | null {
  if (!key) return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage blocked: the next sheet simply asks again.
  }
}

export interface SheetBranch {
  /** " · Oshodi", " · Kitchen", " · Oshodi · Kitchen" for the sheet's title (rule 3); empty otherwise. */
  titleSuffix: string
  /** "Which branch?" (in "All branches") and "Which area?" (at a branch with areas), first on the sheet; else null. */
  field: ReactNode
  /** The branch the sheet itself chose ("All branches"); undefined when the phone's branch applies. */
  branchId: string | undefined
  /** The area chosen on the sheet (V60); undefined at a branch without a choice of areas. */
  areaId: string | undefined
  /** Its name, for "Kitchen's books say 8". */
  areaName: string | undefined
  /** How many of `product` the sheet's area holds, where it has areas and the product says; else its figure. */
  onHand: (product: Product) => number
  /** "All branches" with nothing chosen: the write can't be made yet. */
  missing: boolean
  /** Remember the choices for the next sheet, once the write is made. */
  remember: () => void
}

/**
 * Where a stock sheet records (MULTI_BRANCH_UX_PLAN.md §5.2, rule 3; STOCK_AREAS_PART_1.md). At a branch,
 * the sheet says so in its title and the write is stamped with that branch by `submitStockWrite`. In "All
 * branches" the sheet asks first: a segmented choice up to four branches, a select above that, the last
 * one used preselected. Then, at a branch with two or more areas that keep stock, the same for the area:
 * pre-filled with the last one this person used there, else where deliveries arrive. At a one-branch
 * company with no areas: nothing at all.
 */
export function useSheetBranch(): SheetBranch {
  const { user } = useAuth()
  const { isMultiBranch, isAll, working, recordable } = useWorkingBranch()
  const [chosen, setChosen] = useState<string | null>(() => {
    const last = read(user?.id ? lastUsedKey(user.id) : null)
    return last && recordable.some((branch) => branch.id === last) ? last : (recordable.length === 1 ? recordable[0].id : null)
  })
  const sheetBranch: Branch | null = !isMultiBranch || !isAll ? working : (recordable.find((branch) => branch.id === chosen) ?? null)
  const area = useSheetArea(sheetBranch)
  const onHand = (product: Product) => figureInArea(product, area.areaId) ?? product.quantityOnHand

  if (!isMultiBranch) {
    return {
      titleSuffix: area.titleSuffix,
      field: area.field,
      branchId: undefined,
      areaId: area.areaId,
      areaName: area.areaName,
      onHand,
      missing: false,
      remember: area.remember,
    }
  }
  if (!isAll) {
    return {
      titleSuffix: `${working ? ` · ${working.name}` : ''}${area.titleSuffix}`,
      field: area.field,
      branchId: undefined,
      areaId: area.areaId,
      areaName: area.areaName,
      onHand,
      missing: !working?.canRecord,
      remember: area.remember,
    }
  }

  const chosenName = recordable.find((branch) => branch.id === chosen)?.name
  const field = (
    <>
      <div>
        <p id="sheet-branch-label" className="mb-1.5 text-sm font-medium text-neutral-800">
          Which branch?
        </p>
        {recordable.length <= 4 ? (
          <SheetChoices
            labelledBy="sheet-branch-label"
            options={recordable}
            chosen={chosen}
            onChoose={setChosen}
          />
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
      {area.field}
    </>
  )

  return {
    titleSuffix: `${chosenName ? ` · ${chosenName}` : ''}${area.titleSuffix}`,
    field,
    branchId: chosen ?? undefined,
    areaId: area.areaId,
    areaName: area.areaName,
    onHand,
    missing: chosen == null,
    remember: () => {
      if (user?.id && chosen) write(lastUsedKey(user.id), chosen)
      area.remember()
    },
  }
}

/**
 * The "Which area?" part, for a sheet recording at `branch` (STOCK_AREAS_PART_1.md). Also used on its own
 * by quick mode and the sale basket, which always record at the phone's branch.
 */
export function useSheetArea(branch: Branch | null): {
  titleSuffix: string
  field: ReactNode
  areaId: string | undefined
  areaName: string | undefined
  remember: () => void
} {
  const { user } = useAuth()
  const work = useWorkArea(branch)
  // Someone placed in particular areas (Part 3) chooses only among theirs; everyone else among all.
  const areas = work.limited ? work.areas : stockAreas(branch)
  // The choice is per branch: switching the sheet's branch must never carry the Kitchen of one to the next.
  const [chosen, setChosen] = useState<{ branchId: string; areaId: string } | null>(null)
  if (!branch || !hasAreas(branch) || areas.length === 0 || (!work.limited && areas.length < 2)) {
    return { titleSuffix: '', field: null, areaId: undefined, areaName: undefined, remember: () => {} }
  }
  // Where this phone is for them (the cook's Kitchen, the barman's Bar): no question, the title says it.
  if (work.area) {
    const here = work.area
    return { titleSuffix: ` · ${here.name}`, field: null, areaId: here.id, areaName: here.name, remember: () => {} }
  }
  const last = read(user?.id ? lastAreaKey(user.id, branch.id) : null)
  const fallback = areas.find((area) => area.id === last) ?? (work.limited ? undefined : deliveryArea(branch)) ?? areas[0]
  const current =
    chosen?.branchId === branch.id ? (areas.find((area) => area.id === chosen.areaId) ?? fallback) : fallback
  const labelId = `sheet-area-label-${branch.id}`
  const field = (
    <div>
      <p id={labelId} className="mb-1.5 text-sm font-medium text-neutral-800">
        Which area?
      </p>
      {areas.length <= 4 ? (
        <SheetChoices
          labelledBy={labelId}
          options={areas}
          chosen={current.id}
          onChoose={(id) => setChosen({ branchId: branch.id, areaId: id })}
        />
      ) : (
        <select
          aria-labelledby={labelId}
          value={current.id}
          onChange={(event) => setChosen({ branchId: branch.id, areaId: event.target.value })}
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
        >
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>
      )}
    </div>
  )
  return {
    titleSuffix: ` · ${current.name}`,
    field,
    areaId: current.id,
    areaName: current.name,
    remember: () => {
      if (user?.id) write(lastAreaKey(user.id, branch.id), current.id)
      // Someone in a few areas answers "Which area?" once: the answer is where this phone is for them.
      if (work.limited) work.choose(current.id)
    },
  }
}
