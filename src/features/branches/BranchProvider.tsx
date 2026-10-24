import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { setViewingBranch } from '@/features/branches/viewingBranch'
import { useToast } from '@/components/useToast'
import { queryKeys } from '@/data/queryKeys'
import { track } from '@/marketing/analytics'
import { setRecordingBranch } from '@/features/outbox/outboxStore'
import { resyncCatalog } from '@/features/catalog/catalogStore'
import { useCatalogState } from '@/features/catalog/useCatalog'
import { useAuth } from '@/auth/useAuth'
import { useApiQuery } from '@/data/useApiQuery'
import { branchesApi } from '@/features/branches/branchesApi'
import { ALL_BRANCHES, type Branch, type BranchList, type WorkingBranchChoice } from '@/features/branches/types'
import { WorkingBranchContext, type WorkingBranchValue } from '@/features/branches/workingBranchContext'

export const BRANCHES_KEY = ['branches'] as const

// The context lives on its own (`workingBranchContext.ts`): the landing page's receipt reads it, and
// must not pull this provider's queries and catalogue into the marketing bundle.
export { WorkingBranchContext, type WorkingBranchValue } from '@/features/branches/workingBranchContext'

/** The server's ProductSyncService.WIDE: past this many branches, sync carries one branch's figures. */
export const WIDE = 10

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

function forgetChoice(userId: string) {
  try {
    window.localStorage.removeItem(storageKey(userId))
  } catch {
    // Storage blocked: nothing was remembered to forget.
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
      // UX §10: switches per session (high means the phone isn't really at one branch). No names.
      track('branch_switched', { to: choice === ALL_BRANCHES ? 'all' : 'branch' })
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
      openBranches: list?.openBranches ?? open.length,
      sendTo: list?.sendTo ?? [],
      loading: query.loading,
      choose,
      // A branch the person doesn't see is still named on a waybill they send or receive.
      nameOf: (branchId) =>
        branchId ? (byId.get(branchId)?.name ?? list?.sendTo?.find((entry) => entry.id === branchId)?.name) : undefined,
    }
  }, [query.data, query.loading, chosen, choose])

  // The branch this phone was at has closed, or the person no longer works there (UX §6): say so once,
  // rather than let the figures change under the same screen without a word.
  const { showToast } = useToast()
  const toldAbout = useRef<string | null>(null)
  const list = query.data
  useEffect(() => {
    if (!list?.multiBranch || !chosen || chosen === ALL_BRANCHES || toldAbout.current === chosen) return
    const was = list.branches.find((branch) => branch.id === chosen)
    if (was?.active) return
    toldAbout.current = chosen
    const name = was?.name ?? list.sendTo?.find((entry) => entry.id === chosen)?.name
    showToast(
      was ? `${was.name} has closed. This phone isn't at it any more.` : name ? `You no longer work at ${name}.` : 'You no longer work at that branch.',
      'info',
    )
    // Forgotten once said, so the next open asks where the phone is rather than saying it again.
    setChosen(null)
    if (userId) forgetChoice(userId)
  }, [list, chosen, showToast, userId])

  // The on-phone catalogue's rows carry a figure per branch this person sees: when that set changes,
  // fetch a fresh copy (once per change, per phone; remembered so a reload doesn't fetch it again).
  // Past WIDE branches (a chain) rows carry the working branch's figure only, so changing branch is a
  // change of what the phone holds, too (MULTI_BRANCH_BUILD_PLAN.md §6.1).
  // Open branches only, as the server sends them: closing one changes what the rows carry.
  const openIds = value.branches.filter((branch) => branch.active).map((branch) => branch.id)
  const wide = openIds.length > WIDE
  const seenKey = !value.isMultiBranch
    ? ''
    : wide
      ? `wide:${value.isAll ? 'ALL' : (value.working?.id ?? '')}`
      : openIds.sort().join(',')
  // Only once a copy is on the device: resetting one mid-download would start a second download beside
  // it. Until then the list reads the server, which answers for the branch being viewed.
  const catalogOpen = useCatalogState().phase === 'ready'
  const viewing = value.isMultiBranch && !value.isAll ? (value.working?.id ?? null) : null
  useEffect(() => {
    if (!userId || !seenKey || !catalogOpen) return
    // The download asks for the branch being viewed: say which before it starts (the effect that
    // usually does this runs after this one).
    setViewingBranch(viewing)
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
  }, [userId, seenKey, catalogOpen, viewing])

  // Reports (movements, analytics) ask for the branch being viewed. Their cached answers are not keyed
  // by branch, so a switch drops them: a figure from one branch must never show under another's name.
  const queryClient = useQueryClient()
  const viewAt = value.isMultiBranch && !value.isAll ? (value.working?.id ?? null) : null
  const lastViewAt = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    setViewingBranch(viewAt)
    if (lastViewAt.current !== undefined && lastViewAt.current !== viewAt) {
      for (const key of [
        ['analytics'],
        ['stock-movements'],
        ['products', 'history'],
        ['products', 'list'],
        ['sales-report'],
        ['sold-this-month'],
        ['stock-worth'],
        ['losses'],
        ['expected'],
      ]) {
        queryClient.removeQueries({ queryKey: key })
      }
    }
    // The low-stock alerts sit above this provider and stay mounted, so they are asked again rather
    // than dropped - and on the first open at a branch too, in case they were asked before it was known.
    if (lastViewAt.current !== viewAt && (lastViewAt.current !== undefined || viewAt != null)) {
      void queryClient.resetQueries({ queryKey: queryKeys.products.lowStock })
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
