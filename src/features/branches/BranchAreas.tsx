import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { Button } from '@/components/Button'
import { OverflowMenu, type OverflowMenuItem } from '@/components/OverflowMenu'
import { TextField } from '@/components/TextField'
import { isAppError } from '@/types/api'
import { areasApi } from '@/features/branches/branchesApi'
import { BRANCHES_KEY } from '@/features/branches/BranchProvider'
import { hasAreas } from '@/features/branches/areas'
import type { Area, Branch } from '@/features/branches/types'

/**
 * A branch's areas on the Branches page (STOCK_AREAS_PLAN.md §4.1, §5.8), as rows under the branch's
 * own line - ruled, not a box inside its card (DESIGN.md: "rules and columns first"). "Add areas" sits
 * by the heading, and where deliveries arrive is a setting of its own under it - a real choice, seen and
 * changed in one place, not a note on a row (owner's comments, 2026-10-30). Each row says what the area
 * is in one quiet line, and keeps its rarer changes - rename, keeps stock or uses what it's given, close,
 * reopen - in "⋯". A branch that hasn't added
 * any shows its Store as it is, holding everything (owner, 2026-10-30): this page is the one exception to
 * rule 1, being for owners and managers. Online only, like the rest of the page; every refusal is the
 * server's own sentence.
 */
/** The busy/refusal key for the deliveries setting, beside the areas' own ids. */
const DELIVERY = 'delivery'

export function BranchAreas({
  branch,
  online,
  mayAddArea,
  onAddAreas,
}: {
  branch: Branch
  online: boolean
  mayAddArea: boolean
  onAddAreas: () => void
}) {
  const queryClient = useQueryClient()
  const [renaming, setRenaming] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [problem, setProblem] = useState<{ areaId: string; message: string } | null>(null)
  // Changing an area is for someone who works at the branch (the server checks it again).
  const mayChange = branch.active && branch.canRecord
  const areas = branch.areas ?? []
  const withAreas = hasAreas(branch)
  const delivery = areas.find((area) => area.delivery)
  // Where deliveries could arrive: open areas that keep stock.
  const stocking = areas.filter((area) => area.active && area.keepsStock)
  // Only where areas can be added, or already have been: for a seller the Store alone would be noise.
  if (areas.length === 0 || (!withAreas && !mayAddArea)) return null

  /** `key`: an area's id, or DELIVERY for the deliveries setting - where the busy state and any refusal show. */
  async function act(area: Area | typeof DELIVERY, action: () => Promise<unknown>) {
    const key = area === DELIVERY ? DELIVERY : area.id
    setBusy(key)
    setProblem(null)
    try {
      await action()
      await queryClient.invalidateQueries({ queryKey: BRANCHES_KEY })
      setRenaming(null)
    } catch (error) {
      setProblem({ areaId: key, message: isAppError(error) ? error.message : 'Something went wrong. Please try again.' })
    } finally {
      setBusy(null)
    }
  }

  /** What the area is, in one line: "25 products", "Uses what it's given". */
  function describe(area: Area): string {
    if (!withAreas) return 'where all your stock is now · deliveries arrive here'
    const parts: string[] = []
    if (!area.active) parts.push('Closed')
    if (!area.keepsStock) parts.push("Uses what it's given")
    else if (area.productsInStock != null) parts.push(`${area.productsInStock} ${area.productsInStock === 1 ? 'product' : 'products'}`)
    return parts.join(' · ')
  }

  function menu(area: Area): OverflowMenuItem[] {
    const items: OverflowMenuItem[] = [{ label: 'Rename', onSelect: () => setRenaming(area.id), disabled: !online }]
    if (!withAreas) return items
    if (area.active && !area.delivery) {
      items.push({
        label: area.keepsStock ? "Change to: uses what it's given" : 'Change to: keeps stock',
        onSelect: () => void act(area, () => areasApi.update(area.id, { keepsStock: !area.keepsStock })),
        disabled: !online,
      })
      items.push({ label: 'Close', tone: 'danger', onSelect: () => void act(area, () => areasApi.close(area.id)), disabled: !online })
    }
    if (!area.active) {
      items.push({ label: 'Reopen', onSelect: () => void act(area, () => areasApi.reopen(area.id)), disabled: !online })
    }
    return items
  }

  return (
    <section aria-label={`Areas at ${branch.name}`} className="border-t border-neutral-100 pt-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-neutral-900">Areas</h3>
        {mayAddArea && mayChange && (
          <Button variant="secondary" onClick={onAddAreas} disabled={!online}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {online ? (withAreas ? 'Add an area' : 'Add areas') : 'Add areas when online'}
          </Button>
        )}
      </div>
      {withAreas && delivery && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <label htmlFor={`delivery-area-${branch.id}`} className="text-sm text-neutral-700">
            Deliveries arrive in
          </label>
          {mayChange && stocking.length > 1 ? (
            <select
              id={`delivery-area-${branch.id}`}
              value={delivery.id}
              disabled={!online || busy === DELIVERY}
              onChange={(event) => {
                const target = stocking.find((area) => area.id === event.target.value)
                if (target) void act(DELIVERY, () => areasApi.update(target.id, { delivery: true }))
              }}
              className="min-h-11 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-900"
            >
              {stocking.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          ) : (
            <span id={`delivery-area-${branch.id}`} className="text-sm font-medium text-neutral-900">
              {delivery.name}
            </span>
          )}
          {busy === DELIVERY && <span className="text-xs text-neutral-600">Saving…</span>}
          {problem?.areaId === DELIVERY && (
            <p role="alert" className="w-full text-sm text-danger-700">
              {problem.message}
            </p>
          )}
        </div>
      )}
      <ul className="mt-2 divide-y divide-neutral-100">
        {areas.map((area) => (
          <li key={area.id} className="py-2" data-area={area.name}>
            {renaming === area.id ? (
              <RenameArea
                area={area}
                busy={busy === area.id}
                onCancel={() => setRenaming(null)}
                onSave={(name) => void act(area, () => areasApi.update(area.id, { name }))}
              />
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className={`min-w-0 text-sm ${area.active ? '' : 'opacity-70'}`}>
                  <span className="font-medium text-neutral-900">{area.name}</span>
                  <span className="text-neutral-600"> · {describe(area)}</span>
                </p>
                {mayChange && (
                  <OverflowMenu label={`Change ${area.name}`} items={menu(area)} />
                )}
              </div>
            )}
            {busy === area.id && renaming !== area.id && <p className="text-xs text-neutral-600">Saving…</p>}
            {problem?.areaId === area.id && (
              <p role="alert" className="mt-1 text-sm text-danger-700">
                {problem.message}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function RenameArea({
  area,
  busy,
  onCancel,
  onSave,
}: {
  area: Area
  busy: boolean
  onCancel: () => void
  onSave: (name: string) => void
}) {
  const [name, setName] = useState(area.name)
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
      onSubmit={(event) => {
        event.preventDefault()
        onSave(name.trim())
      }}
    >
      <TextField id={`area-${area.id}-name`} label="Area name" value={name} autoFocus onChange={(event) => setName(event.target.value)} />
      <div className="flex gap-2">
        <Button type="submit" loading={busy} disabled={!name.trim()}>
          Save
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
