import { api } from '@/api/client'
import type { UnitOption } from '@/features/products/types'

/** One ingredient as the server keeps it (API V95): as typed, in its stock unit, and its cost at cost price. */
export interface MadeWithIngredient {
  productId: string
  name: string
  quantity: number
  /** The unit typed in ("Derica", "BAG"); absent = the ingredient's stock unit. */
  unit?: string
  stockQuantity: number
  stockUnit?: string
  costPrice?: number
  cost?: number
  /** Every unit it can be typed in - its stock unit, packs and measures. */
  unitOptions: UnitOption[]
}

/** A branch the item is for, and where it is made there; `areaId` absent while that branch still needs a choice. */
export interface MadeInAt {
  branchId: string
  branchName: string
  areaId?: string
  areaName?: string
  /** Chosen for this branch, which has no area named like "Made in". */
  chosenForBranch: boolean
}

export interface MadeWith {
  madeIn?: string
  branches: MadeInAt[]
  ingredients: MadeWithIngredient[]
  /** The ingredients at their cost prices; absent while any has none. */
  costToMake?: number
  areaNames: string[]
}

export interface MadeWithPayload {
  madeIn: string | null
  madeInAt: { branchId: string; areaId: string }[]
  ingredients: { productId: string; quantity: number; unit?: string }[]
}

export const madeWithApi = {
  get: (productId: string) => api.get<MadeWith>(`/api/products/${productId}/made-with`).then((r) => r.data),
  set: (productId: string, payload: MadeWithPayload) =>
    api.put<MadeWith>(`/api/products/${productId}/made-with`, payload).then((r) => r.data),
}
