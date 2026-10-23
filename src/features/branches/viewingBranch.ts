/**
 * The branch this phone is LOOKING at - the working branch, view-only ones included; null in "All
 * branches" and at a one-branch company. Kept in step by `BranchProvider`, and read by the report calls
 * (movements, analytics) so they ask for that branch's figures. Distinct from the recording branch
 * (`outboxStore.recordingBranchId`): a person may view a branch they can't record at.
 */
let viewingBranch: string | null = null

export function setViewingBranch(branchId: string | null) {
  viewingBranch = branchId
}

export function viewingBranchId(): string | undefined {
  return viewingBranch ?? undefined
}
