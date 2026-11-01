import { useState } from 'react'
import { PERMISSIONS } from '@/auth/permissions'
import { useRoles } from '@/features/users/hooks/useRoles'
import { useWorkingBranch } from '@/features/branches/useWorkingBranch'
import { hasAreas } from '@/features/branches/areas'
import type { Branch } from '@/features/branches/types'

interface WorksAtFieldProps {
  roleId: string | undefined
  value: string[]
  onChange: (branchIds: string[]) => void
  /** The areas they're limited to, across their branches (V64); empty = every area. */
  areaIds: string[]
  onAreasChange: (areaIds: string[]) => void
}

/**
 * "Works at" on a person (MULTI_BRANCH_UX_PLAN.md §5.10): the branches they record at, and inside each one
 * that has areas (STOCK_AREAS_PART_3.md, §4.4), *All areas* or *Only some*. When their role works at every
 * branch the ticks give way to a sentence saying so, so "all" has one source - the role. "Select all" ticks
 * today's branches; a branch added later is not ticked for them. At a one-branch company only the areas
 * part, and only once it has areas.
 */
export function WorksAtField({ roleId, value, onChange, areaIds, onAreasChange }: WorksAtFieldProps) {
  const { isMultiBranch, branches } = useWorkingBranch()
  const { data: roles } = useRoles()
  const open = branches.filter((branch) => branch.active)
  const withAreas = (isMultiBranch ? open.filter((branch) => value.includes(branch.id)) : open).filter(hasAreas)
  if (!isMultiBranch && withAreas.length === 0) return null

  const role = roles?.find((candidate) => candidate.id === roleId)
  const everywhere = role?.permissions.includes(PERMISSIONS.WORK_AT_ALL_BRANCHES) ?? false

  if (everywhere) {
    return (
      <div>
        <p className="text-sm font-medium text-neutral-800">Works at</p>
        <p className="mt-1 text-sm text-neutral-600">
          Every {isMultiBranch ? 'branch' : 'area'}
          {isMultiBranch && withAreas.length > 0 ? ' and area' : ''}, from their role: {role?.name}.
        </p>
      </div>
    )
  }

  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((existing) => existing !== id) : [...value, id])

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-medium text-neutral-800">Works at</legend>
      {isMultiBranch && (
        <div>
          <p className="text-xs text-neutral-600">They record stock only at these branches.</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {open.map((branch) => (
              <label key={branch.id} className="flex items-center gap-2 text-sm text-neutral-800">
                <input type="checkbox" checked={value.includes(branch.id)} onChange={() => toggle(branch.id)} />
                {branch.name}
                {branch.main && <span className="text-xs text-neutral-500">Main</span>}
              </label>
            ))}
          </div>
          {open.length > 2 && (
            <button
              type="button"
              onClick={() => onChange(open.map((branch) => branch.id))}
              className="mt-2 text-sm font-medium text-primary-700 hover:underline"
            >
              Select all
            </button>
          )}
          {value.length === 0 && <p className="mt-1 text-xs text-danger-700">Choose at least one branch.</p>}
        </div>
      )}
      {withAreas.map((branch) => (
        <BranchAreasChoice
          key={branch.id}
          branch={branch}
          label={isMultiBranch ? `Areas at ${branch.name}` : 'Areas'}
          areaIds={areaIds}
          onAreasChange={onAreasChange}
        />
      ))}
    </fieldset>
  )
}

/**
 * One branch's areas for a person: *All areas* (the default: anything they can do today, in every area,
 * and in any area added later) or *Only some*, ticked. Roles still decide what they can do; this decides
 * where.
 */
function BranchAreasChoice({
  branch,
  label,
  areaIds,
  onAreasChange,
}: {
  branch: Branch
  label: string
  areaIds: string[]
  onAreasChange: (areaIds: string[]) => void
}) {
  const areas = (branch.areas ?? []).filter((area) => area.active)
  const here = new Set((branch.areas ?? []).map((area) => area.id))
  const ticked = areaIds.filter((id) => here.has(id))
  // "Only some" with nothing ticked yet is still a choice being made, so it's held here, not in the list.
  const [some, setSome] = useState(ticked.length > 0)
  const labelId = `works-areas-${branch.id}`
  const elsewhere = areaIds.filter((id) => !here.has(id))
  const set = (ids: string[]) => onAreasChange([...elsewhere, ...ids])

  return (
    <div>
      <p id={labelId} className="text-sm text-neutral-800">
        {label}
      </p>
      <div role="radiogroup" aria-labelledby={labelId} className="mt-1.5 inline-flex rounded-md border border-neutral-200 bg-neutral-50 p-0.5">
        {[
          { value: false, text: 'All areas' },
          { value: true, text: 'Only some' },
        ].map((option) => (
          <button
            key={option.text}
            type="button"
            role="radio"
            aria-checked={some === option.value}
            onClick={() => {
              setSome(option.value)
              if (!option.value) set([])
            }}
            className={`min-h-9 rounded-sm px-3 text-sm font-medium ${
              some === option.value ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600 hover:text-neutral-800'
            }`}
          >
            {option.text}
          </button>
        ))}
      </div>
      {some ? (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
          {areas.map((area) => (
            <label key={area.id} className="flex min-h-9 items-center gap-2 text-sm text-neutral-800">
              <input
                type="checkbox"
                checked={ticked.includes(area.id)}
                onChange={() => set(ticked.includes(area.id) ? ticked.filter((id) => id !== area.id) : [...ticked, area.id])}
              />
              {/* The same words as Move's picker: an area that keeps no figure says so. */}
              {area.keepsStock ? area.name : `${area.name} (uses it)`}
            </label>
          ))}
          {ticked.length === 0 && (
            <p className="w-full text-xs text-neutral-600">Tick where they work. Left empty, they work in every area.</p>
          )}
        </div>
      ) : (
        <p className="mt-1 text-xs text-neutral-600">Including any area added later.</p>
      )}
    </div>
  )
}
