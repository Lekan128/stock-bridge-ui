import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { TextField } from '@/components/TextField'
import { useToast } from '@/components/useToast'
import { productsApi } from '@/features/products/api/productsApi'
import { ImageUploadField } from '@/features/products/components/ImageUploadField'
import { ProductFormSkeleton } from '@/features/products/components/ProductFormSkeleton'
import { useProduct } from '@/features/products/hooks/useProduct'
import {
  productFormDefaults,
  productFormSchema,
  toProductPayload,
  type ProductFormValues,
} from '@/features/products/schemas'
import { isAppError } from '@/types/api'

const KNOWN_FIELDS = new Set<keyof ProductFormValues>([
  'name',
  'sku',
  'description',
  'unitPrice',
  'costPrice',
  'lowStockThreshold',
])

export function ProductFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { product, loading: loadingProduct } = useProduct(id)
  const [formError, setFormError] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [removeImage, setRemoveImage] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: productFormDefaults(),
  })

  useEffect(() => {
    if (!product) return
    reset({
      name: product.name,
      sku: product.sku,
      description: product.description ?? '',
      unitPrice: String(product.unitPrice),
      costPrice: product.costPrice != null ? String(product.costPrice) : '',
      lowStockThreshold: product.lowStockThreshold != null ? String(product.lowStockThreshold) : '',
    })
  }, [product, reset])

  function handleImageFileSelect(selected: File | null) {
    setImageFile(selected)
    if (selected) setRemoveImage(false)
  }

  async function onSubmit(values: ProductFormValues) {
    setFormError(null)
    const payload = toProductPayload(values)
    try {
      const saved =
        isEdit && id
          ? await productsApi.update(id, { ...payload, removeImage: removeImage || undefined }, imageFile)
          : await productsApi.create(payload, imageFile)

      if (saved.warnings?.length) {
        showToast(`Product saved, but ${saved.warnings.join(' ')}`, 'success')
      } else {
        showToast(isEdit ? 'Product updated.' : 'Product created.', 'success')
      }
      navigate(`/products/${saved.id}`)
    } catch (err) {
      if (!isAppError(err)) {
        setFormError('Something went wrong. Please try again.')
        return
      }

      if (err.status === 409) {
        setError('sku', { message: err.message })
        return
      }

      let mappedAny = false
      for (const fieldError of err.errors ?? []) {
        if (fieldError.field && KNOWN_FIELDS.has(fieldError.field as keyof ProductFormValues)) {
          setError(fieldError.field as keyof ProductFormValues, { message: fieldError.message })
          mappedAny = true
        }
      }
      if (mappedAny) return

      setFormError(err.message)
    }
  }

  if (isEdit && loadingProduct) {
    return <ProductFormSkeleton />
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-semibold text-neutral-900">{isEdit ? 'Edit product' : 'Add product'}</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        <div>
          <p className="mb-1.5 text-sm font-medium text-neutral-700">Product image</p>
          <ImageUploadField
            file={imageFile}
            existingImageUrl={product?.imageUrl}
            removed={removeImage}
            onFileSelect={handleImageFileSelect}
            onRemove={() => setRemoveImage(true)}
          />
        </div>

        <TextField label="Name" error={errors.name?.message} {...register('name')} />
        <TextField label="SKU" error={errors.sku?.message} {...register('sku')} />

        <div>
          <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-neutral-700">
            Description
          </label>
          <textarea
            id="description"
            rows={3}
            className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
            {...register('description')}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <TextField
            label="Unit price"
            inputMode="decimal"
            error={errors.unitPrice?.message}
            {...register('unitPrice')}
          />
          <TextField
            label="Cost price"
            inputMode="decimal"
            hint="Optional"
            error={errors.costPrice?.message}
            {...register('costPrice')}
          />
        </div>

        <TextField
          label="Low stock threshold"
          inputMode="numeric"
          hint="Get an alert when quantity on hand drops to or below this number"
          error={errors.lowStockThreshold?.message}
          {...register('lowStockThreshold')}
        />

        <FormError message={formError} />

        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isEdit ? 'Save changes' : 'Create product'}
          </Button>
        </div>
      </form>
    </div>
  )
}
