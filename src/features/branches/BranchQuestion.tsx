import { useState } from 'react'
import { Button } from '@/components/Button'
import { useWorkingBranch } from '@/features/branches/useWorkingBranch'
import { ALL_BRANCHES, type WorkingBranchChoice } from '@/features/branches/types'

/**
 * "Which branch are you at?" (MULTI_BRANCH_UX_PLAN.md §4.2): once per person per phone, for anyone with
 * more than one place to be. The one full-screen interruption in the branch interface. Not guessed from
 * GPS: wrong at the boundary between two neighbouring depots, and wrong silently.
 */
export function BranchQuestion() {
  const { needsChoice, branches, seesEverywhere, choose } = useWorkingBranch()
  const open = branches.filter((branch) => branch.active)
  const [picked, setPicked] = useState<WorkingBranchChoice | null>(seesEverywhere ? ALL_BRANCHES : null)

  if (!needsChoice) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="branch-question-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-neutral-50 p-4"
    >
      <form
        className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault()
          if (picked) choose(picked)
        }}
      >
        <h1 id="branch-question-title" className="text-xl font-semibold text-neutral-900">
          Which branch are you at?
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          Stock you record on this phone will go to this branch. You can change it any time from the top bar.
        </p>
        <fieldset className="mt-5 space-y-2">
          <legend className="sr-only">Branch</legend>
          {open.map((branch) => (
            <label
              key={branch.id}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 text-sm ${
                picked === branch.id ? 'border-primary-500 bg-primary-50' : 'border-neutral-200'
              }`}
            >
              <input
                type="radio"
                name="branch"
                value={branch.id}
                checked={picked === branch.id}
                onChange={() => setPicked(branch.id)}
              />
              <span className="font-medium text-neutral-900">{branch.name}</span>
              {!branch.canRecord && <span className="ml-auto text-xs text-neutral-500">View only</span>}
            </label>
          ))}
          {seesEverywhere && (
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 text-sm ${
                picked === ALL_BRANCHES ? 'border-primary-500 bg-primary-50' : 'border-neutral-200'
              }`}
            >
              <input
                type="radio"
                name="branch"
                value={ALL_BRANCHES}
                checked={picked === ALL_BRANCHES}
                onChange={() => setPicked(ALL_BRANCHES)}
              />
              <span className="font-medium text-neutral-900">All branches</span>
              <span className="ml-auto text-xs text-neutral-500">You'll pick a branch when you record</span>
            </label>
          )}
        </fieldset>
        <Button type="submit" variant="action" className="mt-6 w-full" disabled={!picked}>
          Continue
        </Button>
      </form>
    </div>
  )
}
