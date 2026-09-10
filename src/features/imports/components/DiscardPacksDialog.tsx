import { useState } from 'react'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import type { ImportLinkedPack } from '@/features/imports/types'

export interface DiscardPacksDialogProps {
  open: boolean
  packs: ImportLinkedPack[]
  loading?: boolean
  onCancel: () => void
  /** ids the caller asked to remove alongside the discard — may be empty. */
  onConfirm: (removePackIds: string[]) => void
}

/**
 * The discard confirmation for a session that confirmed at least one pack while it was being
 * reviewed (MULTI_PACK_PER_VENDOR_DESIGN.md §6a's one-click "Confirm" on a `counted_in` cell).
 *
 * Plain `ConfirmDialog`'s copy — "nothing has been imported yet, so nothing will change in your
 * catalog" — stopped being true the moment that click persisted a real `ProductVendorPack`,
 * independently of this session (`StockInRowHandler.confirmPack`'s own doc comment: it needs a
 * real vendor and pack to exist right away, days before any commit). Discarding used to leave
 * that pack behind with nothing on screen ever saying so, which is the whole defect this dialog
 * exists to close: it names what actually changed and lets each one be kept or removed.
 *
 * Every checkbox starts unchecked. A pack confirmed here is exactly as likely to have been a
 * real, correct answer as a mistake — the point is not to guess which, only to stop it happening
 * without anyone noticing.
 */
export function DiscardPacksDialog({ open, packs, loading = false, onCancel, onConfirm }: DiscardPacksDialogProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set())
  if (!open) return null

  function toggle(packId: string) {
    setChecked((current) => {
      const next = new Set(current)
      if (next.has(packId)) next.delete(packId)
      else next.add(packId)
      return next
    })
  }

  return (
    <Modal
      open
      onClose={onCancel}
      title="Discard this upload?"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => onConfirm(Array.from(checked))} loading={loading}>
            Discard it
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-neutral-600">
          Nothing has been imported yet, so no stock or product changes will be undone. But while
          reviewing this file you confirmed{' '}
          {packs.length === 1 ? 'a new pack' : `${packs.length} new packs`} — those were saved to
          your catalog right away and won&rsquo;t be removed just because you discard the file.
          Check any you&rsquo;d like removed too.
        </p>
        <ul className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3">
          {packs.map((pack) => (
            <li key={pack.packId} className="flex items-start gap-2">
              <input
                type="checkbox"
                id={`discard-pack-${pack.packId}`}
                checked={checked.has(pack.packId)}
                onChange={() => toggle(pack.packId)}
                className="mt-0.5"
              />
              <label htmlFor={`discard-pack-${pack.packId}`} className="text-sm text-neutral-700">
                <span className="font-medium">{pack.packLabel}</span> for {pack.productName} from{' '}
                {pack.vendorName}
              </label>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  )
}
