import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/Button'
import { Sheet } from '@/components/Sheet'
import { TextField } from '@/components/TextField'
import { useToast } from '@/components/useToast'
import { kindFlags, kindOf, type AreaKind } from '@/features/branches/areas'
import { AreaQuestions } from '@/features/branches/AreaQuestions'
import { areasApi } from '@/features/branches/branchesApi'
import { BRANCHES_KEY } from '@/features/branches/BranchProvider'
import type { Area } from '@/features/branches/types'
import { isAppError } from '@/types/api'

/**
 * Editing one area (owner, 2026-10-31: "renaming takes 3 steps, choosing what is done takes 3 different
 * steps"): everything about it in one Sheet, opened by tapping its row - the way the branch's own Edit
 * works. Its name; two questions, each in its own box with only the chosen answer explained (owner,
 * 2026-10-31: a fourth card under the three read as a fourth answer) - what happens there (D-A12), and what
 * happens when stock is moved there (Part 4); and, at the bottom, closing it (or reopening it). Save applies
 * the lot. A side panel on a laptop, a bottom sheet on a
 * phone. Where deliveries arrive is the branch's setting, in the branch's Edit.
 *
 * @param withAreas false for the Store of a branch that hasn't added areas: only its name is asked.
 */
export function AreaEditSheet({ area, withAreas, onClose }: { area: Area; withAreas: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [name, setName] = useState(area.name)
  const [kind, setKind] = useState<AreaKind>(kindOf(area))
  const [confirms, setConfirms] = useState(area.confirms ?? false)
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
    const changedConfirms = confirms !== (area.confirms ?? false)
    if (!renamed && !changedKind && !changedConfirms) {
      onClose()
      return
    }
    void run(
      'save',
      () =>
        areasApi.update(area.id, {
          ...(renamed ? { name: name.trim() } : {}),
          ...(changedKind ? kindFlags(kind) : {}),
          ...(changedConfirms ? { confirms } : {}),
        }),
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
          <AreaQuestions
            id={`area-${area.id}`}
            name={name || area.name}
            kind={kind}
            confirms={confirms}
            onKind={setKind}
            onConfirms={setConfirms}
            disabled={busy != null}
            delivery={area.delivery}
          />
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

