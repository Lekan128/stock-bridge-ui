import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/Button'
import { Sheet } from '@/components/Sheet'
import { TextField } from '@/components/TextField'
import { useToast } from '@/components/useToast'
import { isAppError } from '@/types/api'
import { areasApi } from '@/features/branches/branchesApi'
import { BRANCHES_KEY } from '@/features/branches/BranchProvider'
import { AREA_KIND_LABEL, hasAreas, kindFlags, suggestedKind, type AreaKind } from '@/features/branches/areas'
import type { Branch } from '@/features/branches/types'

/** The quick picks (STOCK_AREAS_PLAN.md §4.1): the places our restaurants, hotels and shops name. */
const SUGGESTIONS = ['Kitchen', 'Bar', 'Front desk', 'Shop floor', 'Housekeeping']

interface Wanted {
  name: string
  kind: AreaKind
}

/**
 * Adding areas to a branch (STOCK_AREAS_PLAN.md §4.1, STOCK_AREAS_PART_1.md): a task flow, so a `Sheet`
 * (DESIGN.md) - a side panel on a laptop with the branch still in view, a bottom sheet on a phone. One
 * screen: the Store as it is (with "Rename it"), quick picks or a typed name, and each new area with a
 * small "Stored / Worked with / Used up" choice (D-A12) - explained once above the list, not under every
 * row. Where deliveries arrive is not asked: it stays the Store, and moves from an area's "⋯" (owner's
 * comments, 2026-10-30). Online only, like every branch change.
 */
export function AddAreasSheet({ branch, onClose }: { branch: Branch; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const first = !hasAreas(branch)
  const store = branch.areas?.find((area) => area.delivery) ?? branch.areas?.[0]
  const [storeName, setStoreName] = useState(store?.name ?? 'Store')
  const [renamingStore, setRenamingStore] = useState(false)
  const [wanted, setWanted] = useState<Wanted[]>([])
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const currentName = storeName.trim() || store?.name || 'Store'
  const taken = (name: string) =>
    [
      ...(branch.areas ?? []).filter((area) => area.id !== store?.id).map((area) => area.name),
      currentName,
      ...wanted.map((area) => area.name),
    ].some((other) => other.toLowerCase() === name.trim().toLowerCase())

  function addWanted(name: string) {
    const clean = name.trim().replace(/\s+/g, ' ')
    if (!clean || taken(clean)) return
    setWanted((all) => [...all, { name: clean, kind: suggestedKind(clean) }])
    setTyped('')
  }

  async function save() {
    setBusy(true)
    setProblem(null)
    try {
      if (first && store && currentName !== store.name) {
        await areasApi.update(store.id, { name: currentName })
      }
      await areasApi.add(branch.id, wanted.map((area) => ({ name: area.name, ...kindFlags(area.kind) })))
      await queryClient.invalidateQueries({ queryKey: BRANCHES_KEY })
      const total = (branch.areas?.length ?? 1) + wanted.length
      showToast(
        first
          ? `${branch.name} now has ${total} areas. Everything you have is in the ${currentName}.`
          : `${wanted.length === 1 ? wanted[0].name : `${wanted.length} areas`} added to ${branch.name}.`,
        'success',
      )
      onClose()
    } catch (error) {
      setProblem(isAppError(error) ? error.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const saveLabel = wanted.length === 0 ? 'Add areas' : `Add ${wanted.length === 1 ? wanted[0].name : `${wanted.length} areas`}`

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Add areas to ${branch.name}`}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="action" onClick={() => void save()} loading={busy} disabled={wanted.length === 0}>
            {saveLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {first &&
          (renamingStore ? (
            <TextField
              id="current-area-name"
              label="Where your stock is now"
              value={storeName}
              autoFocus
              onFocus={(event) => event.target.select()}
              onChange={(event) => setStoreName(event.target.value)}
              hint="All your current stock stays here."
            />
          ) : (
            <p className="text-sm text-neutral-700">
              Your stock is in the <span className="font-medium text-neutral-900">{currentName}</span>.{' '}
              <button
                type="button"
                onClick={() => setRenamingStore(true)}
                className="inline-flex min-h-11 items-center font-medium text-primary-700 hover:underline"
              >
                Rename it
              </button>
            </p>
          ))}

        <div className="flex flex-col gap-2">
          <p id="area-picks-label" className="text-sm font-medium text-neutral-800">
            Add the other areas
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby="area-picks-label">
            {SUGGESTIONS.filter((name) => !taken(name)).map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => addWanted(name)}
                className="inline-flex min-h-11 items-center gap-1 rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-800 hover:bg-neutral-50"
              >
                <Plus className="h-4 w-4 text-neutral-500" aria-hidden="true" />
                {name}
              </button>
            ))}
          </div>
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              addWanted(typed)
            }}
          >
            <div className="min-w-0 flex-1">
              <TextField
                id="new-area-name"
                label="Or type a name"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                error={typed.trim() && taken(typed) ? `There's already an area called ${typed.trim()}.` : undefined}
              />
            </div>
            <Button type="submit" variant="secondary" disabled={!typed.trim() || taken(typed)}>
              Add
            </Button>
          </form>
        </div>

        {wanted.length > 0 && (
          <div className="flex flex-col gap-2">
            {/* Said once, for every row below (owner's comment: not repeated under each one). */}
            <p className="text-sm text-neutral-600">
              What happens there? Stock is <span className="font-medium text-neutral-800">stored</span> (a store, a cold
              room: anything short at a count is missing), <span className="font-medium text-neutral-800">worked with</span>{' '}
              (a kitchen, a bar: anything short at a count was used), or what it's given is{' '}
              <span className="font-medium text-neutral-800">used up</span> as it arrives (housekeeping). You can change it
              later.
            </p>
            <ul aria-label="Areas to add" className="divide-y divide-neutral-100 border-y border-neutral-100">
              {wanted.map((area, index) => (
                <li key={area.name} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
                  <span className="min-w-0 truncate text-sm font-medium text-neutral-900">{area.name}</span>
                  <div className="flex items-center gap-1">
                    <div role="radiogroup" aria-label={`What happens at ${area.name}`} className="flex rounded-md border border-neutral-300 p-0.5">
                      {(['STORED', 'WORKED', 'USED_UP'] as const).map((kind) => ({ kind, label: AREA_KIND_LABEL[kind] })).map((option) => (
                        <button
                          key={option.label}
                          type="button"
                          role="radio"
                          aria-checked={area.kind === option.kind}
                          onClick={() => setWanted((all) => all.map((other, at) => (at === index ? { ...other, kind: option.kind } : other)))}
                          className={`min-h-9 rounded px-2.5 text-sm ${
                            area.kind === option.kind
                              ? 'bg-primary-100 font-medium text-primary-900'
                              : 'text-neutral-700 hover:bg-neutral-50'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setWanted((all) => all.filter((other) => other.name !== area.name))}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100"
                      aria-label={`Remove ${area.name}`}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {problem && (
          <p role="alert" className="text-sm text-danger-700">
            {problem}
          </p>
        )}
      </div>
    </Sheet>
  )
}
