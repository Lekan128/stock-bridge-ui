import { z } from 'zod'
import type { ProductFormPayload } from '@/features/products/types'

function isNonNegativeNumber(value: string): boolean {
  return value.length > 0 && !Number.isNaN(Number(value)) && Number(value) >= 0
}

function isNonNegativeInteger(value: string): boolean {
  return isNonNegativeNumber(value) && Number.isInteger(Number(value))
}

function isPositiveInteger(value: string): boolean {
  return isNonNegativeInteger(value) && Number(value) > 0
}

export const productFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  sku: z.string().trim().min(1, 'SKU is required'),
  description: z.string().trim(),
  unitPrice: z
    .string()
    .trim()
    .min(1, 'Unit price is required')
    .refine((v) => v.length === 0 || isNonNegativeNumber(v), 'Enter a valid non-negative price'),
  costPrice: z
    .string()
    .trim()
    .refine((v) => v === '' || isNonNegativeNumber(v), 'Enter a valid non-negative price'),
  lowStockThreshold: z
    .string()
    .trim()
    .refine((v) => v === '' || isNonNegativeInteger(v), 'Enter a whole number, 0 or greater'),
})

export type ProductFormValues = z.infer<typeof productFormSchema>

export function toProductPayload(values: ProductFormValues): ProductFormPayload {
  return {
    name: values.name,
    sku: values.sku,
    description: values.description || undefined,
    unitPrice: Number(values.unitPrice),
    costPrice: values.costPrice ? Number(values.costPrice) : undefined,
    lowStockThreshold: values.lowStockThreshold ? Number(values.lowStockThreshold) : undefined,
  }
}

export function productFormDefaults(): ProductFormValues {
  return { name: '', sku: '', description: '', unitPrice: '', costPrice: '', lowStockThreshold: '' }
}

const noteField = z.string().trim().max(1000, 'Must be 1000 characters or fewer')

export function makeStockQuantitySchema(maxQuantity?: number) {
  return z.object({
    quantity: z
      .string()
      .trim()
      .min(1, 'Quantity is required')
      .refine((v) => v.length === 0 || isPositiveInteger(v), 'Enter a whole number greater than 0')
      .refine(
        (v) => maxQuantity === undefined || v.length === 0 || !isPositiveInteger(v) || Number(v) <= maxQuantity,
        `Cannot exceed the current quantity on hand (${maxQuantity})`,
      ),
    unitPrice: z.string().trim().refine((v) => v === '' || isNonNegativeNumber(v), 'Enter a valid non-negative price'),
    note: noteField,
  })
}

export type StockQuantityFormValues = z.infer<ReturnType<typeof makeStockQuantitySchema>>

export const stockAdjustmentSchema = z.object({
  newQuantity: z
    .string()
    .trim()
    .min(1, 'New quantity is required')
    .refine((v) => v.length === 0 || isNonNegativeInteger(v), 'Enter a whole number, 0 or greater'),
  note: z.string().trim().min(1, 'A reason is required').max(1000, 'Must be 1000 characters or fewer'),
})

export type StockAdjustmentFormValues = z.infer<typeof stockAdjustmentSchema>
