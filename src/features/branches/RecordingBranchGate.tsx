import type { ReactNode } from 'react'
import { useWorkingBranch } from '@/features/branches/useWorkingBranch'

/**
 * Quick mode, Record a sale, Record a delivery and a stock sheet's upload have no form to hold a Branch
 * field (§5.12: "Which branch is this stock for?"). In "All
 * branches" they first ask where the person is (MULTI_BRANCH_UX_PLAN.md §4.3, "asks for a branch
 * before the first scan"), and the answer becomes the phone's branch - which the chip then shows.
 * Everywhere else, and at a one-branch company, it renders its children untouched.
 */
export function RecordingBranchGate({
  children,
  doing,
  question,
}: {
  children: ReactNode
  doing?: string
  /** The question in full, where "Which branch are you … at?" doesn't fit (a stock sheet). */
  question?: string
}) {
  const { isMultiBranch, isAll, recordable, choose } = useWorkingBranch()
  if (!isMultiBranch || !isAll) return <>{children}</>

  return (
    <div className="mx-auto mt-10 max-w-md rounded-xl border border-neutral-200 bg-white p-6">
      <h1 className="text-lg font-semibold text-neutral-900">{question ?? `Which branch are you ${doing ?? 'recording'} at?`}</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Everything you record here goes to this branch. You can change it from the top bar.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        {recordable.map((branch) => (
          <button
            key={branch.id}
            type="button"
            onClick={() => choose(branch.id)}
            className="rounded-lg border border-neutral-200 px-4 py-3 text-left text-sm font-medium text-neutral-900 hover:border-primary-500 hover:bg-primary-50"
          >
            {branch.name}
          </button>
        ))}
        {recordable.length === 0 && (
          <p className="text-sm text-neutral-600">You don't work at any open branch, so there is nowhere to record.</p>
        )}
      </div>
    </div>
  )
}
