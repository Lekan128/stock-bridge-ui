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
 * own line - ruled, not a box inside its card (DESIGN.md: "rules and columns first"). Each row says what
 * the area is in one quiet line, and keeps its changes - rename, where deliveries arrive, keeps stock or
 * uses what it's given, close, reopen - in "⋯", because they are rarely made. A branch that hasn't added
 * any shows its Store as it is, holding everything (owner, 2026-10-30): this page is the one exception to
 * rule 1, being for owners and managers. Online only, like the rest of the page; every refusal is the
 * server's own sentence.
 */
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
  // Only where areas can be added, or already have been: for a seller the Store alone would be noise.
  if (areas.length === 0 || (!withAreas && !mayAddArea)) return null

  async function act(area: Area, action: () => Promise<unknown>) {
    setBusy(area.id)
    setProblem(null)
    try {
      await action()
      await queryClient.invalidateQueries({ queryKey: BRANCHES_KEY })
      setRenaming(null)
    } catch (error) {
      setProblem({ areaId: area.id, message: isAppError(error) ? error.message : 'Something went wrong. Please try again.' })
    } finally {
      setBusy(null)
    }
  }

  /** What the area is, in one line: "25 products · deliveries arrive here". */
  function describe(area: Area): string {
    if (!withAreas) return 'where all your stock is now · deliveries arrive here'
    const parts: string[] = []
    if (!area.active) parts.push('Closed')
    if (!area.keepsStock) parts.push("Uses what it's given")
    else if (area.productsInStock != null) parts.push(`${area.productsInStock} ${area.productsInStock === 1 ? 'product' : 'products'}`)
    if (area.delivery) parts.push('deliveries arrive here')
    return parts.join(' · ')
  }

  function menu(area: Area): OverflowMenuItem[] {
    const items: OverflowMenuItem[] = [{ label: 'Rename', onSelect: () => setRenaming(area.id), disabled: !online }]
    if (!withAreas) return items
    if (area.active && area.keepsStock && !area.delivery) {
      items.push({
        label: 'Deliveries arrive here',
        onSelect: () => void act(area, () => areasApi.update(area.id, { delivery: true })),
        disabled: !online,
      })
    }
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
      <h3 className="text-sm font-medium text-neutral-700">Areas</h3>
      <ul className="mt-1 divide-y divide-neutral-100">
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
      {mayAddArea && mayChange && (
        <Button variant="quiet" onClick={onAddAreas} disabled={!online} className="mt-1 -ml-2">
          <Plus className="h-4 w-4" aria-hidden="true" />
          {online ? (withAreas ? 'Add an area' : 'Add areas') : 'Add areas when online'}
        </Button>
      )}
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
