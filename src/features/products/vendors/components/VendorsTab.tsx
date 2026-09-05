import { Fragment, useState } from 'react'
import { ChevronRight, Package, Plus, Store, Tag, Trash2 } from 'lucide-react'
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
import { buildPackOption, fromBaseQuantity, stockUnitLabel, unitOptionsForProduct } from '@/features/products/unitSet'
import { AddPackModal } from '@/features/products/vendors/components/AddPackModal'
import { AddPriceTierModal } from '@/features/products/vendors/components/AddPriceTierModal'
import type { ProductVendor, ProductVendorPack, ProductVendorPriceTier } from '@/features/products/vendors/types'
import { VendorKindBadge } from '@/features/vendors/components/VendorKindBadge'
import { isAppError } from '@/types/api'

export interface VendorsTabProps {
  product: Product
  /** Whether the signed-in user may edit anything here (preferred toggle, packs, price breaks). A
   *  read-only viewer still sees the full table — this only gates the interactive affordances,
   *  mirroring how `ProductDetailPage` gates Stock In/Out/Adjust on the same permission. */
  canManage: boolean
}

/**
 * Product detail → Vendors tab. Design spec §7.4, extended by MULTI_PACK_PER_VENDOR_DESIGN.md
 * §7.1 with one more expandable level: vendor → packs → each pack's price breaks.
 *
 * One row per `ProductVendor`, expanding to that vendor's packs. Before V24 a vendor had exactly
 * one pack and this row expanded straight to its price breaks; a vendor can now have more than
 * one (the same rice arriving from the same supplier in both 25 kg and 50 kg bags), so packs sit
 * between the vendor and its tiers. Most vendors still have exactly one pack, so this reads as a
 * no-op-looking extra level for the common case and only earns its keep once a second pack exists
 * — the same progressive-disclosure posture this whole feature already commits to.
 *
 * Three rules easiest to get wrong, all handled here:
 *  - Preferred is a SWAP, not a set — there is no control to turn it off, only to turn it on for
 *    a different vendor, which atomically un-sets whichever row held it before.
 *  - A pack's own "Default" status is the identical swap one level down — see `AddPackModal` and
 *    `productVendorsApi.updatePack`.
 *  - A deactivated supplier's row stays fully visible with all its data intact, just visually
 *    de-emphasised (muted name, "Deactivated" badge) — never hidden.
 *
 * <h2>The collapsed row reads `vendor.packs` directly, not the alias fields</h2>
 * `ProductVendorResponse` keeps `vendorSku`/`lastCostPrice`/`defaultPackagingUnit`/
 * `defaultPackagingSize` as a permanent alias mirroring whichever pack has `isDefault: true`
 * (MULTI_PACK_PER_VENDOR_DESIGN.md §4.2) — convenient for code that has not been updated, but this
 * component has, so it derives the same figures from `vendor.packs.find(p => p.isDefault)`
 * instead. That keeps exactly one source of truth once a pack is added, edited or removed here.
 *
 * <h2>Every number on this tab states its unit and its basis</h2>
 * `UNIT_UX_REMEDIATION_PLAN.md` §2 lists this tab as the surface with no vocabulary at all —
 * "Their SKU", "Last cost", "Qty on hand", every one of them unitless, with a per-pack price
 * sitting directly beside a base-unit quantity and nothing distinguishing them. Three changes,
 * all from `UNIT_UX_CONTRACT.md`:
 *
 *  - §1's locked names: **Supplier**, **Supplier's code**, **Last cost**, **On hand from them**.
 *  - §7.2: every price says what it is per. `lastCostPrice` and every tier's `unitPrice` are
 *    stored per stock unit (§3.2), so the pack figure a supplier actually quotes is DERIVED for
 *    display and the stored per-stock-unit figure is printed under it.
 *  - §7.5: quantities carry their unit — "1,000 kg", with "(20 bags)" beside it where a pack
 *    makes the second reading useful.
 */
export function VendorsTab({ product, canManage }: VendorsTabProps) {
  const { data: vendors, setData, loading, error, refetch } = useProductVendors(product.id)
  const { options: unitOfMeasureOptions } = useUnitOfMeasureOptions()
  const { showToast } = useToast()

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [expandedPackIds, setExpandedPackIds] = useState<Set<string>>(new Set())
  const [preferredPendingId, setPreferredPendingId] = useState<string | null>(null)
  const [addingPackFor, setAddingPackFor] = useState<ProductVendor | null>(null)
  const [addingTierFor, setAddingTierFor] = useState<{ vendor: ProductVendor; pack: ProductVendorPack } | null>(null)
  const [deletingPack, setDeletingPack] = useState<{ vendor: ProductVendor; pack: ProductVendorPack } | null>(null)
  const [deletingPackBusy, setDeletingPackBusy] = useState(false)
  const [deletingTier, setDeletingTier] = useState<{
    vendor: ProductVendor
    pack: ProductVendorPack
    tier: ProductVendorPriceTier
  } | null>(null)
  const [deletingTierBusy, setDeletingTierBusy] = useState(false)

  /**
   * Every stored figure on this tab — a pack's `lastCostPrice`, each tier's `minQuantity` and
   * `unitPrice`, `quantityOnHandFromVendor` — is expressed in the PRODUCT's stock unit, not in any
   * one pack (contract §3.2). So the label is resolved once from the product's own unit set and
   * reused, and each pack's own container is derived separately, per row, only to render the
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

  function togglePackExpanded(packId: string) {
    setExpandedPackIds((prev) => {
      const next = new Set(prev)
      if (next.has(packId)) next.delete(packId)
      else next.add(packId)
      return next
    })
  }

  function updateVendor(vendorId: string, updater: (vendor: ProductVendor) => ProductVendor) {
    setData((current) => current.map((v) => (v.id === vendorId ? updater(v) : v)))
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

  function handlePackAdded(vendor: ProductVendor, pack: ProductVendorPack) {
    updateVendor(vendor.id, (v) => ({ ...v, packs: [...v.packs, pack] }))
    setAddingPackFor(null)
    setExpandedIds((prev) => new Set(prev).add(vendor.id))
    showToast('Pack added.', 'success')
  }

  async function handleDeletePack() {
    if (!deletingPack) return
    const { vendor, pack } = deletingPack
    setDeletingPackBusy(true)
    try {
      await productVendorsApi.deletePack(product.id, vendor.id, pack.id)
      updateVendor(vendor.id, (v) => ({ ...v, packs: v.packs.filter((p) => p.id !== pack.id) }))
      showToast('Pack removed.', 'success')
      setDeletingPack(null)
    } catch (err) {
      showToast(isAppError(err) ? err.message : 'Could not remove that pack.', 'error')
    } finally {
      setDeletingPackBusy(false)
    }
  }

  function handleTierAdded(vendor: ProductVendor, pack: ProductVendorPack, tier: ProductVendorPriceTier) {
    updateVendor(vendor.id, (v) => ({
      ...v,
      packs: v.packs.map((p) =>
        p.id === pack.id ? { ...p, priceTiers: [...p.priceTiers, tier].sort((a, b) => a.minQuantity - b.minQuantity) } : p,
      ),
    }))
    setAddingTierFor(null)
    setExpandedPackIds((prev) => new Set(prev).add(pack.id))
    showToast('Price break added.', 'success')
  }

  async function handleDeleteTier() {
    if (!deletingTier) return
    const { vendor, pack, tier } = deletingTier
    setDeletingTierBusy(true)
    try {
      await productVendorsApi.deletePriceTier(product.id, vendor.id, pack.id, tier.id)
      updateVendor(vendor.id, (v) => ({
        ...v,
        packs: v.packs.map((p) => (p.id === pack.id ? { ...p, priceTiers: p.priceTiers.filter((t) => t.id !== tier.id) } : p)),
      }))
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
        description={`${UNIT_COPY.SUPPLIERS} show up here once you record a stock-in with one attached, or link one from the product's edit page — each with their own packs, cost and quantity breaks, without ever needing a second product row.`}
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
              const defaultPack = vendor.packs.find((p) => p.isDefault) ?? null
              const cheapestTierPrice =
                defaultPack && defaultPack.priceTiers.length > 0
                  ? Math.min(...defaultPack.priceTiers.map((t) => t.unitPrice))
                  : null

              /**
               * THIS vendor's DEFAULT pack, built straight from it rather than pulled out of the
               * merged unit set — the merged set deduplicates by `(code, size)` now, but a
               * per-vendor summary column still wants exactly one figure, and the default pack is
               * the one the collapsed row exists to summarise. `null` when they have no pack —
               * then there is one reading of the price, not two.
               */
              const packOption = buildPackOption(defaultPack, stockUnit, unitOfMeasureOptions)
              const headlinePrice = cheapestTierPrice ?? defaultPack?.lastCostPrice ?? null
              const headlinePackEcho = formatPackCostEcho(headlinePrice, packOption)

              return (
                <Fragment key={vendor.id}>
                  <tr className={vendor.companyVendorActive ? '' : 'bg-neutral-50'}>
                    <td className="px-2 py-3">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(vendor.id)}
                        aria-expanded={expanded}
                        aria-controls={`vendor-packs-${vendor.id}`}
                        aria-label={expanded ? 'Hide packs' : 'Show packs'}
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
                        {vendor.packs.length > 1 && (
                          <span className="text-xs text-neutral-500">{vendor.packs.length} packs</span>
                        )}
                        {vendor.packs.length <= 1 && defaultPack && defaultPack.priceTiers.length > 0 && (
                          <span className="text-xs text-neutral-500">
                            {defaultPack.priceTiers.length} price break{defaultPack.priceTiers.length === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-neutral-700">
                      {defaultPack?.vendorSku || <span className="text-neutral-400">—</span>}
                    </td>
                    {/* Last cost — the stored per-stock-unit price on top, the pack price a
                        buyer would recognise echoed under it. Two lines, both visible, neither on
                        a `title`: hiding either behind a hover puts a number a decision depends on
                        somewhere a decision cannot be made. */}
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
                        exists: "1,000 kg (20 bags)" is the contract §6.3 shape. */}
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
                    <tr id={`vendor-packs-${vendor.id}`}>
                      <td colSpan={6} className="border-t border-neutral-100 bg-neutral-50 px-4 py-4">
                        {/* Packs are the expand-to-reveal detail now; most vendors have exactly
                            one, so this panel is a near no-op for the common case and only earns
                            its keep once a second pack exists. */}
                        <div className="rounded-lg border border-neutral-200 bg-white p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 shrink-0 text-accent-600" aria-hidden="true" />
                              <h3 className="text-sm font-semibold text-neutral-900">Packs</h3>
                            </div>
                            {canManage && (
                              <Button variant="secondary" onClick={() => setAddingPackFor(vendor)}>
                                <Plus className="h-4 w-4" aria-hidden="true" />
                                Add pack
                              </Button>
                            )}
                          </div>

                          {vendor.packs.length === 0 ? (
                            <p className="mt-2 text-sm text-neutral-500">
                              No packs on file for this {UNIT_COPY.SUPPLIER.toLowerCase()} yet — record a stock-in from
                              them, or add one directly.
                            </p>
                          ) : (
                            <div className="mt-3 flex flex-col gap-2">
                              {vendor.packs.map((pack) => {
                                const packExpanded = expandedPackIds.has(pack.id)
                                const thisPackOption = buildPackOption(pack, stockUnit, unitOfMeasureOptions)
                                const cheapestPackTier =
                                  pack.priceTiers.length > 0 ? Math.min(...pack.priceTiers.map((t) => t.unitPrice)) : null
                                const packHeadline = cheapestPackTier ?? pack.lastCostPrice

                                return (
                                  <div key={pack.id} className="rounded-lg border border-neutral-200 bg-neutral-50">
                                    <button
                                      type="button"
                                      onClick={() => togglePackExpanded(pack.id)}
                                      aria-expanded={packExpanded}
                                      aria-controls={`pack-tiers-${pack.id}`}
                                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-neutral-100"
                                    >
                                      <ChevronRight
                                        className={`h-3.5 w-3.5 shrink-0 text-neutral-400 transition-transform ${packExpanded ? 'rotate-90' : ''}`}
                                        aria-hidden="true"
                                      />
                                      <span className="flex-1">
                                        <span className="font-medium text-neutral-900">{pack.label}</span>
                                        {pack.vendorSku && (
                                          <span className="ml-2 text-xs text-neutral-500">code {pack.vendorSku}</span>
                                        )}
                                      </span>
                                      {packHeadline != null && (
                                        <span className="text-sm text-neutral-700">
                                          {cheapestPackTier != null && 'from '}
                                          {formatPricePer(packHeadline, stockUnit)}
                                          {thisPackOption && (
                                            <span className="ml-1 text-xs text-neutral-500">
                                              ({formatPackCostEcho(packHeadline, thisPackOption)})
                                            </span>
                                          )}
                                        </span>
                                      )}
                                      {pack.isDefault ? (
                                        <Badge variant="info">Default</Badge>
                                      ) : (
                                        <span className="rounded-full border border-neutral-200 px-2 py-0.5 text-[11px] text-neutral-500">
                                          Alt
                                        </span>
                                      )}
                                      {canManage && !pack.isDefault && (
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setDeletingPack({ vendor, pack })
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                              e.stopPropagation()
                                              setDeletingPack({ vendor, pack })
                                            }
                                          }}
                                          aria-label={`Remove ${pack.label}`}
                                          className="rounded-md p-1 text-neutral-400 hover:bg-danger-50 hover:text-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                        </span>
                                      )}
                                    </button>

                                    {packExpanded && (
                                      <div id={`pack-tiers-${pack.id}`} className="border-t border-neutral-200 bg-white p-3">
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-2">
                                            <Tag className="h-3.5 w-3.5 shrink-0 text-accent-600" aria-hidden="true" />
                                            <h4 className="text-xs font-semibold text-neutral-700 uppercase">Price breaks</h4>
                                          </div>
                                          {canManage && (
                                            <Button variant="secondary" onClick={() => setAddingTierFor({ vendor, pack })}>
                                              <Plus className="h-4 w-4" aria-hidden="true" />
                                              Add price break
                                            </Button>
                                          )}
                                        </div>

                                        {pack.priceTiers.length === 0 ? (
                                          <p className="mt-2 text-sm text-neutral-500">
                                            No price breaks on this pack — a flat rate applies regardless of quantity.
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
                                                {pack.priceTiers.map((tier) => (
                                                  <tr key={tier.id}>
                                                    <td className="py-1.5 pr-4 text-neutral-700">
                                                      {formatQuantity(tier.minQuantity, stockUnit)}+
                                                      {thisPackOption && (
                                                        <span className="ml-1 text-xs text-neutral-500">
                                                          ({formatQuantityInUnit(fromBaseQuantity(tier.minQuantity, thisPackOption), thisPackOption)}+)
                                                        </span>
                                                      )}
                                                    </td>
                                                    <td className="py-1.5 pr-4">
                                                      <span className="font-medium text-neutral-900">
                                                        {formatPricePer(tier.unitPrice, stockUnit)}
                                                      </span>
                                                      {formatPackCostEcho(tier.unitPrice, thisPackOption) && (
                                                        <span className="mt-0.5 block text-xs text-neutral-500">
                                                          {formatPackCostEcho(tier.unitPrice, thisPackOption)}
                                                        </span>
                                                      )}
                                                    </td>
                                                    <td className="py-1.5 text-right align-top">
                                                      {canManage && (
                                                        <button
                                                          type="button"
                                                          onClick={() => setDeletingTier({ vendor, pack, tier })}
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
                                    )}
                                  </div>
                                )
                              })}
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

      {addingPackFor && (
        <AddPackModal
          productId={product.id}
          vendor={addingPackFor}
          stockUnit={stockUnit}
          onClose={() => setAddingPackFor(null)}
          onSuccess={(pack) => handlePackAdded(addingPackFor, pack)}
        />
      )}

      {addingTierFor && (
        <AddPriceTierModal
          productId={product.id}
          vendor={addingTierFor.vendor}
          pack={addingTierFor.pack}
          // The supplier-scoped unit set (contract §2.3): the product's stock unit, its own pack,
          // every one of this supplier's packs, and the same-category base units. The modal picks
          // which of them the two fields are entered in and converts BOTH on save.
          unitOptions={
            addingTierFor.vendor.unitOptions ??
            unitOptionsForProduct(product, unitOfMeasureOptions)
          }
          stockUnit={stockUnit}
          onClose={() => setAddingTierFor(null)}
          onSuccess={(tier) => handleTierAdded(addingTierFor.vendor, addingTierFor.pack, tier)}
        />
      )}

      <ConfirmDialog
        open={!!deletingPack}
        title="Remove pack"
        message={
          deletingPack
            ? `Remove "${deletingPack.pack.label}" from ${deletingPack.vendor.companyVendorName}? Its price breaks go with it.`
            : ''
        }
        confirmLabel="Remove"
        loading={deletingPackBusy}
        onConfirm={() => void handleDeletePack()}
        onCancel={() => setDeletingPack(null)}
      />

      <ConfirmDialog
        open={!!deletingTier}
        title="Remove price break"
        message={
          deletingTier
            ? `Remove the ${formatQuantity(deletingTier.tier.minQuantity, stockUnit)}+ price break on ${deletingTier.pack.label} for ${deletingTier.vendor.companyVendorName}? Their cost will fall back to that pack's flat rate.`
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
