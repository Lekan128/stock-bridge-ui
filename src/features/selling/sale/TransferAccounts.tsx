import { useState } from 'react'
import { Button } from '@/components/Button'
import { formatMoney } from '@/features/selling/money'
import type { PaymentAccount } from '@/features/branches/types'

const lastKey = (branchId: string) => `sale:transfer-account:${branchId}`

/** The account this phone used last at this branch, if it's still on. */
export function lastAccount(branchId: string, accounts: PaymentAccount[]): PaymentAccount | undefined {
  try {
    const id = localStorage.getItem(lastKey(branchId))
    return accounts.find((account) => account.id === id)
  } catch {
    return undefined
  }
}

export function rememberAccount(branchId: string, accountId: string) {
  try {
    localStorage.setItem(lastKey(branchId), accountId)
  } catch {
    // Private mode: it asks again next time.
  }
}

/**
 * "Paid with transfer to" (selling till Step 12; owner, 2026-11-18): after Transfer, at a branch with two or more
 * accounts - the one this phone used last already chosen, and one button naming it, so the account is read before
 * the tap. Shown in place of the payment buttons; Back returns to them.
 */
export function TransferAccountChooser({
  branchId,
  accounts,
  amount,
  busy,
  onPick,
  onBack,
}: {
  branchId: string
  accounts: PaymentAccount[]
  amount: number
  busy: boolean
  onPick: (account: PaymentAccount) => void
  onBack: () => void
}) {
  const [chosen, setChosen] = useState<string>(() => (lastAccount(branchId, accounts) ?? accounts[0]).id)
  const account = accounts.find((candidate) => candidate.id === chosen) ?? accounts[0]
  return (
    <fieldset className="flex flex-col gap-1.5" data-transfer-accounts>
      <legend className="mb-1 text-xs font-medium text-neutral-500">Paid with transfer to</legend>
      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        {accounts.map((candidate) => (
          <label
            key={candidate.id}
            className={`flex min-h-11 cursor-pointer items-center gap-3 border-b border-neutral-100 px-3 py-2 text-sm last:border-b-0 ${
              candidate.id === chosen ? 'bg-primary-50' : ''
            }`}
          >
            <input type="radio" name="transfer-account" checked={candidate.id === chosen} onChange={() => setChosen(candidate.id)} />
            <span className="font-semibold text-neutral-900">{candidate.bankName}</span>
            <span className="tabular-nums text-neutral-500">{candidate.accountNumber}</span>
          </label>
        ))}
      </div>
      <Button
        variant="action"
        loading={busy}
        onClick={() => {
          rememberAccount(branchId, account.id)
          onPick(account)
        }}
        className="min-h-11"
      >
        Record {formatMoney(amount)} to {account.bankName}
      </Button>
      <button type="button" onClick={onBack} className="self-center text-sm font-medium text-neutral-600 hover:underline">
        Back
      </button>
    </fieldset>
  )
}
