import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/Button'
import { Sheet } from '@/components/Sheet'
import { useToast } from '@/components/useToast'
import { AREA_KINDS, AREA_KIND_ORDER, kindFlags, kindOf, type AreaKind } from '@/features/branches/areas'
import { areasApi } from '@/features/branches/branchesApi'
import type { Area } from '@/features/branches/types'
import { isAppError } from '@/types/api'
import { BRANCHES_KEY } from '@/features/branches/BranchProvider'

/**
 * "What happens at the Kitchen?" (D-A12, owner 2026-10-31): the question asked in words, each answer with an
 * example and what it does, at the moment of choosing - not a legend above a column of dropdowns. A Sheet
 * (DESIGN.md: a task with a form): a side panel on a laptop, a bottom sheet on a phone.
 */
export function AreaKindSheet({ area, onClose }: { area: Area; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [chosen, setChosen] = useState<AreaKind>(kindOf(area))
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  async function save() {
    if (chosen === kindOf(area)) {
      onClose()
      return
    }
    setBusy(true)
    setProblem(null)
    try {
      await areasApi.update(area.id, kindFlags(chosen))
      await queryClient.invalidateQueries({ queryKey: BRANCHES_KEY })
      showToast(`${area.name}: ${AREA_KINDS[chosen].short}`, 'success')
      onClose()
    } catch (error) {
      setProblem(isAppError(error) ? error.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`What happens at the ${area.name}?`}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="action" onClick={() => void save()} loading={busy}>
            Save
          </Button>
        </>
      }
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">What happens at the {area.name}?</legend>
        {AREA_KIND_ORDER.map((kind) => {
          const answer = AREA_KINDS[kind]
          // Where deliveries arrive keeps stock: it can't be an area that uses what it's given.
          const off = area.delivery && kind === 'USED_UP'
          return (
            <label
              key={kind}
              className={`flex gap-3 rounded-lg border p-3 ${
                chosen === kind ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 bg-white'
              } ${off ? 'opacity-60' : 'cursor-pointer hover:border-neutral-300'}`}
            >
              <input
                type="radio"
                name={`area-kind-${area.id}`}
                value={kind}
                checked={chosen === kind}
                disabled={off || busy}
                onChange={() => setChosen(kind)}
                className="mt-1 h-4 w-4 shrink-0"
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-base font-medium text-neutral-900">{answer.title}</span>
                  <span className="text-sm text-neutral-600">{answer.like}</span>
                </span>
                <span className="text-sm text-neutral-700">
                  {off ? 'Deliveries arrive here, so it keeps stock.' : answer.means}
                </span>
              </span>
            </label>
          )
        })}
      </fieldset>
      {problem && (
        <p role="alert" className="mt-3 text-sm text-danger-700">
          {problem}
        </p>
      )}
    </Sheet>
  )
}
