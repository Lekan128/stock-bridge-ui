import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { isAppError } from '@/types/api'
import { areasApi } from '@/features/branches/branchesApi'
import { BRANCHES_KEY } from '@/features/branches/BranchProvider'
import { deliveryArea, hasAreas } from '@/features/branches/areas'
import type { Branch } from '@/features/branches/types'

type Step = 'current' | 'add' | 'kind' | 'delivery' | 'done'

/** The quick picks (STOCK_AREAS_PLAN.md §4.1 step 2): the places our restaurants, hotels and shops name. */
const SUGGESTIONS = ['Kitchen', 'Bar', 'Front desk', 'Shop floor', 'Housekeeping']

interface Wanted {
  name: string
  keepsStock: boolean
}

/**
 * Adding areas to a branch (STOCK_AREAS_PLAN.md §4.1, STOCK_AREAS_PART_1.md), one question a step. The
 * first time, it also names the place the stock is kept now - everything the branch holds stays there.
 * Then the other areas (quick picks, or typed), whether each keeps stock or uses what it's given, and,
 * once two or more keep stock, where deliveries arrive. Online only, like every branch change.
 */
export function AddAreasFlow({ branch, onDone }: { branch: Branch; onDone: () => void }) {
  const queryClient = useQueryClient()
  const first = !hasAreas(branch)
  const current = branch.areas?.find((area) => area.delivery) ?? branch.areas?.[0]
  const [step, setStep] = useState<Step>(first ? 'current' : 'add')
  const [currentName, setCurrentName] = useState(current?.name ?? 'Store')
  const [wanted, setWanted] = useState<Wanted[]>([])
  const [typed, setTyped] = useState('')
  // Null: deliveries stay where they arrive now.
  const [delivery, setDelivery] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const existingNames = (branch.areas ?? []).map((area) => area.name)
  const storeName = currentName.trim() || current?.name || 'Store'
  const taken = (name: string) =>
    [...existingNames.filter((existing) => existing !== current?.name), storeName, ...wanted.map((area) => area.name)].some(
      (other) => other.toLowerCase() === name.trim().toLowerCase(),
    )
  // Every area that will keep stock once this is done: where deliveries could arrive.
  const stocking = [
    ...(branch.areas ?? []).filter((area) => area.active && area.keepsStock).map((area) => (area.id === current?.id ? storeName : area.name)),
    ...wanted.filter((area) => area.keepsStock).map((area) => area.name),
  ]
  const totalAreas = (branch.areas?.length ?? 1) + wanted.length
  const deliveryNow = deliveryArea(branch)
  // Where deliveries arrive now, by the name it will have (the Store may have just been renamed).
  const deliveryNowName = deliveryNow && deliveryNow.id === current?.id ? storeName : deliveryNow?.name
  const deliveryChoice = delivery ?? deliveryNowName

  function addWanted(name: string) {
    const clean = name.trim().replace(/\s+/g, ' ')
    if (!clean || taken(clean)) return
    setWanted((all) => [...all, { name: clean, keepsStock: true }])
    setTyped('')
  }

  async function finish() {
    setBusy(true)
    setProblem(null)
    try {
      if (first && current && storeName !== current.name) {
        await areasApi.update(current.id, { name: storeName })
      }
      const added = await areasApi.add(branch.id, wanted)
      if (delivery != null && delivery !== deliveryNowName) {
        const target = added.find((area) => area.name === delivery) ?? branch.areas?.find((area) => area.name === delivery)
        if (target) await areasApi.update(target.id, { delivery: true })
      }
      await queryClient.invalidateQueries({ queryKey: BRANCHES_KEY })
      setStep('done')
    } catch (error) {
      setProblem(isAppError(error) ? error.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const afterKinds = () => (stocking.length >= 2 ? setStep('delivery') : void finish())

  return (
    <div className="mx-auto max-w-lg rounded-xl border border-neutral-200 bg-white p-6">
      {step === 'current' && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (storeName) setStep('add')
          }}
          className="flex flex-col gap-4"
        >
          <p className="text-sm text-neutral-600">Areas at {branch.name}</p>
          <h1 className="text-lg font-semibold text-neutral-900">What do you call the place your stock is kept now?</h1>
          <TextField
            id="current-area-name"
            label="Area name"
            value={currentName}
            autoFocus
            onFocus={(event) => event.target.select()}
            onChange={(event) => setCurrentName(event.target.value)}
            hint="All your current stock stays here."
          />
          <Actions onCancel={onDone} next="Next" disabled={!currentName.trim()} />
        </form>
      )}

      {step === 'add' && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (typed.trim()) addWanted(typed)
            else if (wanted.length > 0) setStep('kind')
          }}
          className="flex flex-col gap-4"
        >
          <p className="text-sm text-neutral-600">Areas at {branch.name}</p>
          <h1 className="text-lg font-semibold text-neutral-900">
            {first ? 'Add the other areas.' : `Add an area to ${branch.name}.`}
          </h1>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Quick picks">
            {SUGGESTIONS.filter((name) => !taken(name)).map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => addWanted(name)}
                className="min-h-11 rounded-full border border-neutral-300 bg-white px-4 text-sm text-neutral-800 hover:bg-neutral-50"
              >
                + {name}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <TextField
                id="new-area-name"
                label="Or type a name"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                error={typed.trim() && taken(typed) ? `There's already an area called ${typed.trim()}.` : undefined}
              />
            </div>
            <Button type="button" variant="secondary" onClick={() => addWanted(typed)} disabled={!typed.trim() || taken(typed)}>
              Add
            </Button>
          </div>
          {wanted.length > 0 && (
            <ul className="flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200" aria-label="Areas to add">
              {first && <li className="px-3 py-2 text-sm text-neutral-600">{storeName} (where your stock is now)</li>}
              {wanted.map((area) => (
                <li key={area.name} className="flex items-center justify-between gap-3 py-1 pr-1 pl-3 text-sm">
                  <span className="font-medium text-neutral-900">{area.name}</span>
                  <button
                    type="button"
                    onClick={() => setWanted((all) => all.filter((other) => other.name !== area.name))}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100"
                    aria-label={`Remove ${area.name}`}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={first ? () => setStep('current') : onDone}>
              {first ? 'Back' : 'Cancel'}
            </Button>
            <Button type="button" variant="action" onClick={() => setStep('kind')} disabled={wanted.length === 0}>
              Next
            </Button>
          </div>
        </form>
      )}

      {step === 'kind' && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            afterKinds()
          }}
          className="flex flex-col gap-4"
        >
          <p className="text-sm text-neutral-600">Areas at {branch.name}</p>
          <h1 className="text-lg font-semibold text-neutral-900">
            {wanted.length === 1 ? `Does the ${wanted[0].name} keep stock you want to count?` : 'Does each area keep stock you want to count?'}
          </h1>
          <ul className="flex flex-col gap-3">
            {wanted.map((area, index) => (
              <li key={area.name}>
                <fieldset>
                  <legend className="mb-1.5 text-sm font-medium text-neutral-800">{area.name}</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { keepsStock: true, label: 'Yes, it keeps stock', help: 'It has its own figure, and you can count it.' },
                      { keepsStock: false, label: "No, what goes there is used", help: "Giving it stock records it as used there." },
                    ].map((option) => (
                      <label
                        key={String(option.keepsStock)}
                        className={`flex cursor-pointer flex-col gap-0.5 rounded-lg border px-3 py-2 text-sm ${
                          area.keepsStock === option.keepsStock ? 'border-primary-600 bg-primary-50' : 'border-neutral-300 bg-white'
                        }`}
                      >
                        <span className="flex items-center gap-2 font-medium text-neutral-900">
                          <input
                            type="radio"
                            name={`area-kind-${index}`}
                            checked={area.keepsStock === option.keepsStock}
                            onChange={() =>
                              setWanted((all) => all.map((other, at) => (at === index ? { ...other, keepsStock: option.keepsStock } : other)))
                            }
                          />
                          {option.label}
                        </span>
                        <span className="text-neutral-600">{option.help}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </li>
            ))}
          </ul>
          <p className="text-sm text-neutral-600">Not sure? Choose "keeps stock". You can change it later.</p>
          {problem && stocking.length < 2 && (
            <p role="alert" className="text-sm text-danger-700">
              {problem}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setStep('add')}>
              Back
            </Button>
            <Button type="submit" variant="action" loading={busy}>
              {stocking.length >= 2 ? 'Next' : `Add ${wanted.length === 1 ? wanted[0].name : `${wanted.length} areas`}`}
            </Button>
          </div>
        </form>
      )}

      {step === 'delivery' && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void finish()
          }}
          className="flex flex-col gap-4"
        >
          <p className="text-sm text-neutral-600">Areas at {branch.name}</p>
          <h1 className="text-lg font-semibold text-neutral-900">Where do deliveries arrive?</h1>
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">Where deliveries arrive</legend>
            {stocking.map((name) => (
              <label
                key={name}
                className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${
                  deliveryChoice === name ? 'border-primary-600 bg-primary-50 font-medium' : 'border-neutral-300 bg-white'
                }`}
              >
                <input type="radio" name="delivery-area" checked={deliveryChoice === name} onChange={() => setDelivery(name)} />
                {name}
              </label>
            ))}
          </fieldset>
          <p className="text-sm text-neutral-600">Stock you receive goes here unless you choose another area on the sheet.</p>
          {problem && (
            <p role="alert" className="text-sm text-danger-700">
              {problem}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setStep('kind')}>
              Back
            </Button>
            <Button type="submit" variant="action" loading={busy}>
              Add {wanted.length === 1 ? wanted[0].name : `${wanted.length} areas`}
            </Button>
          </div>
        </form>
      )}

      {step === 'done' && (
        <div className="flex flex-col gap-4">
          <h1 className="text-lg font-semibold text-neutral-900">
            {branch.name} now has {totalAreas} areas.
          </h1>
          <p className="text-sm text-neutral-700">
            {first ? `Everything you have is in the ${storeName}. ` : ''}
            {stocking.length >= 2
              ? "When you record stock in, stock out or a count, the sheet now asks which area it's for."
              : `${storeName} is still the only area that keeps stock, so your sheets don't change.`}
          </p>
          <div className="flex justify-end">
            <Button variant="action" onClick={onDone}>
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function Actions({ onCancel, next, disabled }: { onCancel: () => void; next: string; disabled: boolean }) {
  return (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="secondary" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" variant="action" disabled={disabled}>
        {next}
      </Button>
    </div>
  )
}
