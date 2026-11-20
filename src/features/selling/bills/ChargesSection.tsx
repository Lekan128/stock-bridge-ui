import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Button } from '@/components/Button'
import { Sheet } from '@/components/Sheet'
import { useToast } from '@/components/useToast'
import { useApiQuery } from '@/data/useApiQuery'
import { isAppError } from '@/types/api'
import { BRANCHES_KEY } from '@/features/branches/BranchProvider'
import type { Branch } from '@/features/branches/types'
import { formatMoney } from '@/features/selling/money'
import { MoneyInput } from '@/features/selling/MoneyInput'
import { chargeAmounts, type Charge } from '@/features/selling/charges'

const chargesApi = {
  list: (branchId: string) => api.get<Charge[]>(`/api/branches/${branchId}/charges`).then((r) => r.data),
  add: (branchId: string, body: Partial<Charge>) => api.post<Charge[]>(`/api/branches/${branchId}/charges`, body).then((r) => r.data),
  update: (id: string, body: Partial<Charge>) => api.patch<Charge[]>(`/api/charges/${id}`, body).then((r) => r.data),
}

/** "7.5% · Added on top · every sale" - a charge in one line. */
function describe(charge: Charge): string {
  const much = charge.kind === 'PERCENT' ? `${Number(charge.value)}%` : formatMoney(Number(charge.value))
  return `${much} · ${charge.included ? 'In my prices' : 'Added on top'} · ${charge.applies === 'EVERY_SALE' ? 'every sale' : 'table bills only'}`
}

/**
 * Branch → Selling → Charges and taxes (V100, selling till Step 10; owner, 2026-11-19). One list, VAT there to start
 * with (off); anything else added. Every charge asks the same four things in the usual sheet, so "in my prices or on
 * top" is asked in one place, one way.
 */
export function ChargesSection({ branch }: { branch: Branch }) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const charges = useApiQuery<Charge[]>({
    queryKey: ['branch-charges', branch.id],
    queryFn: () => chargesApi.list(branch.id),
    fallbackError: "Couldn't load the charges.",
  })
  const [editing, setEditing] = useState<Charge | 'new' | null>(null)

  async function saved(next: Charge[], message?: string) {
    queryClient.setQueryData(['branch-charges', branch.id], next)
    void queryClient.invalidateQueries({ queryKey: BRANCHES_KEY })
    if (message) showToast(message, 'success')
  }

  async function toggle(charge: Charge) {
    try {
      await saved(await chargesApi.update(charge.id, { active: !charge.active }), `${charge.name} ${charge.active ? 'off' : 'on'}.`)
    } catch (error) {
      showToast(isAppError(error) ? error.message : "Couldn't change that. Try again.", 'error')
    }
  }

  return (
    <section className="flex flex-col gap-2" aria-labelledby="charges-heading">
      <h2 id="charges-heading" className="text-sm font-semibold text-neutral-800">
        Charges and taxes
      </h2>
      <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
        {(charges.data ?? []).map((charge) => (
          <li key={charge.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <button type="button" onClick={() => setEditing(charge)} className="min-w-0 text-left">
              <span className={`block font-semibold ${charge.active ? 'text-neutral-900' : 'text-neutral-500'}`}>{charge.name}</span>
              <span className="block text-sm text-neutral-500">{describe(charge)}</span>
            </button>
            <button
              type="button"
              role="switch"
              aria-checked={charge.active === true}
              aria-label={`${charge.name} on`}
              onClick={() => void toggle(charge)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${charge.active ? 'bg-accent-600' : 'bg-neutral-300'}`}
            >
              <span
                aria-hidden="true"
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${charge.active ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => setEditing('new')} className="self-start text-sm font-semibold text-primary-700 hover:underline">
        + Add a tax or charge
      </button>
      <p className="text-xs text-neutral-500">Tap one to change it. A charge is switched off, never deleted, so old receipts keep it.</p>
      {editing && (
        <ChargeSheet
          charge={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (body) => {
            const next = editing === 'new' ? await chargesApi.add(branch.id, body) : await chargesApi.update(editing.id, body)
            await saved(next, `${body.name} saved.`)
            setEditing(null)
          }}
        />
      )}
    </section>
  )
}

function ChargeSheet({ charge, onClose, onSave }: { charge: Charge | null; onClose: () => void; onSave: (body: Partial<Charge>) => Promise<void> }) {
  const [name, setName] = useState(charge?.name ?? '')
  const [kind, setKind] = useState<'PERCENT' | 'AMOUNT'>(charge?.kind ?? 'PERCENT')
  const [value, setValue] = useState(charge ? String(Number(charge.value)) : '')
  const [included, setIncluded] = useState(charge?.included ?? false)
  const [applies, setApplies] = useState<'EVERY_SALE' | 'TABLE_BILLS'>(charge?.applies ?? 'EVERY_SALE')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const amount = Number(value.replace(/,/g, ''))
  // An example the owner can check: what ₦10,000 of food and drinks comes to, either way.
  const sample = 10_000
  const [inPrice] = chargeAmounts(sample, [{ kind, value: amount || 0, included: true }])
  const [onTop] = chargeAmounts(sample, [{ kind, value: amount || 0, included: false }])

  return (
    <Sheet
      open
      onClose={onClose}
      title={charge ? charge.name : 'A tax or charge'}
      footer={
        <Button
          variant="action"
          loading={busy}
          disabled={!name.trim() || !(amount > 0)}
          onClick={async () => {
            setBusy(true)
            setProblem(null)
            try {
              await onSave({ name: name.trim(), kind, value: amount, included, applies, ...(charge ? {} : { active: true }) })
            } catch (error) {
              setProblem(isAppError(error) ? error.message : "Couldn't save it. Try again.")
            } finally {
              setBusy(false)
            }
          }}
        >
          Save
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="charge-name" className="text-sm font-medium text-neutral-800">
            Name on the receipt
          </label>
          <input
            id="charge-name"
            value={name}
            maxLength={40}
            placeholder="Service charge"
            onChange={(event) => setName(event.target.value)}
            className="h-11 rounded-md border border-neutral-300 px-3 text-base"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="charge-value" className="text-sm font-medium text-neutral-800">
            How much
          </label>
          <div className="flex gap-2">
            <div role="radiogroup" aria-label="Percent or naira" className="inline-grid shrink-0 grid-cols-2 overflow-hidden rounded-md border border-neutral-300 text-sm font-semibold">
              {(
                [
                  ['PERCENT', '%'],
                  ['AMOUNT', '₦'],
                ] as const
              ).map(([option, text]) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={kind === option}
                  onClick={() => setKind(option)}
                  className={`h-11 w-11 ${kind === option ? 'bg-action text-white' : 'bg-white text-neutral-700'}`}
                >
                  {text}
                </button>
              ))}
            </div>
            <MoneyInput
              id="charge-value"
              value={value}
              onValue={setValue}
              placeholder={kind === 'PERCENT' ? '7.5' : '2,000'}
              className="h-11 min-w-0 flex-1 rounded-md border border-neutral-300 px-3 text-base tabular-nums"
            />
          </div>
          {kind === 'AMOUNT' && <p className="text-xs text-neutral-500">Once per sale or bill.</p>}
        </div>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-sm font-medium text-neutral-800">Your prices</legend>
          {(
            [
              [true, 'Already include it', amount > 0 ? `The total stays. ${formatMoney(sample)} of food holds ${formatMoney(inPrice)} of it.` : 'The total stays; the receipt says what was in it.'],
              [false, 'Add it on top', amount > 0 ? `${formatMoney(sample)} of food becomes ${formatMoney(sample + onTop)}.` : 'It’s added to what the customer pays.'],
            ] as const
          ).map(([option, title, help]) => (
            <button
              key={title}
              type="button"
              role="radio"
              aria-checked={included === option}
              onClick={() => setIncluded(option)}
              className={`rounded-md border px-3 py-2 text-left text-sm ${included === option ? 'border-2 border-primary-600 bg-primary-50' : 'border-neutral-200 bg-white'}`}
            >
              <span className="font-semibold text-neutral-900">{title}</span>
              <span className="block text-xs text-neutral-500 tabular-nums">{help}</span>
            </button>
          ))}
        </fieldset>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-sm font-medium text-neutral-800">When</legend>
          <div role="radiogroup" aria-label="When" className="inline-grid grid-cols-2 self-start overflow-hidden rounded-md border border-neutral-300 text-sm font-semibold">
            {(
              [
                ['EVERY_SALE', 'Every sale'],
                ['TABLE_BILLS', 'Table bills only'],
              ] as const
            ).map(([option, text]) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={applies === option}
                onClick={() => setApplies(option)}
                className={`h-10 px-3 ${applies === option ? 'bg-action text-white' : 'bg-white text-neutral-700'}`}
              >
                {text}
              </button>
            ))}
          </div>
        </fieldset>
        <p className="text-xs text-neutral-500">Each charge is worked out on the food and drinks, never on another charge.</p>
        {problem && (
          <p role="alert" className="text-sm text-danger-700">
            {problem}
          </p>
        )}
      </div>
    </Sheet>
  )
}
