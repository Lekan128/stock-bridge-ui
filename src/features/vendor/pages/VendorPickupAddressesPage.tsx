import { useState } from 'react'
import { Building2, Pencil, Plus, Star, Trash2, Truck } from 'lucide-react'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { AddressCard } from '@/components/AddressCard'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { useToast } from '@/components/useToast'
import { AddressFormModal } from '@/features/addresses/components/AddressFormModal'
import { AddressListSkeleton } from '@/features/addresses/components/AddressListSkeleton'
import type { DeliveryAddress } from '@/features/addresses/types'
import { vendorPickupAddressesApi } from '@/features/vendor/api/vendorPickupAddressesApi'
import { usePickupAddresses } from '@/features/vendor/hooks/usePickupAddresses'
import { isAppError } from '@/types/api'

/** `undefined` = closed; `null` = open on a new address; an address = open for editing. */
type FormTarget = DeliveryAddress | null | undefined

/**
 * A seller's pickup points — `/app/selling/pickup-addresses`.
 *
 * The mirror of `AddressListPage`, and deliberately the same shape: the same card, the same
 * form, the same one-default rule. What differs is the direction goods move, which is why the
 * copy on this page says "collected from" everywhere the buyer page says "delivered to". A
 * seller reading "delivery address" on a screen about collection will eventually put the wrong
 * place in it.
 *
 * They are not the same rows. The server keeps both in one table behind an `address_purpose`
 * discriminator it sets from the ROUTE, so this screen and `/app/addresses` can never show each
 * other's entries — which matters for ProcurePal, which is a seller AND a buying company and so
 * legitimately has both under one tenant.
 */
export function VendorPickupAddressesPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const { addresses, setAddresses, loading, error, refetch } = usePickupAddresses()
  const [formTarget, setFormTarget] = useState<FormTarget>(undefined)
  const [deleteTarget, setDeleteTarget] = useState<DeliveryAddress | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null)

  const canManage = user?.type === 'tenant' && user.permissions.includes(PERMISSIONS.MANAGE_DELIVERY_ADDRESSES)

  function handleSaved(saved: DeliveryAddress) {
    setFormTarget(undefined)
    showToast(
      saved.isDefault ? `${saved.label} saved and set as your default pickup point.` : `${saved.label} saved.`,
      'success',
    )
    // A save can move the default flag between rows, so the whole list is re-read rather than
    // patched — two addresses both showing "Default" is worse than a brief spinner.
    refetch()
  }

  async function handleMakeDefault(address: DeliveryAddress) {
    setSettingDefaultId(address.id)
    const previous = addresses
    // Optimistic: the swap is transactional server-side and never partially applies, so the
    // only real risk is a network failure — which rolls straight back below.
    setAddresses((current) => current.map((item) => ({ ...item, isDefault: item.id === address.id })))
    try {
      await vendorPickupAddressesApi.makeDefault(address.id)
      showToast(`${address.label} is now your default pickup address.`, 'success')
    } catch (err: unknown) {
      setAddresses(previous)
      showToast(isAppError(err) ? err.message : 'Could not change your default pickup address.', 'error')
    } finally {
      setSettingDefaultId(null)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await vendorPickupAddressesApi.remove(deleteTarget.id)
      showToast(`${deleteTarget.label} removed.`, 'success')
      setDeleteTarget(null)
      refetch()
    } catch (err: unknown) {
      showToast(isAppError(err) ? err.message : 'Could not remove this pickup address.', 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Pickup addresses</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            Where your goods are collected from. Your default is the one used for new orders.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setFormTarget(null)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add pickup address
          </Button>
        )}
      </div>

      {loading && <AddressListSkeleton />}

      {!loading && error && (
        <ErrorState title="Could not load your pickup addresses" message={error} onRetry={refetch} />
      )}

      {!loading && !error && addresses.length === 0 && (
        <EmptyState
          icon={Truck}
          title="No pickup addresses yet"
          description="Add the place your goods are collected from, so orders can be picked up without a phone call."
          action={
            canManage ? (
              <Button onClick={() => setFormTarget(null)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add pickup address
              </Button>
            ) : undefined
          }
        />
      )}

      {!loading && !error && addresses.length > 0 && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {addresses.map((address) => (
            <div
              key={address.id}
              // The default is the one orders are collected from, so it is marked structurally
              // (a tinted rail) as well as with a badge — a lone badge in a grid of six is easy
              // to scan past.
              className={`overflow-hidden rounded-lg bg-white ${
                address.isDefault ? 'border-l-4 border-l-primary-600' : ''
              }`}
            >
              <AddressCard
                address={address}
                className={address.isDefault ? 'rounded-l-none border-l-0' : ''}
                actions={
                  canManage ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setFormTarget(address)}
                        aria-label={`Edit ${address.label}`}
                        className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(address)}
                        aria-label={`Remove ${address.label}`}
                        className="rounded-md p-1.5 text-neutral-400 hover:bg-danger-50 hover:text-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  ) : undefined
                }
              />
              {(address.branchName || (canManage && !address.isDefault)) && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-neutral-100 px-4 py-2.5 text-xs text-neutral-500">
                  {address.branchName && (
                    <span className="inline-flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-neutral-400" aria-hidden="true" />
                      {address.branchName}
                    </span>
                  )}
                  {canManage && !address.isDefault && (
                    <button
                      type="button"
                      onClick={() => void handleMakeDefault(address)}
                      disabled={settingDefaultId === address.id}
                      className="inline-flex items-center gap-1.5 font-medium text-primary-600 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Star className="h-3.5 w-3.5" aria-hidden="true" />
                      Make default
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {formTarget !== undefined && (
        <AddressFormModal
          address={formTarget ?? undefined}
          isFirstAddress={addresses.length === 0}
          variant="pickup"
          api={vendorPickupAddressesApi}
          onClose={() => setFormTarget(undefined)}
          onSaved={handleSaved}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove this pickup address?"
        message={
          deleteTarget?.isDefault
            ? `${deleteTarget.label} is your default pickup point. Removing it means another address becomes the default. Past orders keep the address they were collected from.`
            : `${deleteTarget?.label ?? 'This address'} will no longer be offered for collections. Past orders keep the address they were collected from.`
        }
        confirmLabel="Remove"
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
