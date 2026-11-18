import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/Button'
import { Sheet } from '@/components/Sheet'
import { TextField } from '@/components/TextField'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { formatNairaWhole } from '@/utils/money'
import { useWorkingBranch } from '@/features/branches/useWorkingBranch'
import { AddBranchFlow } from '@/features/branches/AddBranchFlow'
import type { Branch } from '@/features/branches/types'

/**
 * Company settings → Branches (MULTI_BRANCH_UX_PLAN.md §5.11; owner, 2026-11-18: not "one big list"): one line per
 * branch with what it holds, each opening its own page (Areas, Accounts, Products). Closed branches fold away. A company
 * with one branch - or someone who sees only one - goes straight to that branch's page.
 */
export function BranchesPage() {
  const { branches, mayAddBranch, isMultiBranch } = useWorkingBranch()
  const online = useOnlineStatus()
  const [adding, setAdding] = useState(false)
  const [showClosed, setShowClosed] = useState(false)
  const open = branches.filter((branch) => branch.active)
  const closed = branches.filter((branch) => !branch.active)

  if (open.length === 1 && closed.length === 0) return <Navigate to={`/app/company/branches/${open[0].id}`} replace />

  const row = (branch: Branch) => {
    const areas = branch.areas?.filter((area) => area.active).length ?? 0
    const accounts = branch.paymentAccounts?.length ?? 0
    return (
      <li key={branch.id}>
        <Link to={`/app/company/branches/${branch.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-neutral-50">
          <span className="min-w-0">
            <span className="flex items-center gap-2 font-medium text-neutral-900">
              <span className="truncate">{branch.name}</span>
              {branch.main && <span className="rounded bg-primary-100 px-1.5 text-xs text-primary-800">Main</span>}
              {!branch.active && <span className="rounded bg-neutral-100 px-1.5 text-xs text-neutral-600">Closed</span>}
            </span>
            {branch.productsInStock != null && (
              <span className="block text-sm tabular-nums text-neutral-600">
                {branch.productsInStock} {branch.productsInStock === 1 ? 'product' : 'products'} in stock · stock worth{' '}
                {formatNairaWhole(branch.stockWorth ?? 0)}
              </span>
            )}
            {branch.active && (
              <span className="block text-sm text-neutral-500">
                {[
                  areas > 1 ? `${areas} areas` : null,
                  branch.people != null ? `${branch.people} ${branch.people === 1 ? 'person' : 'people'}` : null,
                  accounts > 0 ? `${accounts} ${accounts === 1 ? 'account' : 'accounts'}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            )}
            {branch.address && <span className="block truncate text-sm text-neutral-500">{branch.address}</span>}
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-neutral-400" aria-hidden="true" />
        </Link>
      </li>
    )
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Branches</h1>
          <p className="mt-1 text-sm text-neutral-600">
            {isMultiBranch
              ? 'Each branch has its own products and counts its own stock. Prices and suppliers are shared by all of them.'
              : 'Your company has one branch. Add another to count stock at each place separately.'}
          </p>
        </div>
        {mayAddBranch && (
          <Button variant="action" onClick={() => setAdding(true)} disabled={!online} className="shrink-0 whitespace-nowrap">
            {online ? 'Add a branch' : 'Add a branch when online'}
          </Button>
        )}
      </div>

      <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white" aria-label="Branches">
        {open.map(row)}
      </ul>

      {closed.length > 0 && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            aria-expanded={showClosed}
            onClick={() => setShowClosed((value) => !value)}
            className="inline-flex items-center gap-1 self-start text-sm font-semibold text-neutral-600 hover:text-neutral-900"
          >
            Closed branches · {closed.length}
            <ChevronDown className={`h-4 w-4 transition-transform ${showClosed ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {showClosed && (
            <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white" aria-label="Closed branches">
              {closed.map(row)}
            </ul>
          )}
        </div>
      )}
      {!online && <p className="text-sm text-neutral-600">Changing branches needs a connection.</p>}
      {adding && <AddBranchFlow onDone={() => setAdding(false)} />}
    </div>
  )
}

/** A branch's name, phone and address: three fields, so a `Sheet` (DESIGN.md) rather than a form in its row. */
export function BranchEditor({
  branch,
  busy,
  problem,
  onCancel,
  onSave,
}: {
  branch: Branch
  busy: boolean
  problem: string | null
  onCancel: () => void
  onSave: (name: string, phone: string, address: string) => void
}) {
  const [name, setName] = useState(branch.name)
  const [phone, setPhone] = useState(branch.phone ?? '')
  const [address, setAddress] = useState(branch.address ?? '')
  return (
    <Sheet
      open
      onClose={onCancel}
      title={`Edit ${branch.name}`}
      size="sm"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" form="branch-editor" variant="action" loading={busy} disabled={!name.trim()}>
            Save
          </Button>
        </>
      }
    >
      <form
        id="branch-editor"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          onSave(name.trim(), phone.trim(), address.trim())
        }}
      >
        <TextField id={`branch-${branch.id}-name`} label="Name" value={name} onChange={(event) => setName(event.target.value)} />
        <TextField id={`branch-${branch.id}-phone`} label="Phone (optional)" value={phone} onChange={(event) => setPhone(event.target.value)} />
        <TextField id={`branch-${branch.id}-address`} label="Address (optional)" value={address} onChange={(event) => setAddress(event.target.value)} />
        {problem && (
          <p role="alert" className="text-sm text-danger-700">
            {problem}
          </p>
        )}
      </form>
    </Sheet>
  )
}
