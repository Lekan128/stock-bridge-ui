import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { isAppError } from '@/types/api'
import { areasApi } from '@/features/branches/branchesApi'
import { BRANCHES_KEY } from '@/features/branches/BranchProvider'
import { hasAreas } from '@/features/branches/areas'
import type { Area, Branch } from '@/features/branches/types'

/**
 * A branch's areas on the Branches page (STOCK_AREAS_PLAN.md §4.1, §5.8). A branch without areas shows
 * only "Add areas", for someone who may - nothing else about areas exists for it (rule 1). Once it has
 * them: each area with what it holds, and the changes an area takes - rename, where deliveries arrive,
 * keeps stock or uses what it's given, close, reopen. Online only, like the rest of the page; every
 * refusal is the server's own sentence.
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
  const [busy, setBusy] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [problem, setProblem] = useState<{ areaId: string; message: string } | null>(null)
  // Changing an area is for someone who works at the branch (the server checks it again).
  const mayChange = branch.active && branch.canRecord

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

  if (!hasAreas(branch)) {
    if (!mayAddArea || !mayChange) return null
    return (
      <div>
        <Button variant="quiet" onClick={onAddAreas} disabled={!online}>
          {online ? 'Add areas' : 'Add areas when online'}
        </Button>
      </div>
    )
  }

  const areas = branch.areas ?? []
  return (
    <section aria-label={`Areas at ${branch.name}`} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-neutral-900">Areas</h3>
        {mayAddArea && mayChange && (
          <Button variant="quiet" onClick={onAddAreas} disabled={!online}>
            Add an area
          </Button>
        )}
      </div>
      <ul className="mt-2 divide-y divide-neutral-200">
        {areas.map((area) => (
          <li key={area.id} className="flex flex-col gap-2 py-2" data-area={area.name}>
            {renaming === area.id ? (
              <RenameArea
                area={area}
                busy={busy === area.id}
                onCancel={() => setRenaming(null)}
                onSave={(name) => void act(area, () => areasApi.update(area.id, { name }))}
              />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-neutral-900">
                    <span className="truncate">{area.name}</span>
                    {area.delivery && <span className="rounded bg-primary-100 px-1.5 text-xs text-primary-800">Deliveries arrive here</span>}
                    {!area.keepsStock && <span className="rounded bg-neutral-200 px-1.5 text-xs text-neutral-700">Uses what it's given</span>}
                    {!area.active && <span className="rounded bg-neutral-200 px-1.5 text-xs text-neutral-700">Closed</span>}
                  </p>
                  {area.productsInStock != null && area.keepsStock && (
                    <p className="text-xs text-neutral-600">
                      {area.productsInStock} {area.productsInStock === 1 ? 'product' : 'products'} in stock
                    </p>
                  )}
                </div>
                {mayChange && (
                  <div className="flex flex-wrap gap-1">
                    <Button variant="quiet" onClick={() => setRenaming(area.id)} disabled={!online}>
                      Rename
                    </Button>
                    {area.active && area.keepsStock && !area.delivery && (
                      <Button variant="quiet" loading={busy === area.id} disabled={!online}
                        onClick={() => void act(area, () => areasApi.update(area.id, { delivery: true }))}>
                        Deliveries arrive here
                      </Button>
                    )}
                    {area.active && !area.delivery && (
                      <Button variant="quiet" loading={busy === area.id} disabled={!online}
                        onClick={() => void act(area, () => areasApi.update(area.id, { keepsStock: !area.keepsStock }))}>
                        {area.keepsStock ? "Change to uses what it's given" : 'Change to keeps stock'}
                      </Button>
                    )}
                    {area.active && !area.delivery && (
                      <Button variant="quiet" loading={busy === area.id} disabled={!online}
                        onClick={() => void act(area, () => areasApi.close(area.id))}>
                        Close
                      </Button>
                    )}
                    {!area.active && (
                      <Button variant="quiet" loading={busy === area.id} disabled={!online}
                        onClick={() => void act(area, () => areasApi.reopen(area.id))}>
                        Reopen
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
            {problem?.areaId === area.id && (
              <p role="alert" className="text-sm text-danger-700">
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
