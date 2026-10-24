import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { isAppError } from '@/types/api'
import { branchesApi } from '@/features/branches/branchesApi'
import { BRANCHES_KEY } from '@/features/branches/BranchProvider'
import { useWorkingBranch } from '@/features/branches/useWorkingBranch'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { useUsers } from '@/features/users/hooks/useUsers'
import { usersApi } from '@/features/users/api/usersApi'
import type { Branch } from '@/features/branches/types'

type Step = 'existing' | 'name' | 'stock' | 'people' | 'done'

/**
 * Adding a branch (MULTI_BRANCH_UX_PLAN.md §5.1), one question a step. The second branch also renames the
 * one the company already has - "Head Office" is wrong for most, and it will be on every waybill - and
 * switches the company to counting per branch (the server copies every figure to the main branch in the
 * same step). Stock gets to the new branch by sending it from the one that has it, counting it, or a
 * stock sheet.
 */
export function AddBranchFlow({ onDone }: { onDone: () => void }) {
  const { branches, isMultiBranch, working } = useWorkingBranch()
  const { user } = useAuth()
  const canSend = user?.type === 'tenant' && user.permissions.includes(PERMISSIONS.SEND_STOCK)
  const queryClient = useQueryClient()
  const current = branches.find((branch) => branch.main) ?? branches[0]
  const [step, setStep] = useState<Step>(isMultiBranch ? 'name' : 'existing')
  const [existingName, setExistingName] = useState(current?.name ?? '')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [moreDetails, setMoreDetails] = useState(false)
  const [created, setCreated] = useState<Branch | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setProblem(null)
    try {
      await action()
    } catch (error) {
      setProblem(isAppError(error) ? error.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const refresh = () => queryClient.invalidateQueries({ queryKey: BRANCHES_KEY })

  return (
    <div className="mx-auto max-w-lg rounded-xl border border-neutral-200 bg-white p-6">
      {step === 'existing' && current && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void run(async () => {
              if (existingName.trim() && existingName.trim() !== current.name) {
                await branchesApi.update(current.id, { name: existingName.trim() })
              }
              setStep('name')
            })
          }}
          className="flex flex-col gap-4"
        >
          <h1 className="text-lg font-semibold text-neutral-900">First, what do you call the place you already have?</h1>
          <TextField
            id="existing-branch-name"
            label="Branch name"
            value={existingName}
            autoFocus
            onFocus={(event) => event.target.select()}
            onChange={(event) => setExistingName(event.target.value)}
            hint="All your current stock, history and staff stay here."
          />
          <Actions busy={busy} onCancel={onDone} next="Next" disabled={!existingName.trim()} />
        </form>
      )}

      {step === 'name' && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void run(async () => {
              const branch = await branchesApi.add({
                name: name.trim(),
                phone: phone.trim() || undefined,
                address: address.trim() || undefined,
              })
              setCreated(branch)
              await refresh()
              setStep('stock')
            })
          }}
          className="flex flex-col gap-4"
        >
          <h1 className="text-lg font-semibold text-neutral-900">What's the new branch called?</h1>
          <TextField id="new-branch-name" label="Branch name" value={name} autoFocus onChange={(event) => setName(event.target.value)} />
          {/* Folded away: the name is the one question here (§5.1 step 2). */}
          {moreDetails ? (
            <>
              <TextField id="new-branch-address" label="Address (optional)" value={address} onChange={(event) => setAddress(event.target.value)} />
              <TextField id="new-branch-phone" label="Phone (optional)" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </>
          ) : (
            <button
              type="button"
              onClick={() => setMoreDetails(true)}
              className="inline-flex min-h-11 items-center self-start text-sm font-medium text-primary-700 hover:underline"
            >
              Add address and phone
            </button>
          )}
          <Actions busy={busy} onCancel={onDone} next="Add branch" disabled={!name.trim()} />
        </form>
      )}

      {step === 'stock' && created && (
        <div className="flex flex-col gap-4">
          <h1 className="text-lg font-semibold text-neutral-900">How will stock get to {created.name}?</h1>
          <p className="text-sm text-neutral-600">{created.name} starts empty.</p>
          <div className="flex flex-col gap-2">
            {canSend && (
              <Link
                to={`/app/transfers/send?to=${created.id}${(working ?? current) ? `&from=${(working ?? current)!.id}` : ''}`}
                className="rounded-lg border border-neutral-200 px-4 py-3 text-sm hover:bg-neutral-50"
              >
                <span className="font-medium text-neutral-900">Send stock from {(working ?? current)?.name ?? 'another branch'}</span>
                <span className="block text-neutral-600">A waybill to {created.name}: they receive it when it arrives.</span>
              </Link>
            )}
            <Link to="/app/products" className="rounded-lg border border-neutral-200 px-4 py-3 text-sm hover:bg-neutral-50">
              <span className="font-medium text-neutral-900">Count what's already there</span>
              <span className="block text-neutral-600">Open Inventory at {created.name} and count each product.</span>
            </Link>
            <Link to="/app/products/import/new" className="rounded-lg border border-neutral-200 px-4 py-3 text-sm hover:bg-neutral-50">
              <span className="font-medium text-neutral-900">Upload a stock sheet</span>
              <span className="block text-neutral-600">The usual stock sheet, recorded at the branch you choose.</span>
            </Link>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setStep('people')}>Later</Button>
          </div>
        </div>
      )}

      {step === 'people' && created && <PeopleStep branch={created} onDone={() => setStep('done')} />}

      {step === 'done' && created && (
        <div className="flex flex-col gap-4">
          <h1 className="text-lg font-semibold text-neutral-900">{created.name} is ready.</h1>
          <p className="text-sm text-neutral-600">Everyone on this account now sees a branch name at the top of the screen.</p>
          <div className="flex justify-end">
            <Button variant="action" onClick={onDone}>
              Done
            </Button>
          </div>
        </div>
      )}

      {problem && (
        <p role="alert" className="mt-4 text-sm text-danger-700">
          {problem}
        </p>
      )}
    </div>
  )
}

/** "Who works there?" (§5.1 step 4): the company's people, ticked to add this branch to theirs. */
function PeopleStep({ branch, onDone }: { branch: Branch; onDone: () => void }) {
  const { data } = useUsers({ page: 0, size: 100 })
  const [ticked, setTicked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const people = data?.content.filter((person) => person.active) ?? []

  async function save() {
    setBusy(true)
    setProblem(null)
    try {
      for (const person of people.filter((candidate) => ticked.includes(candidate.id))) {
        await usersApi.update(person.id, { branchIds: [...new Set([...(person.branchIds ?? []), branch.id])] })
      }
      onDone()
    } catch (error) {
      setProblem(isAppError(error) ? error.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-neutral-900">Who works at {branch.name}?</h1>
      <ul className="flex flex-col gap-2">
        {people.map((person) => (
          <li key={person.id}>
            {person.worksEverywhere ? (
              <p className="text-sm text-neutral-600">
                {displayName(person)} - works at every branch, from their role
              </p>
            ) : (
              <label className="flex items-center gap-2 text-sm text-neutral-800">
                <input
                  type="checkbox"
                  checked={ticked.includes(person.id)}
                  onChange={() =>
                    setTicked((list) => (list.includes(person.id) ? list.filter((id) => id !== person.id) : [...list, person.id]))
                  }
                />
                {displayName(person)}
              </label>
            )}
          </li>
        ))}
      </ul>
      <p className="text-sm text-neutral-600">
        Adding someone new? <Link to="/app/users" className="font-medium text-primary-700 hover:underline">Invite them from Users</Link>{' '}
        and choose {branch.name} there.
      </p>
      {problem && <p role="alert" className="text-sm text-danger-700">{problem}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          Skip
        </Button>
        <Button variant="action" loading={busy} onClick={() => void save()}>
          Save
        </Button>
      </div>
    </div>
  )
}

function displayName(person: { firstName?: string | null; lastName?: string | null; username: string }) {
  const name = [person.firstName, person.lastName].filter(Boolean).join(' ').trim()
  return name || person.username
}

function Actions({ busy, onCancel, next, disabled }: { busy: boolean; onCancel: () => void; next: string; disabled: boolean }) {
  return (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="secondary" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" variant="action" loading={busy} disabled={disabled}>
        {next}
      </Button>
    </div>
  )
}
