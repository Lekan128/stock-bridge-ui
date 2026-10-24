import { createContext } from 'react'
import type { Branch, WorkingBranchChoice } from '@/features/branches/types'

export interface WorkingBranchValue {
  /** The company has, or has had, two branches. False: render nothing branch-related (rule 1). */
  isMultiBranch: boolean
  /** Every branch this person sees, main first, closed last. */
  branches: Branch[]
  /** Where this phone records: the working branch, or null in "All branches". */
  working: Branch | null
  /** "All branches" is the working choice: figures are the company's, and a write must pick a branch. */
  isAll: boolean
  /** The person sees every branch, so "All branches" is theirs to choose. */
  seesEverywhere: boolean
  /** The open branches this person may record at — what a sheet's Branch field offers. */
  recordable: Branch[]
  /** First open on this phone with more than one place to be: ask "Which branch are you at?" (UX §4.2). */
  needsChoice: boolean
  mayAddBranch: boolean
  /** Every open branch by name, for Send stock's "To" (UX §5.4). Empty for someone who can't send. */
  sendTo: { id: string; name: string }[]
  loading: boolean
  choose: (choice: WorkingBranchChoice) => void
  /** Look a branch up by id, for labels on history rows and receipts. */
  nameOf: (branchId: string | undefined) => string | undefined
}

export const WorkingBranchContext = createContext<WorkingBranchValue | null>(null)
