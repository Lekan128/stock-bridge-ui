import { useState } from 'react'
import { FolderTree, Info, Pencil, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/Skeleton'
import { useToast } from '@/components/useToast'
import { marketplaceAdminApi } from '@/features/marketplace/api/marketplaceAdminApi'
import { CategoryFormModal } from '@/features/marketplace/components/CategoryFormModal'
import { QueryErrorState } from '@/features/marketplace/components/QueryErrorState'
import type { AdminCategory } from '@/features/marketplace/types'
import { isAppError } from '@/types/api'

export interface CategoriesPanelProps {
  categories: AdminCategory[]
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Category administration.
 *
 * The interesting case is deletion. The server returns 409 when products still reference a
 * category, and its message points at deactivation instead — so the refusal is rendered as a
 * persistent callout with the deactivate action attached, rather than as a toast that disappears
 * before the operator has read what to do about it.
 */
export function CategoriesPanel({ categories, loading, error, refetch }: CategoriesPanelProps) {
  const { showToast } = useToast()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AdminCategory | undefined>(undefined)
  const [deleting, setDeleting] = useState<AdminCategory | null>(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)
  const [blocked, setBlocked] = useState<{ category: AdminCategory; message: string } | null>(null)
  const [deactivating, setDeactivating] = useState(false)

  function openCreate() {
    setEditing(undefined)
    setFormOpen(true)
  }

  function openEdit(category: AdminCategory) {
    setEditing(category)
    setFormOpen(true)
  }

  async function handleDelete() {
    if (!deleting) return
    setDeleteSubmitting(true)
    try {
      await marketplaceAdminApi.deleteCategory(deleting.id)
      showToast(`${deleting.name} deleted.`, 'success')
      setDeleting(null)
      refetch()
    } catch (err: unknown) {
      if (isAppError(err) && err.status === 409) {
        // The server knows exactly why, and its message names the alternative. Show it verbatim.
        setBlocked({ category: deleting, message: err.message })
        setDeleting(null)
        return
      }
      showToast(isAppError(err) ? err.message : 'That category could not be deleted.', 'error')
    } finally {
      setDeleteSubmitting(false)
    }
  }

  async function handleDeactivate(category: AdminCategory) {
    setDeactivating(true)
    try {
      await marketplaceAdminApi.updateCategory(category.id, { active: false })
      showToast(`${category.name} is no longer shown on the storefront.`, 'success')
      setBlocked(null)
      refetch()
    } catch (err: unknown) {
      showToast(isAppError(err) ? err.message : 'That category could not be deactivated.', 'error')
    } finally {
      setDeactivating(false)
    }
  }

  async function toggleActive(category: AdminCategory) {
    try {
      await marketplaceAdminApi.updateCategory(category.id, { active: !category.active })
      showToast(
        category.active ? `${category.name} hidden from the storefront.` : `${category.name} is live again.`,
        'success',
      )
      refetch()
    } catch (err: unknown) {
      showToast(isAppError(err) ? err.message : 'That category could not be updated.', 'error')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Categories</h2>
          <p className="mt-1 text-sm text-neutral-500">
            How buyers navigate the storefront. Categories are global and nest one level deep.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New category
        </Button>
      </div>

      {blocked && (
        <div role="alert" className="flex flex-col gap-3 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-warning-600" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-warning-900">{blocked.category.name} cannot be deleted</p>
              <p className="mt-0.5 text-sm text-warning-800">{blocked.message}</p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            {blocked.category.active && (
              <Button
                variant="secondary"
                loading={deactivating}
                onClick={() => void handleDeactivate(blocked.category)}
              >
                Deactivate instead
              </Button>
            )}
            <Button variant="secondary" onClick={() => setBlocked(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center gap-4 rounded-lg border border-neutral-200 bg-white px-4 py-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="ml-auto h-7 w-16 rounded-md" />
            </div>
          ))}
        </div>
      )}

      {!loading && error && <QueryErrorState title="Categories could not be loaded" message={error} onRetry={refetch} />}

      {!loading && !error && categories.length === 0 && (
        <EmptyState
          icon={FolderTree}
          title="No categories yet"
          description="Categories group the catalog for buyers. Create the first one — for example “Grains & Staples” — then assign products to it from the Products tab."
          action={<Button onClick={openCreate}>Create the first category</Button>}
        />
      )}

      {!loading && !error && categories.length > 0 && (
        <ul className="flex flex-col gap-2">
          {categories.map((category) => {
            const parent = categories.find((option) => option.id === category.parentId)

            return (
              <li
                key={category.id}
                className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-neutral-900">{category.name}</p>
                    {!category.active && <Badge variant="neutral">Hidden</Badge>}
                    {parent && <Badge variant="info">under {parent.name}</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    /{category.slug} · {category.productCount} product{category.productCount === 1 ? '' : 's'} · sort{' '}
                    {category.sortOrder}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void toggleActive(category)}
                    className="rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    {category.active ? 'Hide from storefront' : 'Show on storefront'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(category)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(category)}
                    aria-label={`Delete ${category.name}`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-danger-600 hover:bg-danger-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Delete
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {formOpen && (
        <CategoryFormModal
          category={editing}
          categories={categories}
          onClose={() => setFormOpen(false)}
          onSaved={(category, mode) => {
            setFormOpen(false)
            showToast(mode === 'created' ? `${category.name} created.` : `${category.name} saved.`, 'success')
            refetch()
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete category"
        message={
          deleting
            ? `Delete “${deleting.name}”? ${
                deleting.productCount > 0
                  ? `${deleting.productCount} product${deleting.productCount === 1 ? ' is' : 's are'} still in it, so this will almost certainly be refused — hiding it from the storefront is usually what you want.`
                  : 'It has no products, so nothing on the storefront will change.'
              }`
            : ''
        }
        confirmLabel="Delete category"
        loading={deleteSubmitting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
