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
import type { Product, UnitOfMeasureOption } from '@/features/products/types'
import { AddPriceTierModal } from '@/features/products/vendors/components/AddPriceTierModal'
import type { ProductVendor, ProductVendorPriceTier } from '@/features/products/vendors/types'
import { VendorKindBadge } from '@/features/vendors/components/VendorKindBadge'
import { isAppError } from '@/types/api'

/**
 * Which unit a price-break form for this vendor should be entered in, and the factor to multiply
 * by to reach the product's base unit on save — per §5.1a, `minQuantity` is always persisted in
 * base units regardless of what the vendor's packaging looks like. A vendor with no configured
 * packaging is already in base units, so `conversionFactor` is `1` and nothing is converted.
 */
function resolveTierUnit(vendor: ProductVendor, baseUnitLabel: string, unitOfMeasureOptions: UnitOfMeasureOption[]) {
  if (!vendor.defaultPackagingUnit || vendor.defaultPackagingSize == null) {
    return { unitLabel: baseUnitLabel, conversionFactor: 1 }
  }
  const packagingLabel = unitOfMeasureOptions.find((option) => option.code === vendor.defaultPackagingUnit)?.label
  return { unitLabel: packagingLabel ?? vendor.defaultPackagingUnit, conversionFactor: vendor.defaultPackagingSize }
}

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
 *  - A deactivated vendor's row stays fully visible with all its data intact, just visually
 *    de-emphasised (muted name, "Deactivated" badge) — never hidden.
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

  const baseUnitLabel = unitOfMeasureOptions.find((option) => option.code === product.unitOfMeasure)?.label ?? 'units'

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
      showToast(`${vendor.companyVendorName} is now the preferred vendor.`, 'success')
    } catch (err) {
      setData(previous)
      showToast(isAppError(err) ? err.message : 'Could not update the preferred vendor.', 'error')
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
    return <ErrorState title="Could not load vendors" message={error} onRetry={refetch} />
  }

  if (vendors.length === 0) {
    return (
      <EmptyState
        icon={Store}
        title="No vendors linked yet"
        description="Vendors show up here once you record a stock-in with a supplier attached, or link one from the product's edit page — with their own cost, packaging and quantity breaks, without ever needing a second product row."
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
              <th className="px-4 py-2.5 font-medium">Vendor</th>
              <th className="px-4 py-2.5 font-medium">Their SKU</th>
              <th className="px-4 py-2.5 font-medium">Last cost</th>
              <th className="px-4 py-2.5 font-medium">Qty on hand</th>
              <th className="px-4 py-2.5 font-medium">Preferred</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {vendors.map((vendor) => {
              const expanded = expandedIds.has(vendor.id)
              const cheapestTierPrice =
                vendor.priceTiers.length > 0 ? Math.min(...vendor.priceTiers.map((t) => t.unitPrice)) : null

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
                          <Badge variant="neutral" title="This supplier has been removed from your vendor directory. Its history here stays intact.">
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
                    <td className="px-4 py-3">
                      {cheapestTierPrice !== null ? (
                        <span className="font-medium text-neutral-900">from {formatCurrency(cheapestTierPrice)}</span>
                      ) : (
                        <span className={vendor.lastCostPrice != null ? 'font-medium text-neutral-900' : 'text-neutral-400'}>
                          {formatCurrency(vendor.lastCostPrice)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">{vendor.quantityOnHandFromVendor}</td>
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
                              ? 'Preferred vendor — defaults into stock-in for this product'
                              : !vendor.companyVendorActive
                                ? "Deactivated vendors can't be made preferred"
                                : 'Make this the preferred vendor'
                          }
                          className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed ${
                            vendor.isPreferred
                              ? 'border-primary-200 bg-primary-50 text-primary-700'
                              : 'border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300 hover:text-neutral-700 disabled:opacity-60 disabled:hover:border-neutral-200 disabled:hover:text-neutral-500'
                          }`}
                        >
                          {vendor.isPreferred ? 'Preferred' : 'Make preferred'}
                        </button>
                      ) : vendor.isPreferred ? (
                        <Badge variant="info">Preferred</Badge>
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
                              No price breaks for this vendor yet — they charge a flat rate regardless of quantity.
                            </p>
                          ) : (
                            <div className="mt-3 overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="text-left text-xs text-neutral-500 uppercase">
                                  <tr>
                                    <th className="py-1.5 pr-4 font-medium">Min quantity</th>
                                    <th className="py-1.5 pr-4 font-medium">Unit price</th>
                                    <th className="py-1.5" />
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-200">
                                  {vendor.priceTiers.map((tier) => (
                                    <tr key={tier.id}>
                                      <td className="py-1.5 pr-4 text-neutral-700">
                                        {tier.minQuantity} {baseUnitLabel}+
                                      </td>
                                      <td className="py-1.5 pr-4 font-medium text-neutral-900">
                                        {formatCurrency(tier.unitPrice)}
                                      </td>
                                      <td className="py-1.5 text-right">
                                        {canManage && (
                                          <button
                                            type="button"
                                            onClick={() => setDeletingTier({ vendor, tier })}
                                            aria-label={`Remove price break at ${tier.minQuantity} ${baseUnitLabel}`}
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
          {...resolveTierUnit(addingTierFor, baseUnitLabel, unitOfMeasureOptions)}
          baseUnitLabel={baseUnitLabel}
          onClose={() => setAddingTierFor(null)}
          onSuccess={(tier) => handleTierAdded(addingTierFor, tier)}
        />
      )}

      <ConfirmDialog
        open={!!deletingTier}
        title="Remove price break"
        message={
          deletingTier
            ? `Remove the ${deletingTier.tier.minQuantity} ${baseUnitLabel}+ price break for ${deletingTier.vendor.companyVendorName}? This vendor's cost will fall back to their flat rate.`
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
