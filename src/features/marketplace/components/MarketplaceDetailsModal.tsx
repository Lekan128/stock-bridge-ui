import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { Modal } from '@/components/Modal'
import { TextField } from '@/components/TextField'
import { marketplaceAdminApi } from '@/features/marketplace/api/marketplaceAdminApi'
import { StockBreakdown } from '@/features/marketplace/components/StockBreakdown'
import {
  marketplaceDetailsSchema,
  toMarketplaceDetailsPayload,
  type MarketplaceDetailsFormValues,
} from '@/features/marketplace/schemas'
import type { AdminCatalogProduct, AdminCategory } from '@/features/marketplace/types'
import { isAppError } from '@/types/api'

export interface MarketplaceDetailsModalProps {
  product: AdminCatalogProduct
  categories: AdminCategory[]
  onClose: () => void
  onSaved: (product: AdminCatalogProduct) => void
}

/**
 * The marketplace-only facets of a product: where it sits in the catalog, how it is sold and what
 * it is called in a URL.
 *
 * Name, price, image and SKU are deliberately absent — those are edited in Inventory, because
 * ProcurePal's catalog rows are ordinary tenant products that happen to be for sale, and giving
 * the same row two editing surfaces is how they drift apart.
 */
export function MarketplaceDetailsModal({ product, categories, onClose, onSaved }: MarketplaceDetailsModalProps) {
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<MarketplaceDetailsFormValues>({
    resolver: zodResolver(marketplaceDetailsSchema),
    defaultValues: {
      categoryId: product.categoryId ?? '',
      unitOfMeasure: product.unitOfMeasure ?? '',
      minOrderQuantity: String(product.minOrderQuantity ?? 1),
      brand: product.brand ?? '',
      slug: product.slug ?? '',
    },
  })

  async function onSubmit(values: MarketplaceDetailsFormValues) {
    setFormError(null)
    try {
      const updated = await marketplaceAdminApi.updateMarketplaceDetails(
        product.id,
        toMarketplaceDetailsPayload(values, product.categoryId),
      )
      onSaved(updated)
    } catch (err: unknown) {
      // A typed slug that is already taken comes back as 409. That is a problem with one field,
      // so it belongs next to that field — a toast would vanish before the operator could fix it.
      if (isAppError(err) && err.status === 409) {
        setError('slug', { message: err.message })
        return
      }
      setFormError(isAppError(err) ? err.message : 'Those details could not be saved. Please try again.')
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Marketplace details"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
            Save details
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
          <p className="text-sm font-medium text-neutral-900">{product.name}</p>
          <p className="text-xs text-neutral-500">{product.sku}</p>
          <div className="mt-2 border-t border-neutral-200 pt-2">
            <StockBreakdown product={product} />
          </div>
        </div>

        <div>
          <label htmlFor="details-category" className="mb-1.5 block text-sm font-medium text-neutral-700">
            Category
          </label>
          <select
            id="details-category"
            {...register('categoryId')}
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
          >
            <option value="">Uncategorised</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
                {category.active ? '' : ' (inactive)'}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-neutral-500">
            Buyers filter the storefront by category — an uncategorised product is only findable by search.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Unit of measure"
            hint="How it is sold: bag (50kg), carton, crate…"
            error={errors.unitOfMeasure?.message}
            {...register('unitOfMeasure')}
          />
          <TextField
            label="Minimum order quantity"
            type="number"
            min={1}
            hint="Smaller orders are rounded up to this, never rejected"
            error={errors.minOrderQuantity?.message}
            {...register('minOrderQuantity')}
          />
        </div>

        <TextField label="Brand" error={errors.brand?.message} {...register('brand')} />

        <TextField
          label="Storefront slug"
          hint="Leave blank to keep the one generated from the product name. Changing it breaks existing links."
          error={errors.slug?.message}
          {...register('slug')}
        />

        <FormError message={formError} />
      </form>
    </Modal>
  )
}
