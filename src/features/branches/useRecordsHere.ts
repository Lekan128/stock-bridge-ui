import { useOptionalWorkingBranch } from '@/features/branches/useWorkingBranch'

/**
 * Whether this phone may record where it is (MULTI_BRANCH_UX_PLAN.md §4.1): at a branch the person
 * only views ("View only" beside the chip) every record button is hidden - stock in, out, count,
 * sale, send, receive. True at a one-branch company, and in "All branches", where a sheet asks for a
 * branch it may record at.
 */
export function useRecordsHere(): boolean {
  const branch = useOptionalWorkingBranch()
  if (!branch || !branch.isMultiBranch || branch.isAll) return true
  return branch.working?.canRecord ?? true
}
