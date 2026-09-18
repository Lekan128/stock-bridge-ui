import { useState, type KeyboardEvent } from 'react'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { companyCategoriesApi } from '@/features/products/categories/api'
import { CATEGORY_NAME_MAX_LENGTH, type CompanyCategory } from '@/features/products/categories/types'
import { isAppError } from '@/types/api'

/** The select's sentinel for "+ New category". Never a real id, never submitted. */
const NEW_CATEGORY = '__new__'

export interface CategoryFieldProps {
  /** A category id, or '' for none. */
  value: string
  onChange: (categoryId: string) => void
  categories: CompanyCategory[]
  loading: boolean
  /** Why the list did not load, if it did not. The field still works as "No category". */
  loadError: string | null
  /** MANAGE_PRODUCTS — whether "+ New category" is offered at all. */
  canCreate: boolean
  /** Called with the category the server just created, before it is selected. */
  onCreated: (category: CompanyCategory) => void
  error?: string
}

/**
 * The product form's optional "Category" picker, with a way to add one without leaving the form.
 *
 * Controlled rather than `register`ed: the list arrives after the form has been filled from the
 * saved product, and a native `<select>` whose value was set before its option existed shows the
 * first option instead — an edit would look uncategorised while still holding the category.
 *
 * "+ New category" swaps the select for a name input in place. It cannot be a nested `<form>`
 * (this whole field sits inside the product form), so Enter is caught here and creates the
 * category instead of submitting the product.
 */
export function CategoryField({
  value,
  onChange,
  categories,
  loading,
  loadError,
  canCreate,
  onCreated,
  error,
}: CategoryFieldProps) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function handleSelect(next: string) {
    if (next === NEW_CATEGORY) {
      setCreating(true)
      setNewName('')
      setCreateError(null)
      return
    }
    onChange(next)
  }

  function cancelCreate() {
    setCreating(false)
    setCreateError(null)
  }

  async function create() {
    const name = newName.trim()
    if (!name) {
      setCreateError('Type a name for the category.')
      return
    }
    setSaving(true)
    setCreateError(null)
    try {
      const created = await companyCategoriesApi.create({ name })
      onCreated(created)
      onChange(created.id)
      setCreating(false)
    } catch (err) {
      // 409 (the name exists) and 400 (blank, too long) both carry a sentence for the user.
      setCreateError(isAppError(err) ? err.message : 'We could not add that category. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function handleNameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      void create()
    } else if (event.key === 'Escape') {
      // Stop here, so Escape backs out of the new name rather than reaching anything behind it.
      event.preventDefault()
      event.stopPropagation()
      cancelCreate()
    }
  }

  if (creating) {
    return (
      <div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <div className="flex-1 sm:max-w-xs">
            <TextField
              id="newCategoryName"
              label="New category"
              placeholder="Grains"
              autoFocus
              maxLength={CATEGORY_NAME_MAX_LENGTH}
              value={newName}
              disabled={saving}
              error={createError ?? undefined}
              hint="Press Enter to add it."
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={handleNameKeyDown}
            />
          </div>
          {/* Offset by the label's height so the buttons line up with the input, not the label. */}
          <div className="flex gap-2 sm:mt-7">
            <Button type="button" onClick={() => void create()} loading={saving}>
              Add
            </Button>
            <Button type="button" variant="secondary" onClick={cancelCreate} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <label htmlFor="categoryId" className="mb-1.5 block text-sm font-medium text-neutral-700">
        Category <span className="font-normal text-neutral-400">(optional)</span>
      </label>
      <select
        id="categoryId"
        value={value}
        onChange={(event) => handleSelect(event.target.value)}
        aria-invalid={!!error || undefined}
        aria-describedby="categoryId-hint"
        className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none sm:max-w-xs"
      >
        <option value="">No category</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
        {canCreate && <option value={NEW_CATEGORY}>+ New category</option>}
      </select>
      <p id="categoryId-hint" className="mt-1.5 text-xs text-neutral-500">
        {loading
          ? 'Loading your categories…'
          : loadError
            ? `${loadError} You can still save this product without one.`
            : 'Group your products your own way, so you can find them and list them on a stock sheet together.'}
      </p>
      {error && <p className="mt-1.5 text-xs text-danger-600">{error}</p>}
    </div>
  )
}
