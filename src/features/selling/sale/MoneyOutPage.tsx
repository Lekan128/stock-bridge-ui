import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Building2, Fuel, MoreHorizontal, User } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/Button'
import { useToast } from '@/components/useToast'
import { isAppError } from '@/types/api'
import { formatMoney } from '@/features/selling/money'
import { cashDayApi, moneyTyped, type OutKind } from '@/features/selling/sale/cashDay'

const KINDS: { value: OutKind; label: string; icon: typeof Fuel }[] = [
  { value: 'COST', label: 'A cost', icon: Fuel },
  { value: 'BANK', label: 'To the bank', icon: Building2 },
  { value: 'OWNER', label: 'To the owner', icon: User },
  { value: 'OTHER', label: 'Other', icon: MoreHorizontal },
]

/** Take money out of the drawer (Step 13): how much and what for - a cost, the bank, the owner, or other. */
export function MoneyOutPage() {
  const [params] = useSearchParams()
  const dayId = params.get('day')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [amount, setAmount] = useState('')
  const [kind, setKind] = useState<OutKind | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const value = moneyTyped(amount)
  const needsNote = kind === 'COST' || kind === 'OTHER'
  const ready = dayId != null && value != null && value > 0 && kind != null && (!needsNote || note.trim() !== '')

  async function save() {
    if (!ready || !dayId || value == null || !kind) return
    setBusy(true)
    setProblem(null)
    try {
      await cashDayApi.moneyOut(dayId, value, kind, note)
      await queryClient.invalidateQueries({ queryKey: ['cash-till'] })
      showToast(`${formatMoney(value)} taken out.`, 'success')
      navigate(-1)
    } catch (error) {
      setProblem(isAppError(error) ? error.message : "Couldn't save that. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="mx-auto flex w-full max-w-md flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => navigate(-1)} aria-label="Back" className="rounded-md p-1.5 text-neutral-600 hover:bg-neutral-100">
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <h1 className="text-xl font-semibold text-neutral-900 lg:text-2xl">Take money out</h1>
      </div>
      <div>
        <label htmlFor="money-out-amount" className="mb-1.5 block text-sm font-medium text-neutral-700">
          How much
        </label>
        <input
          id="money-out-amount"
          inputMode="numeric"
          autoFocus
          placeholder="₦0"
          value={amount}
          onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, ''))}
          className="h-12 w-full rounded-md border-2 border-neutral-300 px-3 text-xl font-semibold tabular-nums focus:border-primary-600 focus:outline-none"
        />
      </div>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-neutral-700">What for</legend>
        <div className="grid grid-cols-2 gap-2">
          {KINDS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={kind === option.value}
              onClick={() => setKind(option.value)}
              className={`flex min-h-12 items-center justify-center gap-2 rounded-lg border text-sm font-semibold ${
                kind === option.value ? 'border-primary-600 bg-primary-50 text-primary-800' : 'border-neutral-200 bg-white text-neutral-800'
              }`}
            >
              <option.icon className="h-4 w-4" aria-hidden="true" />
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>
      {needsNote && (
        <div>
          <label htmlFor="money-out-note" className="mb-1.5 block text-sm font-medium text-neutral-700">
            {kind === 'COST' ? 'What was it?' : 'What for?'}
          </label>
          <input
            id="money-out-note"
            value={note}
            maxLength={300}
            placeholder={kind === 'COST' ? 'Diesel for the generator' : ''}
            onChange={(event) => setNote(event.target.value)}
            className="h-11 w-full rounded-md border border-neutral-300 px-3 text-sm focus:border-primary-600 focus:outline-none"
          />
        </div>
      )}
      {problem && (
        <p role="alert" className="text-sm text-danger-700">
          {problem}
        </p>
      )}
      <Button type="submit" variant="action" loading={busy} disabled={!ready} className="min-h-12">
        {value ? `Take out ${formatMoney(value)}` : 'Take out'}
      </Button>
    </form>
  )
}
