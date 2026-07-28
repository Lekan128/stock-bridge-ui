import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { Modal } from '@/components/Modal'
import { TextField } from '@/components/TextField'
import { marketplaceAdminApi } from '@/features/marketplace/api/marketplaceAdminApi'
import {
  categoryFormDefaults,
  categorySchema,
  toCreateCategoryPayload,
  toUpdateCategoryPayload,
  type CategoryFormValues,
} from '@/features/marketplace/schemas'
import type { AdminCategory } from '@/features/marketplace/types'
import { isAppError } from '@/types/api'
import { slugify } from '@/utils/slugify'

export interface CategoryFormModalProps {
  /** Omitted when creating. */
  category?: AdminCategory
  categories: AdminCategory[]
  onClose: () => void
  onSaved: (category: AdminCategory, mode: 'created' | 'updated') => void
}

export function CategoryFormModal({ category, categories, onClose, onSaved }: CategoryFormModalProps) {
  const [formError, setFormError] = useState<string | null>(null)
  const editing = category !== undefined

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: category
      ? {
          name: category.name,
          slug: category.slug,
          parentId: category.parentId ?? '',
          sortOrder: String(category.sortOrder),
          active: category.active,
        }
      : categoryFormDefaults(),
  })

  const nameValue = watch('name')
  const slugValue = watch('slug')

  // Categories nest one level only, so a parent must itself be top-level — and nothing may be its
  // own parent.
  const parentOptions = categories.filter(
    (option) => option.id !== category?.id && (option.parentId === null || option.parentId === undefined),
  )

  async function onSubmit(values: CategoryFormValues) {
    setFormError(null)
    try {
      if (editing) {
        const updated = await marketplaceAdminApi.updateCategory(category.id, toUpdateCategoryPayload(values, category.parentId))
        onSaved(updated, 'updated')
      } else {
        const created = await marketplaceAdminApi.createCategory(toCreateCategoryPayload(values))
        onSaved(created, 'created')
      }
    } catch (err: unknown) {
      // A slug the operator typed themselves can collide — that is a single-field problem and it
      // belongs on the field, where they can fix it without re-reading a vanished toast.
      if (isAppError(err) && err.status === 409) {
        setError('slug', { message: err.message })
        return
      }
      setFormError(isAppError(err) ? err.message : 'That category could not be saved. Please try again.')
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Edit category' : 'New category'}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
            {editing ? 'Save category' : 'Create category'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <TextField label="Name" error={errors.name?.message} {...register('name')} />

        <TextField
          label="Slug"
          hint={
            slugValue
              ? 'Used in storefront URLs. Changing it breaks existing links.'
              : `Leave blank and the server derives one${nameValue ? `: ${slugify(nameValue) || '—'}` : ''}.`
          }
          error={errors.slug?.message}
          {...register('slug')}
        />

        <div>
          <label htmlFor="category-parent" className="mb-1.5 block text-sm font-medium text-neutral-700">
            Parent category
          </label>
          <select
            id="category-parent"
            {...register('parentId')}
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
          >
            <option value="">None — top level</option>
            {parentOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-neutral-500">Categories nest one level deep at most.</p>
        </div>

        <TextField
          label="Sort order"
          type="number"
          min={0}
          hint="Lower numbers appear first in the storefront menu."
          error={errors.sortOrder?.message}
          {...register('sortOrder')}
        />

        <label className="flex items-start gap-2.5">
          <input
            type="checkbox"
            {...register('active')}
            className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
          />
          <span>
            <span className="block text-sm font-medium text-neutral-700">Active</span>
            <span className="block text-xs text-neutral-500">
              Inactive categories disappear from the storefront menu. Their products stay listed and searchable.
            </span>
          </span>
        </label>

        <FormError message={formError} />
      </form>
    </Modal>
  )
}
