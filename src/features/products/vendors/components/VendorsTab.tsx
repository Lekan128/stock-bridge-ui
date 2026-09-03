import { Fragment, useState } from 'react'
import { ChevronRight, Plus, Store, Tag, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/Skeleton'
import { useToast } from '@/components/useToast'
import { productVendorsApi } from '@/features/products/api/productVendorsApi'
import { formatCurrency } from '@/features/products/formatters'
import { useProductVendors } from '@/features/products/hooks/useProductVendors'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import type { Product } from '@/features/products/types'
import {
  UNIT_COPY,
  formatPackCostEcho,
  formatPricePer,
  formatQuantity,
  formatQuantityInUnit,
} from '@/features/products/unitCopy'
import {
  buildPackOption,
  fromBaseQuantity,
  stockUnitLabel,
  supplierPack,
  unitOptionsForProduct,
  unitOptionsForSupplier,
} from '@/features/products/unitSet'
import { AddPriceTierModal } from '@/features/products/vendors/components/AddPriceTierModal'
import type { ProductVendor, ProductVendorPriceTier } from '@/features/products/vendors/types'
import { VendorKindBadge } from '@/features/vendors/components/VendorKindBadge'
import { isAppError } from '@/types/api'

export interface VendorsTabProps {
  product: Product
  /** Whether the signed-in user may edit anything here (preferred toggle, price breaks). A
   *  read-only viewer still sees the full table — this only gates the interactive affordances,
   *  mirroring how `ProductDetailPage` gates Stock In/Out/Adjust on the same permission. */
  canManage: boolean
}

/**
 * Product detail → Vendors tab. Design spec §7.4.
 *
 * One row per `ProductVendor`. The two rules easiest to get wrong, both handled here:
 *  - Preferred is a SWAP, not a set — there is no control to turn it off, only to turn it on for
 *    a different vendor, which atomically un-sets whichever row held it before.
 *  - A deactivated supplier's row stays fully visible with all its data intact, just visually
 *    de-emphasised (muted name, "Deactivated" badge) — never hidden.
 *
 * <h2>Every number on this tab now states its unit and its basis</h2>
 * None of them did. `UNIT_UX_REMEDIATION_PLAN.md` §2 lists this tab as the surface with no
 * vocabulary at all — "Their SKU", "Last cost", "Qty on hand", every one of them unitless, with a
 * per-pack price sitting directly beside a base-unit quantity and nothing distinguishing them.
 * Three changes, all from `UNIT_UX_CONTRACT.md`:
 *
 *  - §1's locked names: **Supplier**, **Supplier's code**, **Last cost**, **On hand from them**.
 *    A user imports "Supplier" in a spreadsheet and used to land on a "Vendors" tab reading
 *    "Their SKU"; three names for two things is two names too many. The CODE still says vendor
 *    (`ProductVendor`, `companyVendorId`) — §1 locks the user-facing string, not the identifier.
 *  - §7.2: every price says what it is per. `lastCostPrice` and every tier's `unitPrice` are
 *    stored per stock unit (§3.2), so the pack figure a supplier actually quotes is DERIVED for
 *    display and the stored per-stock-unit figure is printed under it. Both, always, when the
 *    supplier has a pack — that pair is what makes two suppliers with different pack sizes
 *    comparable, which is the entire premise of the preferred-supplier decision this tab exists
 *    to support. Odoo's vendor pricelist tab and NetSuite's item-record vendor sublist both print
 *    the purchase-unit price and the base-unit conversion on the same line for this reason.
 *  - §7.5: quantities carry their unit — "1,000 kg", with "(20 bags)" beside it where a pack
 *    makes the second reading useful.
 */
export function VendorsTab({ product, canManage }: VendorsTabProps) {
  const { data: vendors, setData, loading, error, refetch } = useProductVendors(product.id)
  const { options: unitOfMeasureOptions } = useUnitOfMeasureOptions()
  const { showToast } = useToast()

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [preferredPendingId, setPreferredPendingId] = useState<string | null>(null)
  const [addingTierFor, setAddingTierFor] = useState<ProductVendor | null>(null)
  const [deletingTier, setDeletingTier] = useState<{ vendor: ProductVendor; tier: ProductVendorPriceTier } | null>(null)
  const [deletingTierBusy, setDeletingTierBusy] = useState(false)

  /**
   * Every stored figure on this tab — `lastCostPrice`, each tier's `minQuantity` and `unitPrice`,
   * `quantityOnHandFromVendor` — is expressed in the PRODUCT's stock unit, not in any one
   * supplier's pack (contract §3.2). So the label is resolved once from the product's own unit
   * set and reused, and each supplier's pack is derived separately, per row, only to render the
   * second, friendlier reading of the same number.
   */
  const stockUnit = stockUnitLabel(unitOptionsForProduct(product, unitOfMeasureOptions))

  function toggleExpanded(vendorId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(vendorId)) next.delete(vendorId)
      else next.add(vendorId)
      return next
    })
  }

  /**
   * The swap. Optimistic: every row flips locally the instant this is clicked (so the UI never
   * looks like two vendors are preferred at once, even for the round trip), then reconciled
   * against whatever the server actually returns — and rolled all the way back on failure rather
   * than left half-applied.
   */
  async function handleSetPreferred(vendor: ProductVendor) {
    if (vendor.isPreferred || !vendor.companyVendorActive || preferredPendingId) return
    const previous = vendors
    setData((current) => current.map((v) => ({ ...v, isPreferred: v.id === vendor.id })))
    setPreferredPendingId(vendor.id)
    try {
      const updated = await productVendorsApi.update(product.id, vendor.id, { isPreferred: true })
      setData((current) => current.map((v) => (v.id === updated.id ? updated : { ...v, isPreferred: false })))
      showToast(`${vendor.companyVendorName} is now the preferred ${UNIT_COPY.SUPPLIER.toLowerCase()}.`, 'success')
    } catch (err) {
      setData(previous)
      showToast(
        isAppError(err) ? err.message : `Could not update the preferred ${UNIT_COPY.SUPPLIER.toLowerCase()}.`,
        'error',
      )
    } finally {
      setPreferredPendingId(null)
    }
  }

  function handleTierAdded(vendor: ProductVendor, tier: ProductVendorPriceTier) {
    setData((current) =>
      current.map((v) =>
        v.id === vendor.id
          ? { ...v, priceTiers: [...v.priceTiers, tier].sort((a, b) => a.minQuantity - b.minQuantity) }
          : v,
      ),
    )
    setAddingTierFor(null)
    setExpandedIds((prev) => new Set(prev).add(vendor.id))
    showToast('Price break added.', 'success')
  }

  async function handleDeleteTier() {
    if (!deletingTier) return
    const { vendor, tier } = deletingTier
    setDeletingTierBusy(true)
    try {
      await productVendorsApi.deletePriceTier(product.id, vendor.id, tier.id)
      setData((current) =>
        current.map((v) => (v.id === vendor.id ? { ...v, priceTiers: v.priceTiers.filter((t) => t.id !== tier.id) } : v)),
      )
      showToast('Price break removed.', 'success')
      setDeletingTier(null)
    } catch (err) {
      showToast(isAppError(err) ? err.message : 'Could not remove that price break.', 'error')
    } finally {
      setDeletingTierBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    )
  }

  if (error) {
    return <ErrorState title={`Could not load ${UNIT_COPY.SUPPLIERS.toLowerCase()}`} message={error} onRetry={refetch} />
  }

  if (vendors.length === 0) {
    return (
      <EmptyState
        icon={Store}
        title={`No ${UNIT_COPY.SUPPLIERS.toLowerCase()} linked yet`}
        description={`${UNIT_COPY.SUPPLIERS} show up here once you record a stock-in with one attached, or link one from the product's edit page — each with their own cost, pack and quantity breaks, without ever needing a second product row.`}
      />
    )
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs text-neutral-500 uppercase">
            <tr>
              <th className="w-10 px-2 py-2.5" />
              <th className="px-4 py-2.5 font-medium">{UNIT_COPY.SUPPLIER}</th>
              <th className="px-4 py-2.5 font-medium">{UNIT_COPY.SUPPLIER_CODE}</th>
              <th className="px-4 py-2.5 font-medium">{UNIT_COPY.LAST_COST}</th>
              <th className="px-4 py-2.5 font-medium">{UNIT_COPY.ON_HAND_FROM_THEM}</th>
              <th className="px-4 py-2.5 font-medium">{UNIT_COPY.PREFERRED}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {vendors.map((vendor) => {
              const expanded = expandedIds.has(vendor.id)
              const cheapestTierPrice =
                vendor.priceTiers.length > 0 ? Math.min(...vendor.priceTiers.map((t) => t.unitPrice)) : null

              /**
               * THIS supplier's own pack, built straight from their `defaultPackagingUnit`/
               * `defaultPackagingSize` rather than pulled out of the merged unit set.
               *
               * The merged set deduplicates by code (contract §2.1), so a supplier delivering a
               * 25 kg bag against a product whose own pack is a 50 kg bag would collapse into the
               * product's entry and this column would quote their price against the wrong size.
               * For a per-supplier figure only their own configuration is correct. `null` when
               * they have no pack — then there is one reading of the price, not two.
               */
              const packOption = buildPackOption(supplierPack(vendor), stockUnit, unitOfMeasureOptions)
              // Stored per stock unit either way (§3.2). The cheapest tier supersedes the flat
              // rate for display when the supplier has tiers, as it always has — see "from ₦X".
              const headlinePrice = cheapestTierPrice ?? vendor.lastCostPrice
              // §9.2's per-pack restatement of that stored figure — null for a supplier with no
              // pack, which is the case there is only one reading of the price to give.
              const headlinePackEcho = formatPackCostEcho(headlinePrice, packOption)

              return (
                <Fragment key={vendor.id}>
                  <tr className={vendor.companyVendorActive ? '' : 'bg-neutral-50'}>
                    <td className="px-2 py-3">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(vendor.id)}
                        aria-expanded={expanded}
                        aria-controls={`vendor-tiers-${vendor.id}`}
                        aria-label={expanded ? 'Hide price breaks' : 'Show price breaks'}
                        className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                      >
                        <ChevronRight
                          className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
                          aria-hidden="true"
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/app/vendors/${vendor.companyVendorId}`}
                          className={`font-medium hover:underline ${
                            vendor.companyVendorActive ? 'text-neutral-900 hover:text-primary-700' : 'text-neutral-500'
                          }`}
                        >
                          {vendor.companyVendorName}
                        </Link>
                        <VendorKindBadge kind={vendor.companyVendorKind} />
                        {!vendor.companyVendorActive && (
                          <Badge
                            variant="neutral"
                            title={`This ${UNIT_COPY.SUPPLIER.toLowerCase()} has been removed from your ${UNIT_COPY.SUPPLIER.toLowerCase()} directory. Its history here stays intact.`}
                          >
                            Deactivated
                          </Badge>
                        )}
                        {vendor.priceTiers.length > 0 && (
                          <span className="text-xs text-neutral-500">{vendor.priceTiers.length} price break{vendor.priceTiers.length === 1 ? '' : 's'}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-neutral-700">
                      {vendor.vendorSku || <span className="text-neutral-400">—</span>}
                    </td>
                    {/* Last cost — the stored per-stock-unit price on top, the pack price a
                        buyer would recognise echoed under it. Two lines, both visible, neither on
                        a `title`: hiding either behind a hover puts a number a decision depends on
                        somewhere a decision cannot be made.

                        THE TWO LINES SWAPPED. This column used to lead with the pack figure and
                        echo the stock-unit one. `UNIT_UX_CONTRACT.md` §9.2 settles the order the
                        other way: the stock-unit price is the stored, comparable figure — the
                        whole reason the contract anchors cost there rather than to the pack the
                        way Odoo and NetSuite do — and the pack price is the restatement that pays
                        down the divide-by-eighty §9.2 admits that choice costs. Leading with the
                        restatement made the comparable number the small grey one, and put this
                        column in the opposite order from the "On hand from them" column two cells
                        along, which has always led with the ledger's figure. */}
                    <td className="px-4 py-3">
                      {headlinePrice == null ? (
                        <span className="text-neutral-400">{formatCurrency(null)}</span>
                      ) : (
                        <>
                          <span className="font-medium text-neutral-900">
                            {cheapestTierPrice != null && 'from '}
                            {formatPricePer(headlinePrice, stockUnit)}
                          </span>
                          {headlinePackEcho && (
                            <span className="mt-0.5 block text-xs text-neutral-500">{headlinePackEcho}</span>
                          )}
                        </>
                      )}
                    </td>
                    {/* On hand from them — always in the product's stock unit, because that is
                        what the server stores. The pack reading follows in parentheses where it
                        exists: "1,000 kg (20 bags)" is the contract §6.3 shape, and the order
                        matters — the ledger's figure first, the human's second. */}
                    <td className="px-4 py-3 text-neutral-700">
                      {formatQuantity(vendor.quantityOnHandFromVendor, stockUnit)}
                      {packOption && vendor.quantityOnHandFromVendor > 0 && (
                        <span className="ml-1 text-xs text-neutral-500">
                          ({formatQuantityInUnit(fromBaseQuantity(vendor.quantityOnHandFromVendor, packOption), packOption)})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {canManage ? (
                        <button
                          type="button"
                          aria-pressed={vendor.isPreferred}
                          disabled={
                            vendor.isPreferred || !vendor.companyVendorActive || preferredPendingId === vendor.id
                          }
                          onClick={() => void handleSetPreferred(vendor)}
                          title={
                            vendor.isPreferred
                              ? `Preferred ${UNIT_COPY.SUPPLIER.toLowerCase()} — defaults into stock-in for this product`
                              : !vendor.companyVendorActive
                                ? `Deactivated ${UNIT_COPY.SUPPLIERS.toLowerCase()} can't be made preferred`
                                : `Make this the preferred ${UNIT_COPY.SUPPLIER.toLowerCase()}`
                          }
                          className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed ${
                            vendor.isPreferred
                              ? 'border-primary-200 bg-primary-50 text-primary-700'
                              : 'border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300 hover:text-neutral-700 disabled:opacity-60 disabled:hover:border-neutral-200 disabled:hover:text-neutral-500'
                          }`}
                        >
                          {vendor.isPreferred ? UNIT_COPY.PREFERRED : 'Make preferred'}
                        </button>
                      ) : vendor.isPreferred ? (
                        <Badge variant="info">{UNIT_COPY.PREFERRED}</Badge>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                  </tr>
                  {expanded && (
                    <tr id={`vendor-tiers-${vendor.id}`}>
                      <td colSpan={6} className="border-t border-neutral-100 bg-neutral-50 px-4 py-4">
                        {/* Price breaks are genuinely optional — most vendors have zero — so this
                            gets the "optional content" card treatment (a bounded white panel
                            popping out of the row's neutral-50 background) rather than sitting
                            inline with no boundary, making it unambiguous that this is expand-to-
                            reveal detail, not more of the always-visible table above it. */}
                        <div className="rounded-lg border border-neutral-200 bg-white p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Tag className="h-4 w-4 shrink-0 text-accent-600" aria-hidden="true" />
                              <h3 className="text-sm font-semibold text-neutral-900">Price breaks</h3>
                            </div>
                            {canManage && (
                              <Button variant="secondary" onClick={() => setAddingTierFor(vendor)}>
                                <Plus className="h-4 w-4" aria-hidden="true" />
                                Add price break
                              </Button>
                            )}
                          </div>

                          {vendor.priceTiers.length === 0 ? (
                            <p className="mt-2 text-sm text-neutral-500">
                              No price breaks for this {UNIT_COPY.SUPPLIER.toLowerCase()} yet — they charge a flat
                              rate regardless of quantity.
                            </p>
                          ) : (
                            <div className="mt-3 overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="text-left text-xs text-neutral-500 uppercase">
                                  <tr>
                                    <th className="py-1.5 pr-4 font-medium">From</th>
                                    <th className="py-1.5 pr-4 font-medium">Price</th>
                                    <th className="py-1.5" />
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-200">
                                  {/* Both columns were unitless, and the price column was worse
                                      than unitless: `minQuantity` was stored in stock units while
                                      `unitPrice` arrived per pack, so a row literally meant "at
                                      500 kg, ₦44,000 per bag" (plan §3's P0-2). Both halves are
                                      stored per stock unit now, and both are rendered in both
                                      readings so the row can be checked against a supplier's own
                                      quote without arithmetic. */}
                                  {vendor.priceTiers.map((tier) => (
                                    <tr key={tier.id}>
                                      <td className="py-1.5 pr-4 text-neutral-700">
                                        {formatQuantity(tier.minQuantity, stockUnit)}+
                                        {packOption && (
                                          <span className="ml-1 text-xs text-neutral-500">
                                            ({formatQuantityInUnit(fromBaseQuantity(tier.minQuantity, packOption), packOption)}+)
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-1.5 pr-4">
                                        <span className="font-medium text-neutral-900">
                                          {formatPricePer(tier.unitPrice, stockUnit)}
                                        </span>
                                        {formatPackCostEcho(tier.unitPrice, packOption) && (
                                          <span className="mt-0.5 block text-xs text-neutral-500">
                                            {formatPackCostEcho(tier.unitPrice, packOption)}
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-1.5 text-right align-top">
                                        {canManage && (
                                          <button
                                            type="button"
                                            onClick={() => setDeletingTier({ vendor, tier })}
                                            aria-label={`Remove the price break starting at ${formatQuantity(tier.minQuantity, stockUnit)}`}
                                            className="rounded-md p-1 text-neutral-400 hover:bg-danger-50 hover:text-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {addingTierFor && (
        <AddPriceTierModal
          productId={product.id}
          vendor={addingTierFor}
          // The supplier-scoped unit set (contract §2.3): the product's stock unit, its own pack,
          // this supplier's pack, and the same-category base units. The modal picks which of them
          // the two fields are entered in and converts BOTH on save — it used to convert the
          // quantity and not the price.
          unitOptions={unitOptionsForSupplier(product, addingTierFor, unitOfMeasureOptions)}
          stockUnit={stockUnit}
          onClose={() => setAddingTierFor(null)}
          onSuccess={(tier) => handleTierAdded(addingTierFor, tier)}
        />
      )}

      <ConfirmDialog
        open={!!deletingTier}
        title="Remove price break"
        message={
          deletingTier
            ? `Remove the ${formatQuantity(deletingTier.tier.minQuantity, stockUnit)}+ price break for ${deletingTier.vendor.companyVendorName}? Their cost will fall back to their flat rate.`
            : ''
        }
        confirmLabel="Remove"
        loading={deletingTierBusy}
        onConfirm={() => void handleDeleteTier()}
        onCancel={() => setDeletingTier(null)}
      />
    </>
  )
}
