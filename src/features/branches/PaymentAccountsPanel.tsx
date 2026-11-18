import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { useApiQuery } from '@/data/useApiQuery'
import { isAppError } from '@/types/api'
import { api } from '@/api/client'
import { BRANCHES_KEY } from '@/features/branches/BranchProvider'
import type { Branch, PaymentAccount } from '@/features/branches/types'

const accountsKey = (branchId: string) => ['payment-accounts', branchId]

/**
 * A branch's transfer accounts (selling till Step 12; owner, 2026-11-18): what its customers pay into. With two or more
 * switched on, Transfer at the till asks which one the money came into. An old account is switched off, never
 * deleted - its sales keep it. Account numbers never go on a receipt.
 */
export function PaymentAccountsPanel({ branch }: { branch: Branch }) {
  const queryClient = useQueryClient()
  const accounts = useApiQuery<PaymentAccount[]>({
    queryKey: accountsKey(branch.id),
    queryFn: () => api.get<PaymentAccount[]>(`/api/branches/${branch.id}/payment-accounts`).then((r) => r.data),
    fallbackError: "Couldn't load the accounts.",
    requireFresh: true,
  })
  const [bank, setBank] = useState('')
  const [number, setNumber] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  async function run(key: string, action: () => Promise<unknown>) {
    setBusy(key)
    setProblem(null)
    try {
      await action()
      await queryClient.invalidateQueries({ queryKey: accountsKey(branch.id) })
      // The till reads the switched-on ones off the branch list.
      await queryClient.invalidateQueries({ queryKey: BRANCHES_KEY })
      return true
    } catch (error) {
      setProblem(isAppError(error) ? error.message : 'Something went wrong. Please try again.')
      return false
    } finally {
      setBusy(null)
    }
  }

  const list = accounts.data ?? []
  const on = list.filter((account) => account.active).length

  return (
    <div className="flex flex-col gap-5">
        <p className="text-sm text-neutral-600">
          Where customers at {branch.name} pay by transfer.{' '}
          {on > 1 ? 'Transfer at the till asks which one the money came into.' : on === 1 ? 'Transfers are recorded to it.' : ''}
        </p>
        {accounts.error && <p role="alert" className="text-sm text-danger-700">{accounts.error}</p>}
        {list.length > 0 && (
          <ul className="divide-y divide-neutral-100 overflow-hidden rounded-lg border border-neutral-200 bg-white" aria-label="Accounts">
            {list.map((account) => (
              <li key={account.id} className={`flex items-center justify-between gap-3 px-4 py-3 ${account.active ? '' : 'bg-neutral-50'}`}>
                <div className="min-w-0">
                  <p className={`font-medium ${account.active ? 'text-neutral-900' : 'text-neutral-500'}`}>{account.bankName}</p>
                  <p className="text-sm tabular-nums text-neutral-500">
                    {account.accountNumber}
                    {account.accountName ? ` · ${account.accountName}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={account.active}
                  aria-label={`${account.bankName} ${account.accountNumber} ${account.active ? 'on' : 'off'}`}
                  disabled={busy != null}
                  onClick={() => void run(account.id, () => api.patch(`/api/payment-accounts/${account.id}`, { active: !account.active }))}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                    account.active ? 'bg-primary-600' : 'bg-neutral-300'
                  }`}
                >
                  <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${account.active ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="flex flex-col gap-3 rounded-lg border border-dashed border-neutral-300 p-4"
          onSubmit={(event) => {
            event.preventDefault()
            void run('add', () =>
              api.post(`/api/branches/${branch.id}/payment-accounts`, {
                bankName: bank.trim(),
                accountNumber: number.trim(),
                accountName: name.trim() || undefined,
              }),
            ).then((ok) => {
              if (ok) {
                setBank('')
                setNumber('')
                setName('')
              }
            })
          }}
        >
          <p className="text-sm font-semibold text-neutral-900">Add an account</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField id="account-bank" label="Bank" placeholder="GTBank, Moniepoint, OPay…" value={bank} onChange={(event) => setBank(event.target.value)} />
            <TextField
              id="account-number"
              label="Account number"
              inputMode="numeric"
              value={number}
              onChange={(event) => setNumber(event.target.value.replace(/[^0-9]/g, '').slice(0, 20))}
            />
          </div>
          <TextField id="account-name" label="Account name (optional)" value={name} onChange={(event) => setName(event.target.value)} />
          <Button type="submit" variant="action" loading={busy === 'add'} disabled={!bank.trim() || !number.trim()} className="self-start">
            Add account
          </Button>
        </form>
        {problem && (
          <p role="alert" className="text-sm text-danger-700">
            {problem}
          </p>
        )}
    </div>
  )
}
