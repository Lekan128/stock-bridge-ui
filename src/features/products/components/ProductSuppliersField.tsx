import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { UnitOfMeasureOption, UnitOption } from '@/features/products/types'
import type { ProductVendor } from '@/features/products/vendors/types'
import type { CompanyVendor } from '@/features/vendors/types'
import { AddSupplierInPlace } from '@/features/vendors/components/AddSupplierInPlace'
import { formatMoney } from '@/features/selling/money'
import { formatNumber, unitNoun } from '@/features/products/unitCopy'

/** The pack a supplier sends it in: the product's own, loose (by the stock unit), or another container. */
export const SAME_PACK = 'product'
export const LOOSE = 'loose'

/** One supplier card being filled in. Typed text, so "1." can be on its way to "1.5". */
export interface SupplierDraft {
  key: string
  companyVendorId: string
  /** `SAME_PACK`, `LOOSE`, or a packaging code ("CARTON"). */
  pack: string
  /** How much one of that other container holds, in the stock unit. */
  size: string
  /** Its price, per that pack (or per stock unit when loose). Optional. */
  price: string
}

export function newSupplierDraft(companyVendorId = '', productPack: UnitOption | null = null): SupplierDraft {
  return { key: `s-${Date.now()}-${Math.random()}`, companyVendorId, pack: productPack ? SAME_PACK : LOOSE, size: '', price: '' }
}

/** What the request carries for one supplier: its pack, and its price per stock unit. */
export interface SupplierLinkPayload {
  companyVendorId: string
  cost?: number
  packagingUnit?: string
  packagingSize?: number
}

/** The cards as the request carries them, or the first thing to fix. A card left empty is skipped. */
export function supplierLinks(
  drafts: SupplierDraft[],
  productPack: UnitOption | null,
): { links: SupplierLinkPayload[] } | { problem: string } {
  const links: SupplierLinkPayload[] = []
  for (const draft of drafts) {
    const touched = draft.price.trim() !== '' || (draft.pack !== SAME_PACK && draft.pack !== LOOSE)
    if (!draft.companyVendorId) {
      if (touched) return { problem: 'Choose who the supplier is, or take that card off.' }
      continue
    }
    let packagingUnit: string | undefined
    let factor = 1
    if (draft.pack === SAME_PACK && productPack) {
      packagingUnit = productPack.code
      factor = productPack.factorToStockUnit
    } else if (draft.pack !== SAME_PACK && draft.pack !== LOOSE) {
      const size = Number(draft.size)
      if (!draft.size.trim() || !Number.isFinite(size) || size <= 0) return { problem: 'Say how much one of their packs holds.' }
      packagingUnit = draft.pack
      factor = size
    }
    let cost: number | undefined
    if (draft.price.trim() !== '') {
      const price = Number(draft.price)
      if (!Number.isFinite(price) || price < 0) return { problem: 'A price is a number, like 80000.' }
      cost = price / factor
    }
    links.push({ companyVendorId: draft.companyVendorId, cost, packagingUnit, packagingSize: packagingUnit ? factor : undefined })
  }
  return { links }
}

/**
 * Who the product is bought from, as many as there are (owner, 2026-11-10: "add multiple suppliers to a product at
 * once"): a card each - the supplier, the pack they send it in (the product's own unless said otherwise) and what
 * they charge, both optional - and "+ Add another supplier". A supplier not in the list yet is added right here, as
 * on the stock-in panel; no popup. On an edit, the ones it already has are listed above the new cards.
 */
export function ProductSuppliersField({
  drafts,
  onChange,
  vendors,
  onVendorAdded,
  canAddVendor,
  linked,
  productPack,
  stockSymbol,
  packagingOptions,
}: {
  drafts: SupplierDraft[]
  onChange: (drafts: SupplierDraft[]) => void
  /** The company's suppliers, to choose from. */
  vendors: CompanyVendor[]
  onVendorAdded: (vendor: CompanyVendor) => void
  canAddVendor: boolean
  /** An edit: the suppliers it already has. */
  linked?: ProductVendor[]
  /** The product's pack as the form now has it: "Bag of 80 kg". */
  productPack: UnitOption | null
  /** "kg", for "how much one holds" and loose prices. */
  stockSymbol: string
  /** Containers a supplier's own pack can be. */
  packagingOptions: UnitOfMeasureOption[]
}) {
  const [adding, setAdding] = useState(false)
  const taken = new Set([...drafts.map((draft) => draft.companyVendorId), ...(linked ?? []).map((line) => line.companyVendorId)])

  function update(key: string, change: Partial<SupplierDraft>) {
    onChange(drafts.map((draft) => (draft.key === key ? { ...draft, ...change } : draft)))
  }

  return (
    <div className="flex flex-col gap-3" data-product-suppliers>
      {linked && linked.length > 0 && (
        <ul className="flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white" aria-label="Suppliers it has">
          {linked.map((line) => {
            const pack = line.packs.find((candidate) => candidate.isDefault) ?? line.packs[0]
            return (
              <li key={line.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-4 py-2.5" data-linked-supplier={line.companyVendorName}>
                <span className="font-medium text-neutral-900">
                  {line.companyVendorName}
                  {line.isPreferred && <span className="ml-2 text-xs font-normal text-neutral-500">Usual supplier</span>}
                </span>
                <span className="text-sm text-neutral-600">
                  {pack?.label}
                  {pack?.lastCostPrice != null && ` · ${formatMoney(pack.lastCostPrice)} a ${stockSymbol}`}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {drafts.map((draft, index) => {
        const choices = vendors.filter((vendor) => vendor.active !== false && (vendor.id === draft.companyVendorId || !taken.has(vendor.id)))
        const other = draft.pack !== SAME_PACK && draft.pack !== LOOSE
        const priceUnit =
          draft.pack === SAME_PACK && productPack
            ? unitNoun(productPack)
            : other
              ? (packagingOptions.find((option) => option.code === draft.pack)?.label ?? draft.pack).toLowerCase()
              : stockSymbol
        return (
          <div key={draft.key} className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4" data-supplier-card={index + 1}>
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <label htmlFor={`supplier-${draft.key}`} className="mb-1.5 block text-sm font-medium text-neutral-700">
                  Supplier
                </label>
                <select
                  id={`supplier-${draft.key}`}
                  value={draft.companyVendorId}
                  onChange={(event) => update(draft.key, { companyVendorId: event.target.value })}
                  className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
                >
                  <option value="">Choose a supplier</option>
                  {choices.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => onChange(drafts.filter((other) => other.key !== draft.key))}
                aria-label={`Take supplier ${index + 1} off`}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`supplier-pack-${draft.key}`} className="mb-1.5 block text-sm font-medium text-neutral-700">
                  Comes in
                </label>
                <select
                  id={`supplier-pack-${draft.key}`}
                  value={draft.pack}
                  onChange={(event) => update(draft.key, { pack: event.target.value, size: '' })}
                  className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
                >
                  {productPack && <option value={SAME_PACK}>{productPack.label}</option>}
                  <option value={LOOSE}>Loose, by the {stockSymbol || 'unit'}</option>
                  {packagingOptions.map((option) => (
                    <option key={option.code} value={option.code}>
                      {productPack ? `Another pack: ${option.label}` : option.label}
                    </option>
                  ))}
                </select>
              </div>
              {other && (
                <div>
                  <label htmlFor={`supplier-size-${draft.key}`} className="mb-1.5 block text-sm font-medium text-neutral-700">
                    How much one holds, in {stockSymbol}
                  </label>
                  <input
                    id={`supplier-size-${draft.key}`}
                    inputMode="decimal"
                    value={draft.size}
                    onChange={(event) => update(draft.key, { size: event.target.value })}
                    className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 tabular-nums focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
                  />
                </div>
              )}
              <div>
                <label htmlFor={`supplier-price-${draft.key}`} className="mb-1.5 block text-sm font-medium text-neutral-700">
                  Price (₦ a {priceUnit})
                </label>
                <input
                  id={`supplier-price-${draft.key}`}
                  inputMode="decimal"
                  value={draft.price}
                  onChange={(event) => update(draft.key, { price: event.target.value.replace(/,/g, '') })}
                  className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 tabular-nums focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
                />
                {draft.pack === SAME_PACK && productPack && Number(draft.price) > 0 && (
                  <p className="mt-1.5 text-xs text-neutral-500">
                    {formatMoney(Number(draft.price) / productPack.factorToStockUnit)} a {stockSymbol} ·{' '}
                    {formatNumber(productPack.factorToStockUnit)} {stockSymbol} a {unitNoun(productPack)}
                  </p>
                )}
              </div>
            </div>
          </div>
        )
      })}

      {adding ? (
        <AddSupplierInPlace
          onCancel={() => setAdding(false)}
          onAdded={(vendor) => {
            onVendorAdded(vendor)
            setAdding(false)
            // Into the first card still waiting for a supplier, else a card of its own.
            const waiting = drafts.find((draft) => !draft.companyVendorId)
            onChange(
              waiting
                ? drafts.map((draft) => (draft.key === waiting.key ? { ...draft, companyVendorId: vendor.id } : draft))
                : [...drafts, newSupplierDraft(vendor.id, productPack)],
            )
          }}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onChange([...drafts, newSupplierDraft('', productPack)])}
            className="inline-flex h-10 items-center gap-1.5 rounded-md border border-dashed border-neutral-300 px-3 text-sm font-medium text-primary-700 hover:border-primary-400"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {drafts.length + (linked?.length ?? 0) === 0 ? 'Add a supplier' : 'Add another supplier'}
          </button>
          {canAddVendor && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-primary-700 hover:bg-primary-50"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              New supplier, not in the list
            </button>
          )}
        </div>
      )}
    </div>
  )
}
