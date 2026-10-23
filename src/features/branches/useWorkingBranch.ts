import { useContext } from 'react'
import { WorkingBranchContext, type WorkingBranchValue } from '@/features/branches/BranchProvider'

/** Where this phone is (UX §4). Every branch-aware screen reads this, never the API directly. */
export function useWorkingBranch(): WorkingBranchValue {
  const value = useContext(WorkingBranchContext)
  if (!value) {
    throw new Error('useWorkingBranch must be used inside a BranchProvider')
  }
  return value
}
