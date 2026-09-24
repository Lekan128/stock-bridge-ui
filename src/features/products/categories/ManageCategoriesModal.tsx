import { useState, type FormEvent } from 'react'
import { Pencil, Tags, Trash2 } from 'lucide-react'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { Modal } from '@/components/Modal'
import { Spinner } from '@/components/Spinner'
import { TextField } from '@/components/TextField'
import { useToast } from '@/components/useToast'
import { companyCategoriesApi } from '@/features/products/categories/api'
import { CATEGORY_NAME_MAX_LENGTH, type CompanyCategory } from '@/features/products/categories/types'
import { isAppError } from '@/types/api'

export interface ManageCategoriesModalProps {
  open: boolean
  onClose: () => void
  categories: CompanyCategory[]
  loading: boolean
  loadError: string | null
  onRetry: () => void
  /** A category was created or renamed — apply it to the caller's list. */
  onSaved: (category: CompanyCategory) => void
  /**
   * A category was deleted. Its products are now uncategorised, so the caller's product list (the
   * category names on its rows, any filter set to this category) is out of date too.
   */
  onDeleted: (category: CompanyCategory) => void
}

function productCountLabel(count: number): string {
  return `${count} product${count === 1 ? '' : 's'}`
}

function errorMessage(err: unknown, fallback: string): string {
  // 409 (the name exists) and 400 (blank, too long) both carry a sentence written for the user.
  return isAppError(err) ? err.message : fallback
}

/**
 * Add, rename and delete the company's categories — reached from the product list's toolbar,
 * MANAGE_PRODUCTS only.
 *
 * One row is renamed at a time. Two open inputs would each need their own error and their own
 * Enter key, and nobody renames two categories in the same breath.
 */
export function ManageCategoriesModal({
  open,
  onClose,
  categories,
  loading,
  loadError,
  onRetry,
  onSaved,
  onDeleted,
}: ManageCategoriesModalProps) {
  const { showToast } = useToast()
  const [newName, setNewName] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [renaming, setRenaming] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<CompanyCategory | null>(null)
  const [deleting, setDeleting] = useState(false)

  function close() {
    setNewName('')
    setAddError(null)
    setEditingId(null)
    setEditError(null)
    onClose()
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault()
    const name = newName.trim()
    if (!name) {
      setAddError('Type a name for the category.')
      return
    }
    setAdding(true)
    setAddError(null)
    try {
      const created = await companyCategoriesApi.create({ name })
      onSaved(created)
      setNewName('')
    } catch (err) {
      setAddError(errorMessage(err, 'We could not add that category. Please try again.'))
    } finally {
      setAdding(false)
    }
  }

  function startRename(category: CompanyCategory) {
    setEditingId(category.id)
    setEditName(category.name)
    setEditError(null)
  }

  async function handleRename(event: FormEvent, category: CompanyCategory) {
    event.preventDefault()
    const name = editName.trim()
    if (!name) {
      setEditError('Type a name for the category.')
      return
    }
    // Saving the same name is not an edit — close without a request.
    if (name === category.name) {
      setEditingId(null)
      return
    }
    setRenaming(true)
    setEditError(null)
    try {
      const saved = await companyCategoriesApi.rename(category.id, { name })
      onSaved(saved)
      setEditingId(null)
    } catch (err) {
      setEditError(errorMessage(err, 'We could not rename that category. Please try again.'))
    } finally {
      setRenaming(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await companyCategoriesApi.remove(deleteTarget.id)
      onDeleted(deleteTarget)
      if (editingId === deleteTarget.id) setEditingId(null)
      showToast(`“${deleteTarget.name}” deleted.`, 'success')
      setDeleteTarget(null)
    } catch (err) {
      showToast(errorMessage(err, 'We could not delete that category. Please try again.'), 'error')
    } finally {
      setDeleting(false)
    }
  }

  const deleteMessage =
    deleteTarget == null
      ? ''
      : deleteTarget.productCount === 0
        ? 'No products are in this category.'
        : `${productCountLabel(deleteTarget.productCount)} will become uncategorised. The products themselves are kept.`

  return (
    <>
      <Modal
        open={open}
        // While the confirmation is up, Escape belongs to it alone — both dialogs listen on the
        // document, and one keypress should not close the confirmation and this behind it.
        onClose={deleteTarget ? () => undefined : close}
        title="Manage categories"
        size="md"
        footer={
          <Button variant="secondary" onClick={close}>
            Done
          </Button>
        }
      >
        <div className="flex flex-col gap-5">
          <form onSubmit={(event) => void handleAdd(event)} className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <div className="flex-1">
              <TextField
                id="new-category-name"
                label="Add a category"
                placeholder="Grains"
                maxLength={CATEGORY_NAME_MAX_LENGTH}
                value={newName}
                disabled={adding}
                error={addError ?? undefined}
                onChange={(event) => {
                  setNewName(event.target.value)
                  setAddError(null)
                }}
              />
            </div>
            <Button type="submit" loading={adding} className="sm:mt-7">
              Add
            </Button>
          </form>

          {loading && categories.length === 0 ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : loadError && categories.length === 0 ? (
            <div className="flex flex-col items-start gap-2 rounded-md border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
              <p>{loadError}</p>
              <Button variant="secondary" onClick={onRetry}>
                Try again
              </Button>
            </div>
          ) : categories.length === 0 ? (
            <EmptyState
              icon={Tags}
              title="No categories yet"
              description="Add one above, then choose it on a product. Grains, Drinks, Cleaning — whatever helps you find things."
            />
          ) : (
            <ul className="divide-y divide-neutral-100 rounded-md border border-neutral-200" aria-label="Your categories">
              {categories.map((category) => (
                <li key={category.id} className="px-3 py-2.5">
                  {editingId === category.id ? (
                    <form
                      onSubmit={(event) => void handleRename(event, category)}
                      className="flex flex-col gap-2 sm:flex-row sm:items-start"
                    >
                      <div className="flex-1">
                        <TextField
                          id={`rename-category-${category.id}`}
                          label={`New name for ${category.name}`}
                          autoFocus
                          maxLength={CATEGORY_NAME_MAX_LENGTH}
                          value={editName}
                          disabled={renaming}
                          error={editError ?? undefined}
                          onChange={(event) => {
                            setEditName(event.target.value)
                            setEditError(null)
                          }}
                          onKeyDown={(event) => {
                            // Escape backs out of the rename, not out of the whole dialog.
                            if (event.key === 'Escape') {
                              event.preventDefault()
                              event.stopPropagation()
                              setEditingId(null)
                            }
                          }}
                        />
                      </div>
                      <div className="flex gap-2 sm:mt-7">
                        <Button type="submit" loading={renaming}>
                          Save
                        </Button>
                        <Button variant="secondary" onClick={() => setEditingId(null)} disabled={renaming}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-neutral-900">{category.name}</p>
                        <p className="text-xs text-neutral-500">{productCountLabel(category.productCount)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startRename(category)}
                          aria-label={`Rename ${category.name}`}
                          className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(category)}
                          aria-label={`Delete ${category.name}`}
                          className="rounded-md p-2 text-neutral-500 hover:bg-danger-50 hover:text-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>

      {/* A sibling rendered after the dialog, so it stacks above it. */}
      <ConfirmDialog
        open={open && deleteTarget != null}
        title={deleteTarget ? `Delete “${deleteTarget.name}”?` : 'Delete category?'}
        message={deleteMessage}
        confirmLabel="Delete category"
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null)
        }}
      />
    </>
  )
}
