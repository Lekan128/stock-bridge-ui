import { useState } from 'react'
import { Building2, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { AddressCard } from '@/components/AddressCard'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ErrorState } from '@/components/ErrorState'
import { useToast } from '@/components/useToast'
import { addressesApi } from '@/features/addresses/api/addressesApi'
import { AddressFormModal } from '@/features/addresses/components/AddressFormModal'
import { AddressListSkeleton } from '@/features/addresses/components/AddressListSkeleton'
import { EmptyAddressesState } from '@/features/addresses/components/EmptyAddressesState'
import { useAddresses } from '@/features/addresses/hooks/useAddresses'
import type { DeliveryAddress } from '@/features/addresses/types'
import { isAppError } from '@/types/api'

/** `undefined` = closed; `null` = open on a new address; an address = open for editing. */
type FormTarget = DeliveryAddress | null | undefined

/**
 * The company's delivery address book — `/app/addresses`.
 *
 * Read access is wider than write access (checkout and order detail both read the list), so the
 * page renders for anyone who can see it and hides the mutating controls behind
 * `MANAGE_DELIVERY_ADDRESSES` rather than blocking the whole route.
 */
export function AddressListPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const { addresses, setAddresses, loading, error, refetch } = useAddresses()
  const [formTarget, setFormTarget] = useState<FormTarget>(undefined)
  const [deleteTarget, setDeleteTarget] = useState<DeliveryAddress | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null)

  const canManage = user?.type === 'tenant' && user.permissions.includes(PERMISSIONS.MANAGE_DELIVERY_ADDRESSES)

  function handleSaved(saved: DeliveryAddress) {
    setFormTarget(undefined)
    showToast(saved.isDefault ? `${saved.label} saved and set as your default.` : `${saved.label} saved.`, 'success')
    // A save can move the default flag between rows, so the whole list is re-read rather than
    // patched — two addresses both showing "Default" is worse than a brief spinner.
    refetch()
  }

  async function handleMakeDefault(address: DeliveryAddress) {
    setSettingDefaultId(address.id)
    const previous = addresses
    // Optimistic: the swap is transactional server-side and never partially applies, so the only
    // real risk is a network failure — which rolls straight back below.
    setAddresses((current) => current.map((item) => ({ ...item, isDefault: item.id === address.id })))
    try {
      await addressesApi.makeDefault(address.id)
      showToast(`${address.label} is now your default delivery address.`, 'success')
    } catch (err: unknown) {
      setAddresses(previous)
      showToast(isAppError(err) ? err.message : 'Could not change your default address.', 'error')
    } finally {
      setSettingDefaultId(null)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await addressesApi.remove(deleteTarget.id)
      showToast(`${deleteTarget.label} removed.`, 'success')
      setDeleteTarget(null)
      refetch()
    } catch (err: unknown) {
      showToast(isAppError(err) ? err.message : 'Could not remove this address.', 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Delivery addresses</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            Where ProcurePal delivers your orders. Your default is offered first at checkout.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setFormTarget(null)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add address
          </Button>
        )}
      </div>

      {loading && <AddressListSkeleton />}

      {!loading && error && <ErrorState title="Could not load your addresses" message={error} onRetry={refetch} />}

      {!loading && !error && addresses.length === 0 && (
        <EmptyAddressesState canManage={canManage} onAdd={() => setFormTarget(null)} />
      )}

      {!loading && !error && addresses.length > 0 && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {addresses.map((address) => (
            <div
              key={address.id}
              // The default is what checkout preselects, so it is marked structurally (a tinted
              // rail) as well as with a badge — a lone badge in a grid of six is easy to scan past.
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
          onClose={() => setFormTarget(undefined)}
          onSaved={handleSaved}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove this address?"
        message={
          deleteTarget?.isDefault
            ? `${deleteTarget.label} is your default delivery address. Removing it means you will have to pick another address at your next checkout. Past orders keep the address they were delivered to.`
            : `${deleteTarget?.label ?? 'This address'} will no longer be offered at checkout. Past orders keep the address they were delivered to.`
        }
        confirmLabel="Remove"
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
