import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, MapPin, Search } from 'lucide-react'
import { useClickOutside } from '@/hooks/useClickOutside'
import { useToast } from '@/components/useToast'
import { useAuth } from '@/auth/useAuth'
import { PERMISSIONS } from '@/auth/permissions'
import { useWorkingBranch } from '@/features/branches/useWorkingBranch'
import { ALL_BRANCHES, type Branch } from '@/features/branches/types'

/** From this many branches the menu gets a search field (Avatar C, UX §4.1). */
const SEARCH_FROM = 8
/** Longer names are cut on the chip; the menu and the accessible name carry the whole name. */
const CHIP_CHARS = 18

const itemClassName =
  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 focus-visible:bg-neutral-50'

function short(name: string) {
  return name.length > CHIP_CHARS ? `${name.slice(0, CHIP_CHARS - 1)}…` : name
}

/**
 * Where this phone is (MULTI_BRANCH_UX_PLAN.md §4.1): the branch name in the top bar, and, for anyone
 * with somewhere else to be, a menu to change it. Nothing at a one-branch company (rule 1). Switching
 * is instant and quiet - a toast, no confirmation: it is safe and as easily switched back.
 */
export function BranchChip() {
  const { isMultiBranch, branches, working, isAll, seesEverywhere, choose } = useWorkingBranch()
  const { showToast } = useToast()
  const { user } = useAuth()
  const managesBranches = user?.permissions.includes(PERMISSIONS.MANAGE_BRANCHES) ?? false
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false))

  if (!isMultiBranch) return null

  const open_ = branches.filter((branch) => branch.active)
  const label = isAll ? 'All branches' : (working?.name ?? 'Choose a branch')
  const mine = open_.filter((branch) => branch.canRecord)
  const viewOnly = open_.filter((branch) => !branch.canRecord)
  const onlyOne = mine.length + viewOnly.length <= 1 && !seesEverywhere

  // One place to be: the name, as plain text. It still says where they are.
  if (onlyOne) {
    return (
      <span className="flex max-w-[12rem] items-center gap-1.5 truncate rounded-md px-2 py-1 text-sm text-neutral-700" title={label}>
        <MapPin className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden />
        <span className="truncate">{short(label)}</span>
      </span>
    )
  }

  const filter = (list: Branch[]) =>
    search ? list.filter((branch) => branch.name.toLowerCase().includes(search.toLowerCase())) : list

  function pick(id: string, name: string) {
    setOpen(false)
    setSearch('')
    choose(id)
    showToast(id === ALL_BRANCHES ? 'Now showing all branches' : `Now at ${name}`, 'info')
  }

  const row = (branch: Branch, current: boolean) => (
    <button
      key={branch.id}
      type="button"
      role="menuitemradio"
      aria-checked={current}
      onClick={() => pick(branch.id, branch.name)}
      className={itemClassName}
    >
      <Check className={`h-4 w-4 shrink-0 ${current ? 'text-primary-600' : 'invisible'}`} aria-hidden />
      <span className="truncate">{branch.name}</span>
      {branch.main && <span className="ml-auto shrink-0 text-xs text-neutral-500">Main</span>}
    </button>
  )

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex max-w-[12rem] items-center gap-1.5 rounded-md border px-2 py-1 text-sm text-neutral-800 hover:bg-neutral-50 ${
          open ? 'border-primary-200 bg-primary-100' : 'border-neutral-200 bg-white'
        }`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Branch: ${label}. Change branch`}
      >
        <MapPin className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden />
        <span className="truncate">{short(label)}</span>
        {working && !working.canRecord && !isAll && (
          <span className="shrink-0 rounded bg-neutral-100 px-1 text-xs text-neutral-600">View only</span>
        )}
        <ChevronDown className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden />
      </button>
      {open && (
        <div role="menu" aria-label="Branches" className="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
          {open_.length >= SEARCH_FROM && (
            <label className="flex items-center gap-2 border-b border-neutral-100 px-3 py-2">
              <Search className="h-4 w-4 text-neutral-500" aria-hidden />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Find a branch"
                aria-label="Find a branch"
                className="w-full text-sm outline-none"
              />
            </label>
          )}
          {filter(mine).map((branch) => row(branch, !isAll && working?.id === branch.id))}
          {filter(viewOnly).length > 0 && (
            <>
              <p className="mt-1 border-t border-neutral-100 px-3 pb-1 pt-2 text-xs font-medium text-neutral-500">View only</p>
              {filter(viewOnly).map((branch) => row(branch, !isAll && working?.id === branch.id))}
            </>
          )}
          {seesEverywhere && (
            <button
              type="button"
              role="menuitemradio"
              aria-checked={isAll}
              onClick={() => pick(ALL_BRANCHES, 'All branches')}
              className={`${itemClassName} mt-1 border-t border-neutral-100`}
            >
              <Check className={`h-4 w-4 shrink-0 ${isAll ? 'text-primary-600' : 'invisible'}`} aria-hidden />
              All branches
            </button>
          )}
          {managesBranches && (
          <Link
            to="/app/company/branches"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={`${itemClassName} border-t border-neutral-100 text-primary-700`}
          >
            Manage branches
          </Link>
          )}
        </div>
      )}
    </div>
  )
}
