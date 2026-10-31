import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/Button'
import { Sheet } from '@/components/Sheet'
import { TextField } from '@/components/TextField'
import { useToast } from '@/components/useToast'
import { AREA_KINDS, AREA_KIND_ORDER, kindFlags, kindOf, type AreaKind } from '@/features/branches/areas'
import { areasApi } from '@/features/branches/branchesApi'
import { BRANCHES_KEY } from '@/features/branches/BranchProvider'
import type { Area } from '@/features/branches/types'
import { isAppError } from '@/types/api'

/**
 * Editing one area (owner, 2026-10-31: "renaming takes 3 steps, choosing what is done takes 3 different
 * steps"): everything about it in one Sheet, opened by tapping its row - the way the branch's own Edit
 * works. Its name; what happens there, asked in words with each answer explained (D-A12); and, at the
 * bottom, closing it (or reopening it). Save applies the lot. A side panel on a laptop, a bottom sheet on a
 * phone. Where deliveries arrive is the branch's setting, in the branch's Edit.
 *
 * @param withAreas false for the Store of a branch that hasn't added areas: only its name is asked.
 */
export function AreaEditSheet({ area, withAreas, onClose }: { area: Area; withAreas: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [name, setName] = useState(area.name)
  const [kind, setKind] = useState<AreaKind>(kindOf(area))
  const [busy, setBusy] = useState<'save' | 'close' | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  async function run(which: 'save' | 'close', action: () => Promise<unknown>, said: string) {
    setBusy(which)
    setProblem(null)
    try {
      await action()
      await queryClient.invalidateQueries({ queryKey: BRANCHES_KEY })
      showToast(said, 'success')
      onClose()
    } catch (error) {
      setProblem(isAppError(error) ? error.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  function save() {
    const renamed = name.trim() !== area.name
    const changedKind = kind !== kindOf(area)
    if (!renamed && !changedKind) {
      onClose()
      return
    }
    void run(
      'save',
      () => areasApi.update(area.id, { ...(renamed ? { name: name.trim() } : {}), ...(changedKind ? kindFlags(kind) : {}) }),
      `${name.trim()} saved`,
    )
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Edit ${area.name}`}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="action" onClick={save} loading={busy === 'save'} disabled={!name.trim() || busy != null}>
            Save
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault()
          save()
        }}
      >
        <TextField id={`area-${area.id}-name`} label="Name" value={name} onChange={(event) => setName(event.target.value)} />

        {withAreas && area.active && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-neutral-800">What happens here?</legend>
            {AREA_KIND_ORDER.map((option) => {
              const answer = AREA_KINDS[option]
              // Where deliveries arrive keeps stock: it can't be an area that uses what it's given.
              const off = area.delivery && option === 'USED_UP'
              return (
                <label
                  key={option}
                  className={`flex gap-3 rounded-lg border p-3 ${
                    kind === option ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 bg-white'
                  } ${off ? 'opacity-60' : 'cursor-pointer hover:border-neutral-300'}`}
                >
                  <input
                    type="radio"
                    name={`area-kind-${area.id}`}
                    value={option}
                    checked={kind === option}
                    disabled={off || busy != null}
                    onChange={() => setKind(option)}
                    className="mt-1 h-4 w-4 shrink-0"
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-base font-medium text-neutral-900">{answer.title}</span>
                      <span className="text-sm text-neutral-600">{answer.like}</span>
                    </span>
                    <span className="text-sm text-neutral-700">{off ? 'Deliveries arrive here, so it keeps stock.' : answer.means}</span>
                  </span>
                </label>
              )
            })}
          </fieldset>
        )}

        {problem && (
          <p role="alert" className="text-sm text-danger-700">
            {problem}
          </p>
        )}

        {/* Rare, and the server says when it can't be done yet ("the Bar still has 14 items"). */}
        {withAreas && !area.delivery && (
          <div className="flex flex-col items-start gap-1 border-t border-neutral-100 pt-4">
            {area.active ? (
              <>
                {/* Quiet: the rarest thing here, never louder than Save (DESIGN.md: one action button). */}
                <button
                  type="button"
                  disabled={busy != null}
                  onClick={() => void run('close', () => areasApi.close(area.id), `${area.name} closed`)}
                  className="-ml-1 inline-flex min-h-11 items-center px-1 text-sm font-medium text-danger-700 hover:underline disabled:opacity-60"
                >
                  {busy === 'close' ? `Closing ${area.name}…` : `Close ${area.name}`}
                </button>
                <p className="text-xs text-neutral-600">Only when it's empty. Its history stays, and you can reopen it.</p>
              </>
            ) : (
              <Button
                type="button"
                variant="secondary"
                loading={busy === 'close'}
                disabled={busy != null}
                onClick={() => void run('close', () => areasApi.reopen(area.id), `${area.name} reopened`)}
              >
                Reopen {area.name}
              </Button>
            )}
          </div>
        )}
      </form>
    </Sheet>
  )
}
