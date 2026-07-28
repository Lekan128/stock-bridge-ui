import { z } from 'zod'
import type {
  CreateCategoryPayload,
  UpdateCategoryPayload,
  UpdateMarketplaceDetailsPayload,
  UpdateMarketplaceSettingsPayload,
} from '@/features/marketplace/types'

/**
 * Every numeric field is held as a string in the form and converted at the boundary. That is the
 * existing convention in this codebase (`features/products/schemas.ts`) and it is the honest one
 * for money: a number input bound to a JS number turns "" into NaN and 0 into a value the operator
 * never typed, which on a *live pricing screen* is exactly the mistake you cannot afford.
 */
function isMoney(value: string): boolean {
  return /^\d+(\.\d{1,2})?$/.test(value)
}

function isPositiveInteger(value: string): boolean {
  return /^\d+$/.test(value) && Number(value) > 0
}

/** Mirrors the backend's slug normalisation: lowercase, digits and single hyphens. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// ---------------------------------------------------------------------------------------------
// Product marketplace details
// ---------------------------------------------------------------------------------------------

export const marketplaceDetailsSchema = z.object({
  // '' means "no category" and is sent as clearCategory — the API cannot express that with a null
  // categoryId, which it reads as "leave as is".
  categoryId: z.string(),
  unitOfMeasure: z.string().trim().max(50, 'Must be 50 characters or fewer'),
  minOrderQuantity: z
    .string()
    .trim()
    .min(1, 'Minimum order quantity is required')
    .refine(isPositiveInteger, 'Enter a whole number of 1 or more'),
  brand: z.string().trim().max(120, 'Must be 120 characters or fewer'),
  slug: z
    .string()
    .trim()
    .max(160, 'Must be 160 characters or fewer')
    .refine((v) => v === '' || SLUG_PATTERN.test(v), 'Use lowercase letters, numbers and hyphens, e.g. golden-penny-flour'),
})

export type MarketplaceDetailsFormValues = z.infer<typeof marketplaceDetailsSchema>

export function toMarketplaceDetailsPayload(
  values: MarketplaceDetailsFormValues,
  originalCategoryId?: string | null,
): UpdateMarketplaceDetailsPayload {
  const clearing = values.categoryId === '' && Boolean(originalCategoryId)
  return {
    categoryId: values.categoryId || undefined,
    clearCategory: clearing || undefined,
    unitOfMeasure: values.unitOfMeasure || undefined,
    minOrderQuantity: Number(values.minOrderQuantity),
    brand: values.brand || undefined,
    slug: values.slug || undefined,
  }
}

// ---------------------------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------------------------

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120, 'Must be 120 characters or fewer'),
  slug: z
    .string()
    .trim()
    .max(120, 'Must be 120 characters or fewer')
    .refine((v) => v === '' || SLUG_PATTERN.test(v), 'Use lowercase letters, numbers and hyphens, e.g. cooking-oils'),
  parentId: z.string(),
  sortOrder: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d+$/.test(v), 'Enter a whole number, 0 or greater'),
  active: z.boolean(),
})

export type CategoryFormValues = z.infer<typeof categorySchema>

export function categoryFormDefaults(): CategoryFormValues {
  return { name: '', slug: '', parentId: '', sortOrder: '', active: true }
}

export function toCreateCategoryPayload(values: CategoryFormValues): CreateCategoryPayload {
  return {
    name: values.name,
    // Omitted, the server derives the slug from the name — which is what someone typing
    // "Cooking Oils & Fats" expects. Only an explicitly typed slug is honoured exactly (and only
    // that one can collide with a 409).
    slug: values.slug || undefined,
    parentId: values.parentId || undefined,
    sortOrder: values.sortOrder === '' ? undefined : Number(values.sortOrder),
    active: values.active,
  }
}

export function toUpdateCategoryPayload(
  values: CategoryFormValues,
  originalParentId?: string | null,
): UpdateCategoryPayload {
  return {
    name: values.name,
    slug: values.slug || undefined,
    parentId: values.parentId || undefined,
    clearParent: values.parentId === '' && Boolean(originalParentId) ? true : undefined,
    sortOrder: values.sortOrder === '' ? undefined : Number(values.sortOrder),
    active: values.active,
  }
}

// ---------------------------------------------------------------------------------------------
// Commercial settings
// ---------------------------------------------------------------------------------------------

const moneyField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine(isMoney, 'Enter an amount in naira, e.g. 2500 or 2500.00')

export const marketplaceSettingsSchema = z
  .object({
    deliveryFee: moneyField('Delivery fee'),
    freeDeliveryThreshold: moneyField('Free delivery threshold'),
    minimumOrderValue: moneyField('Minimum order value'),
    payOnDeliveryEnabled: z.boolean(),
    payOnDeliveryMaxOrderValue: moneyField('Pay-on-delivery limit'),
    supportPhone: z.string().trim().max(50, 'Must be 50 characters or fewer'),
    supportEmail: z
      .string()
      .trim()
      .max(255, 'Must be 255 characters or fewer')
      .refine((v) => v === '' || z.email().safeParse(v).success, 'Enter a valid email address'),
  })
  // The server rejects this combination too; catching it here explains *why* it is nonsense rather
  // than returning a bare 400 after the operator has already pressed save.
  .refine(
    (values) =>
      !values.payOnDeliveryEnabled ||
      !isMoney(values.payOnDeliveryMaxOrderValue) ||
      !isMoney(values.minimumOrderValue) ||
      Number(values.payOnDeliveryMaxOrderValue) >= Number(values.minimumOrderValue),
    {
      path: ['payOnDeliveryMaxOrderValue'],
      message: 'Must be at least the minimum order value, or no order could ever qualify for pay on delivery',
    },
  )

export type MarketplaceSettingsFormValues = z.infer<typeof marketplaceSettingsSchema>

/** PUT is a full replacement — every field is sent, every time. */
export function toSettingsPayload(values: MarketplaceSettingsFormValues): UpdateMarketplaceSettingsPayload {
  return {
    deliveryFee: Number(values.deliveryFee),
    freeDeliveryThreshold: Number(values.freeDeliveryThreshold),
    minimumOrderValue: Number(values.minimumOrderValue),
    payOnDeliveryEnabled: values.payOnDeliveryEnabled,
    payOnDeliveryMaxOrderValue: Number(values.payOnDeliveryMaxOrderValue),
    supportPhone: values.supportPhone || undefined,
    supportEmail: values.supportEmail || undefined,
  }
}
