import { useState } from 'react'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { TextField } from '@/components/TextField'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'

export interface ConfirmPackPopupProps {
  /** What the sheet actually said, quoted back so the user can check the parse against it. */
  rawText: string
  /** The parser's guess, pre-filling the form — {@link parseCandidatePackSuggestion} in `CellFix`. */
  packagingUnit: string
  packagingSize: number
  busy?: boolean
  onCancel: () => void
  onConfirm: (packagingUnit: string, packagingSize: number) => void
}

/**
 * The "Edit" half of `CellFix`'s candidate-pack affordance (MULTI_PACK_PER_VENDOR_DESIGN.md
 * section 6a) — a real popup, not the plain unit-code repair editor. The prototype this shipped
 * from ("Vendor Packs") drew this as "Confirm new pack": a packaging select and a size field, pre-
 * filled from the parse, editable before the same one-click "Confirm" the un-edited path already
 * offers. Bulk rows have no per-row "one-off" override (unlike the interactive stock-in modal),
 * so unlike the prototype this carries no "remember this" checkbox — confirming here always
 * persists the pack, which `CellFix`'s doc comment on `onConfirmPack` already documents as the
 * deliberate, honest scope limit for the bulk path.
 */
export function ConfirmPackPopup({
  rawText,
  packagingUnit,
  packagingSize,
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmPackPopupProps) {
  const { packagingOptions } = useUnitOfMeasureOptions()
  const [unit, setUnit] = useState(packagingUnit)
  const [sizeText, setSizeText] = useState(String(packagingSize))

  const sizeNumber = Number(sizeText)
  const canSubmit = unit !== '' && Number.isFinite(sizeNumber) && sizeNumber > 0

  return (
    <Modal
      open
      onClose={onCancel}
      title="Confirm new pack"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(unit, sizeNumber)} disabled={!canSubmit} loading={busy}>
            Confirm pack
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-neutral-500">
          From the sheet: &ldquo;{rawText}&rdquo;. Adjust anything before confirming.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="confirm-pack-unit" className="mb-1.5 block text-sm font-medium text-neutral-700">
              Packaging
            </label>
            <select
              id="confirm-pack-unit"
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
            >
              {packagingOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <TextField
            label="Units per pack"
            inputMode="decimal"
            value={sizeText}
            onChange={(event) => setSizeText(event.target.value)}
          />
        </div>
      </div>
    </Modal>
  )
}
