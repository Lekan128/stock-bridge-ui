import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { isAppError } from '@/types/api'
import { formatNairaWhole } from '@/utils/money'
import { branchesApi } from '@/features/branches/branchesApi'
import { BRANCHES_KEY } from '@/features/branches/BranchProvider'
import { useWorkingBranch } from '@/features/branches/useWorkingBranch'
import { AddBranchFlow } from '@/features/branches/AddBranchFlow'
import type { Branch } from '@/features/branches/types'

/**
 * Company settings → Branches (MULTI_BRANCH_UX_PLAN.md §5.11): every branch with what it holds, and the
 * changes a branch takes - rename, address and phone, make main, close, reopen. A branch is a shared record, so this
 * is online only (Pattern C.5), and every refusal is the server's own sentence with the way out in it.
 */
export function BranchesPage() {
  const { branches, mayAddBranch, isMultiBranch, recordable, choose } = useWorkingBranch()
  const navigate = useNavigate()
  const online = useOnlineStatus()
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [problem, setProblem] = useState<{ branchId: string; message: string } | null>(null)

  async function act(branch: Branch, action: () => Promise<unknown>) {
    setBusy(branch.id)
    setProblem(null)
    try {
      await action()
      await queryClient.invalidateQueries({ queryKey: BRANCHES_KEY })
      setEditing(null)
    } catch (error) {
      setProblem({ branchId: branch.id, message: isAppError(error) ? error.message : 'Something went wrong. Please try again.' })
    } finally {
      setBusy(null)
    }
  }

  if (adding) {
    return <AddBranchFlow onDone={() => setAdding(false)} />
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Branches</h1>
          <p className="mt-1 text-sm text-neutral-600">
            {isMultiBranch
              ? 'Stock is counted at each branch. Products, prices and suppliers are shared by all of them.'
              : 'Your company has one branch. Add another to count stock at each place separately.'}
          </p>
        </div>
        {mayAddBranch && (
          <Button variant="action" onClick={() => setAdding(true)} disabled={!online}>
            {online ? 'Add a branch' : 'Add a branch when online'}
          </Button>
        )}
      </div>

      <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
        {branches.map((branch) => (
          <li key={branch.id} className="flex flex-col gap-2 p-4">
            {editing === branch.id ? (
              <BranchEditor
                branch={branch}
                busy={busy === branch.id}
                onCancel={() => setEditing(null)}
                onSave={(name, phone, address) => void act(branch, () => branchesApi.update(branch.id, { name, phone, address }))}
              />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium text-neutral-900">
                    <span className="truncate">{branch.name}</span>
                    {branch.main && <span className="rounded bg-primary-100 px-1.5 text-xs text-primary-800">Main</span>}
                    {!branch.active && <span className="rounded bg-neutral-100 px-1.5 text-xs text-neutral-600">Closed</span>}
                  </p>
                  <p className="text-sm text-neutral-600">
                    {[
                      branch.productsInStock != null ? `${branch.productsInStock} products in stock` : null,
                      branch.stockWorth != null ? formatNairaWhole(branch.stockWorth) : null,
                      branch.people != null ? `${branch.people} ${branch.people === 1 ? 'person' : 'people'}` : null,
                      branch.phone ?? null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {branch.address && <p className="text-sm text-neutral-500">{branch.address}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="quiet" onClick={() => setEditing(branch.id)} disabled={!online}>
                    Edit
                  </Button>
                  {branch.active && !branch.main && (
                    <Button variant="quiet" loading={busy === branch.id} disabled={!online}
                      onClick={() => void act(branch, () => branchesApi.makeMain(branch.id))}>
                      Make main branch
                    </Button>
                  )}
                  {branch.active && !branch.main && (
                    <Button variant="quiet" loading={busy === branch.id} disabled={!online}
                      onClick={() => void act(branch, () => branchesApi.close(branch.id))}>
                      Close
                    </Button>
                  )}
                  {!branch.active && (
                    <Button variant="quiet" loading={busy === branch.id} disabled={!online}
                      onClick={() => void act(branch, () => branchesApi.reopen(branch.id))}>
                      Reopen
                    </Button>
                  )}
                </div>
              </div>
            )}
            {problem?.branchId === branch.id && (
              <p role="alert" className="text-sm text-danger-700">
                {problem.message}
                {/* A branch that still holds stock can't close (UX §5.11): send it all elsewhere first. */}
                {(branch.productsInStock ?? 0) > 0 && (
                  <>
                    {' '}
                    <Link to={`/app/transfers/send?all=${branch.id}`} className="font-medium text-primary-700 hover:underline">
                      Send all stock
                    </Link>
                    {/* …or count it to zero there: quick mode, at that branch. */}
                    {recordable.some((entry) => entry.id === branch.id) && (
                      <>
                        {' · '}
                        <button
                          type="button"
                          onClick={() => {
                            choose(branch.id)
                            navigate('/app/quick')
                          }}
                          className="font-medium text-primary-700 hover:underline"
                        >
                          Count
                        </button>
                      </>
                    )}
                  </>
                )}
              </p>
            )}
          </li>
        ))}
      </ul>
      {!online && <p className="text-sm text-neutral-600">Changing branches needs a connection.</p>}
    </div>
  )
}

function BranchEditor({
  branch,
  busy,
  onCancel,
  onSave,
}: {
  branch: Branch
  busy: boolean
  onCancel: () => void
  onSave: (name: string, phone: string, address: string) => void
}) {
  const [name, setName] = useState(branch.name)
  const [phone, setPhone] = useState(branch.phone ?? '')
  const [address, setAddress] = useState(branch.address ?? '')
  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={(event) => {
        event.preventDefault()
        onSave(name.trim(), phone.trim(), address.trim())
      }}
    >
      <TextField id={`branch-${branch.id}-name`} label="Name" value={name} onChange={(event) => setName(event.target.value)} />
      <TextField id={`branch-${branch.id}-phone`} label="Phone (optional)" value={phone} onChange={(event) => setPhone(event.target.value)} />
      <TextField id={`branch-${branch.id}-address`} label="Address (optional)" value={address} onChange={(event) => setAddress(event.target.value)} />
      <div className="flex gap-2">
        <Button type="submit" loading={busy} disabled={!name.trim()}>
          Save
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
