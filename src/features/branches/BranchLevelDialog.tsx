import { useState } from 'react'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { TextField } from '@/components/TextField'
import { useToast } from '@/components/useToast'
import { queryClient } from '@/data/queryClient'
import { invalidateInventory } from '@/data/inventoryCache'
import { syncCatalog } from '@/features/catalog/catalogStore'
import { branchesApi } from '@/features/branches/branchesApi'
import type { Branch } from '@/features/branches/types'
import { isAppError } from '@/types/api'

/**
 * One low-stock level for the selected products at this branch (Phase 4, Avatar C: "20 at Lekki for
 * every drink"). Left blank, each goes back to its own level. A shared-record edit: online only.
 */
export function BranchLevelDialog({
  branch,
  productIds,
  onClose,
  onDone,
}: {
  branch: Branch
  productIds: string[]
  onClose: () => void
  onDone: () => void
}) {
  const { showToast } = useToast()
  const [level, setLevel] = useState('')
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const typed = level.trim()
  const value = typed === '' ? null : Number(typed)
  const valid = value == null || (Number.isInteger(value) && value >= 0)
  const count = productIds.length

  async function save() {
    if (!valid) return
    setSaving(true)
    setProblem(null)
    try {
      const { updated } = await branchesApi.setThresholds(branch.id, { productIds, lowStockThreshold: value })
      void invalidateInventory(queryClient)
      void syncCatalog()
      showToast(
        value == null
          ? `${updated} ${updated === 1 ? 'product uses' : 'products use'} its own level at ${branch.name} again.`
          : `Low-stock level ${value} at ${branch.name} for ${updated} ${updated === 1 ? 'product' : 'products'}.`,
        'success',
      )
      onDone()
    } catch (error) {
      setProblem(isAppError(error) ? error.message : "Couldn't save the level. Try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Low-stock level at ${branch.name}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="action" disabled={!valid} loading={saving} onClick={() => void save()}>
            Set for {count} {count === 1 ? 'product' : 'products'}
          </Button>
        </>
      }
    >
      <TextField
        id="branch-level"
        label="Warn when there are this many or fewer"
        hint={`Only at ${branch.name}. Leave blank to use each product's own level.`}
        inputMode="numeric"
        value={level}
        autoFocus
        error={valid ? undefined : 'A whole number, 0 or more.'}
        onChange={(event) => setLevel(event.target.value.replace(/[^0-9]/g, ''))}
      />
      {problem && (
        <p role="alert" className="mt-2 text-sm text-danger-700">
          {problem}
        </p>
      )}
    </Modal>
  )
}
