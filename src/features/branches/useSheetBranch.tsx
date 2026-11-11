import { useState, type ReactNode } from 'react'
import { useAuth } from '@/auth/useAuth'
import { useWorkingBranch } from '@/features/branches/useWorkingBranch'
import { deliveryArea, figureInArea, hasAreas, stockAreas } from '@/features/branches/areas'
import { useWorkArea } from '@/features/branches/workArea'
import type { Area, Branch } from '@/features/branches/types'
import { SheetChoices } from '@/features/branches/SheetChoices'
import { SheetPlaceLine, type PlacePart } from '@/features/branches/SheetPlaceLine'
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
  /**
   * The line under the sheet's title (STOCK_SHEETS_AND_AREA_COUNT_PLAN.md Part 1): where it records, each
   * part with a choice changed right there, and `figure` ("12 bags") as "12 bags here". Null figure: none
   * said (no branch chosen yet, or the sheet has none to say). Nothing at all at a one-shop company without a
   * figure.
   */
  line: (figure: string | null, inPacks?: string | null) => ReactNode
  /** The branch the sheet itself chose ("All branches"); undefined when the phone's branch applies. */
  branchId: string | undefined
  /** The area chosen on the sheet (V60); undefined at a branch without a choice of areas. */
  areaId: string | undefined
  /** Its name, for "Kitchen's books say 8". */
  areaName: string | undefined
  /** How many of `product` the sheet's branch and area hold; else its figure. */
  onHand: (product: Product) => number
  /** "All branches" with nothing chosen: the write can't be made yet (and there's no figure to say). */
  missing: boolean
  /** Remember the choices for the next sheet, once the write is made. */
  remember: () => void
}

/**
 * Where a stock sheet records (MULTI_BRANCH_UX_PLAN.md §5.2, rule 3; STOCK_AREAS_PART_1.md; and the line under
 * the title, STOCK_SHEETS_AND_AREA_COUNT_PLAN.md Part 1). At a branch, the line names it and the write is
 * stamped with that branch by `submitStockWrite`. In "All branches" the line starts "Choose a branch ⌄", the
 * last one used preselected. Then, at a branch with two or more areas that keep stock, the area: pre-filled
 * with the last one this person used there, else where deliveries arrive, changed on the line. At a
 * one-branch company with no areas: only the figure.
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
  // A sheet opened from "All branches" holds the company's figure; the branch it records at says its own.
  const onHand = (product: Product) =>
    figureInArea(product, area.areaId) ??
    (isMultiBranch && isAll && sheetBranch ? product.branchStock?.find((figure) => figure.branchId === sheetBranch.id)?.quantityOnHand : undefined) ??
    product.quantityOnHand
  const areaPart: PlacePart[] = area.areaName
    ? [
        {
          key: 'area',
          label: area.areaName,
          choice:
            area.choices.length >= 2
              ? {
                  caption: 'Record in',
                  ariaLabel: `Recording in the ${area.areaName}. Change area`,
                  options: area.choices,
                  currentId: area.areaId,
                  onPick: area.pick,
                }
              : undefined,
        },
      ]
    : []

  if (!isMultiBranch) {
    return {
      line: (figure, inPacks) => <SheetPlaceLine parts={areaPart} figure={figure} inPacks={inPacks} />,
      branchId: undefined,
      areaId: area.areaId,
      areaName: area.areaName,
      onHand,
      missing: false,
      remember: area.remember,
    }
  }
  if (!isAll) {
    const branchPart: PlacePart[] = working ? [{ key: 'branch', label: working.name }] : []
    return {
      line: (figure, inPacks) => <SheetPlaceLine parts={[...branchPart, ...areaPart]} figure={figure} inPacks={inPacks} />,
      branchId: undefined,
      areaId: area.areaId,
      areaName: area.areaName,
      onHand,
      missing: !working?.canRecord,
      remember: area.remember,
    }
  }

  const chosenName = recordable.find((branch) => branch.id === chosen)?.name
  const branchPart: PlacePart = {
    key: 'branch',
    label: chosenName ?? 'Choose a branch',
    choice: {
      caption: 'Record at',
      ariaLabel: chosenName ? `Recording at ${chosenName}. Change branch` : 'Choose a branch',
      options: recordable,
      currentId: chosen ?? undefined,
      onPick: setChosen,
    },
  }
  return {
    line: (figure, inPacks) => <SheetPlaceLine parts={[branchPart, ...areaPart]} figure={chosen == null ? null : figure} inPacks={inPacks} />,
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
  /** The areas there's a choice of here (quick mode's title offers them); empty or one: no choice. */
  choices: Area[]
  /** Choose `areaId` and remember it - for someone placed in areas, as where this phone is for them. */
  choose: (areaId: string) => void
  /** Choose `areaId` for this sheet only (a panel's pick never moves the top bar, Part 3.6). */
  pick: (areaId: string) => void
} {
  const { user } = useAuth()
  const work = useWorkArea(branch)
  // Someone placed in particular areas (Part 3) chooses only among theirs; everyone else among all.
  const areas = work.limited ? work.areas : stockAreas(branch)
  // The choice is per branch: switching the sheet's branch must never carry the Kitchen of one to the next.
  const [chosen, setChosen] = useState<{ branchId: string; areaId: string } | null>(null)
  if (!branch || !hasAreas(branch) || areas.length === 0 || (!work.limited && areas.length < 2)) {
    return { titleSuffix: '', field: null, areaId: undefined, areaName: undefined, remember: () => {}, choices: [], choose: () => {}, pick: () => {} }
  }
  // The area chosen in the top bar is where it records, said in the title - one area to choose from, no
  // question. With more, the question stays, that area already picked: stocking in at the Store from the
  // Kitchen is one tap here, not a trip to the top bar and back (owner, 2026-10-31).
  const last = read(user?.id ? lastAreaKey(user.id, branch.id) : null)
  const fallback =
    work.area ?? areas.find((area) => area.id === last) ?? (work.limited ? undefined : deliveryArea(branch)) ?? areas[0]
  const current =
    chosen?.branchId === branch.id ? (areas.find((area) => area.id === chosen.areaId) ?? fallback) : fallback
  if (areas.length < 2) {
    return {
      titleSuffix: ` · ${current.name}`,
      field: null,
      areaId: current.id,
      areaName: current.name,
      remember: () => {},
      choices: areas,
      choose: work.choose,
      pick: () => {},
    }
  }
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
    // A panel's answer is for that record only: where you are stays as the top bar says (Part 3.6).
    remember: () => {
      if (user?.id) write(lastAreaKey(user.id, branch.id), current.id)
    },
    choices: areas,
    // Quick mode's title (Part 3.6): picking an area there makes it where you are, for everyone.
    choose: (areaId: string) => {
      setChosen({ branchId: branch.id, areaId })
      if (user?.id) write(lastAreaKey(user.id, branch.id), areaId)
      work.choose(areaId)
    },
    pick: (areaId: string) => setChosen({ branchId: branch.id, areaId }),
  }
}
