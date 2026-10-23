import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { setViewingBranch } from '@/features/branches/viewingBranch'
import { setRecordingBranch } from '@/features/outbox/outboxStore'
import { resyncCatalog } from '@/features/catalog/catalogStore'
import { useAuth } from '@/auth/useAuth'
import { useApiQuery } from '@/data/useApiQuery'
import { branchesApi } from '@/features/branches/branchesApi'
import { ALL_BRANCHES, type Branch, type BranchList, type WorkingBranchChoice } from '@/features/branches/types'

export const BRANCHES_KEY = ['branches'] as const

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

function storageKey(userId: string) {
  return `pp.working-branch.${userId}`
}

/** Remembered per person per phone (UX §4.2): a phone usually lives at one depot. */
function readChoice(userId: string | undefined): WorkingBranchChoice | null {
  if (!userId) return null
  try {
    return window.localStorage.getItem(storageKey(userId))
  } catch {
    return null
  }
}

function writeChoice(userId: string, choice: WorkingBranchChoice) {
  try {
    window.localStorage.setItem(storageKey(userId), choice)
  } catch {
    // Private mode or storage blocked: the choice holds for this visit, and is asked again next time.
  }
}

/**
 * Which branch this phone is at (MULTI_BRANCH_UX_PLAN.md §4). Reads `GET /api/branches`, kept on the
 * device like the rest of the workspace so the chip and the choice work offline. A one-branch company
 * gets `isMultiBranch: false` and the one branch as `working`, and every branch-aware screen renders as
 * it did before branches existed.
 */
export function BranchProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id
  const query = useApiQuery<BranchList>({
    queryKey: BRANCHES_KEY,
    queryFn: branchesApi.list,
    fallbackError: "Couldn't load your branches.",
    enabled: user?.type === 'tenant',
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })
  const [chosen, setChosen] = useState<WorkingBranchChoice | null>(() => readChoice(userId))
  const [chosenFor, setChosenFor] = useState(userId)
  if (chosenFor !== userId) {
    // A different person on this phone: their own remembered choice, not the last person's.
    setChosenFor(userId)
    setChosen(readChoice(userId))
  }

  const choose = useCallback(
    (choice: WorkingBranchChoice) => {
      setChosen(choice)
      if (userId) writeChoice(userId, choice)
    },
    [userId],
  )

  const value = useMemo<WorkingBranchValue>(() => {
    const list = query.data
    const branches = list?.branches ?? []
    const open = branches.filter((branch) => branch.active)
    const recordable = open.filter((branch) => branch.canRecord)
    const isMultiBranch = list?.multiBranch ?? false
    const seesEverywhere = list?.seesEverywhere ?? false
    const byId = new Map(branches.map((branch) => [branch.id, branch]))

    let working: Branch | null = null
    let isAll = false
    let needsChoice = false
    if (!isMultiBranch) {
      working = open[0] ?? branches[0] ?? null
    } else if (chosen === ALL_BRANCHES && seesEverywhere) {
      isAll = true
    } else if (chosen && byId.get(chosen)?.active) {
      working = byId.get(chosen) ?? null
    } else if (open.length === 1 && !seesEverywhere) {
      // One place to be: no question to ask.
      working = open[0]
    } else {
      // Nothing remembered (or a branch since closed or taken away): ask once. Until answered, the
      // screens behind the question read as "All branches" for those who may, else the first branch.
      needsChoice = list != null
      if (seesEverywhere) isAll = true
      else working = recordable[0] ?? open[0] ?? null
    }

    return {
      isMultiBranch,
      branches,
      working,
      isAll,
      seesEverywhere,
      recordable,
      needsChoice,
      mayAddBranch: list?.mayAddBranch ?? false,
      sendTo: list?.sendTo ?? [],
      loading: query.loading,
      choose,
      // A branch the person doesn't see is still named on a waybill they send or receive.
      nameOf: (branchId) =>
        branchId ? (byId.get(branchId)?.name ?? list?.sendTo?.find((entry) => entry.id === branchId)?.name) : undefined,
    }
  }, [query.data, query.loading, chosen, choose])

  // The on-phone catalogue's rows carry a figure per branch this person sees: when that set changes,
  // fetch a fresh copy (once per change, per phone; remembered so a reload doesn't fetch it again).
  const seenKey = value.isMultiBranch ? value.branches.map((branch) => branch.id).sort().join(',') : ''
  useEffect(() => {
    if (!userId || !seenKey) return
    const storageName = `pp.catalog-branches.${userId}`
    let previous: string | null = null
    try {
      previous = window.localStorage.getItem(storageName)
    } catch {
      // Unreadable storage: treat as unchanged rather than re-download on every open.
      return
    }
    if (previous === seenKey) return
    void resyncCatalog().then((started) => {
      if (!started) return
      try {
        window.localStorage.setItem(storageName, seenKey)
      } catch {
        // Not remembered: asked again next open, which is only a re-download.
      }
    })
  }, [userId, seenKey])

  // Reports (movements, analytics) ask for the branch being viewed. Their cached answers are not keyed
  // by branch, so a switch drops them: a figure from one branch must never show under another's name.
  const queryClient = useQueryClient()
  const viewAt = value.isMultiBranch && !value.isAll ? (value.working?.id ?? null) : null
  const lastViewAt = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    setViewingBranch(viewAt)
    if (lastViewAt.current !== undefined && lastViewAt.current !== viewAt) {
      for (const key of [['analytics'], ['stock-movements'], ['products', 'history']]) {
        queryClient.removeQueries({ queryKey: key })
      }
    }
    lastViewAt.current = viewAt
  }, [viewAt, queryClient])

  // Writes are stamped with where this phone is (rule 3) - only at a multi-branch company, so a single
  // shop's requests stay exactly as they were.
  const recordAt = value.isMultiBranch && value.working?.canRecord ? value.working.id : null
  useEffect(() => {
    setRecordingBranch(recordAt)
    return () => setRecordingBranch(null)
  }, [recordAt])

  return <WorkingBranchContext.Provider value={value}>{children}</WorkingBranchContext.Provider>
}
