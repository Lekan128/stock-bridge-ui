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

/**
 * The areas this phone is looking at (STOCK_AREAS_PART_3_6.md) - the top bar's area chooser; null for the
 * whole branch. Kept in step by `BranchProvider`, read by the same report calls.
 */
let viewingAreas: string[] | null = null

export function setViewingAreas(areaIds: string[] | null) {
  viewingAreas = areaIds
}

/** `{ areaIds: "a,b" }` for a report's params, or nothing for the whole branch. */
export function viewingAreaParams(): { areaIds?: string } {
  return viewingAreas && viewingAreas.length > 0 ? { areaIds: viewingAreas.join(',') } : {}
}
