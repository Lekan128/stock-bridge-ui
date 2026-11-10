import { useState } from 'react'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import type { CompanyVendor } from '@/features/vendors/types'
import { vendorsApi } from '@/features/vendors/api/vendorsApi'
import { isAppError } from '@/types/api'

/**
 * A new supplier, added where the delivery is being recorded (STOCK_SHEETS_AND_AREA_COUNT_PLAN.md Part 3): the card
 * grows in place, no popup. Only the two things a supplier must have - a name and a phone - and the rest is for
 * Suppliers later. Online only: shared records like suppliers aren't saved on the phone.
 */
export function AddSupplierInPlace({
  onAdded,
  onCancel,
}: {
  onAdded: (vendor: CompanyVendor) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [problem, setProblem] = useState<{ name?: string; phone?: string; form?: string }>({})
  const [saving, setSaving] = useState(false)

  async function add() {
    const missing = {
      name: name.trim() ? undefined : 'Type the supplier’s name.',
      phone: phone.trim() ? undefined : 'Type a phone number for them.',
    }
    if (missing.name || missing.phone) return setProblem(missing)
    setSaving(true)
    setProblem({})
    try {
      onAdded(await vendorsApi.create({ name: name.trim(), contactPhone: phone.trim() }))
    } catch (err) {
      setProblem({ form: isAppError(err) ? err.message : 'Couldn’t add the supplier. Try again.' })
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-primary-200 bg-primary-50/40 p-3" role="group" aria-label="Add a supplier" data-add-supplier>
      <TextField
        id="new-supplier-name"
        label="Name"
        autoFocus
        value={name}
        error={problem.name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Alaba Rice Depot"
      />
      <TextField
        id="new-supplier-phone"
        label="Phone"
        type="tel"
        inputMode="tel"
        value={phone}
        error={problem.phone}
        onChange={(event) => setPhone(event.target.value)}
        placeholder="0803 123 4567"
      />
      <p className="text-xs text-neutral-600">Address and bank details can be added later on Suppliers.</p>
      {problem.form && (
        <p role="alert" className="text-sm text-danger-700">
          {problem.form}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={() => void add()} loading={saving}>
          Add supplier
        </Button>
      </div>
    </div>
  )
}
