import { useState } from 'react'
import { Store } from 'lucide-react'
import { useOptionalWorkingBranch, useWorkingBranch } from '@/features/branches/useWorkingBranch'

/** Which branches a product is for (API V92): every branch, or these. */
export interface ProductBranchesValue {
  all: boolean
  ids: string[]
}

/** A new product's branches: the one being worked at; "All branches" when the owner is looking at all of them. */
export function defaultProductBranches(working: { id: string } | null, isAll: boolean): ProductBranchesValue {
  return isAll || !working ? { all: true, ids: [] } : { all: false, ids: [working.id] }
}

/** "Head Office", "Head Office, Ikeja", "All branches" - for the line, the review and the product page. */
export function productBranchesText(
  value: { all: boolean; ids: string[] },
  nameOf: (id: string | undefined) => string | undefined,
): string {
  if (value.all) return 'All branches'
  const names = value.ids.map((id) => nameOf(id)).filter((name): name is string => !!name)
  return names.length > 0 ? names.join(', ') : 'No branch yet'
}

interface ProductBranchesFieldProps {
  value: ProductBranchesValue
  onChange: (value: ProductBranchesValue) => void
}

/**
 * "For  Head Office · Change" (owner, 2026-11-17): one small line saying where the product will show, opening in
 * place to tick other branches - not a big part of the product, but important to know. Nothing at a one-branch
 * company.
 */
export function ProductBranchesField({ value, onChange }: ProductBranchesFieldProps) {
  const { isMultiBranch, branches, nameOf } = useWorkingBranch()
  const [open, setOpen] = useState(false)
  if (!isMultiBranch) return null
  const choices = branches.filter((branch) => branch.active)
  const none = !value.all && value.ids.length === 0

  const toggle = (id: string) => {
    const ids = value.ids.includes(id) ? value.ids.filter((existing) => existing !== id) : [...value.ids, id]
    onChange({ all: false, ids })
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" data-product-branches>
        <Store className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden="true" />
        <span className="text-neutral-600">For</span>
        <span className={`font-medium ${none ? 'text-danger-700' : 'text-neutral-900'}`}>{productBranchesText(value, nameOf)}</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Change which branches it is for"
          className="rounded-sm font-medium text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          Change
        </button>
      </div>
    )
  }

  return (
    <fieldset className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5" data-product-branches>
      <legend className="sr-only">Which branches it is for</legend>
      <div className="flex items-center gap-2 text-sm">
        <Store className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden="true" />
        <span className="text-neutral-600">For</span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {choices.map((branch) => {
          const on = !value.all && value.ids.includes(branch.id)
          return (
            <button
              key={branch.id}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => toggle(branch.id)}
              className={`min-h-9 rounded-full border px-3 text-sm font-medium ${
                on ? 'border-primary-300 bg-primary-50 text-primary-800' : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400'
              }`}
            >
              {on ? '✓ ' : ''}
              {branch.name}
            </button>
          )
        })}
        <button
          type="button"
          role="checkbox"
          aria-checked={value.all}
          onClick={() => onChange(value.all ? { all: false, ids: [] } : { all: true, ids: [] })}
          className={`min-h-9 rounded-full border px-3 text-sm font-medium ${
            value.all ? 'border-primary-300 bg-primary-50 text-primary-800' : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400'
          }`}
        >
          {value.all ? '✓ ' : ''}All branches
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className={`text-xs ${none ? 'text-danger-700' : 'text-neutral-500'}`}>
          {none ? 'Choose at least one branch.' : value.all ? 'Shows at every branch, and any you open later.' : 'It shows only at these branches.'}
        </p>
        <button
          type="button"
          disabled={none}
          onClick={() => setOpen(false)}
          className="rounded-md px-2 py-1 text-sm font-semibold text-primary-700 hover:bg-primary-50 disabled:text-neutral-400"
        >
          Done
        </button>
      </div>
    </fieldset>
  )
}

/**
 * "Head Office, Ikeja" under a product in the owner's All branches view, where products of every branch show
 * together; null anywhere else, and for a product that is for every branch.
 */
export function useForBranchesLine(product: { forAllBranches?: boolean; forBranchIds?: string[] }): string | null {
  const branch = useOptionalWorkingBranch()
  if (!branch?.isMultiBranch || !branch.isAll || product.forAllBranches !== false) return null
  return productBranchesText({ all: false, ids: product.forBranchIds ?? [] }, branch.nameOf)
}
