import { useEffect, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { Spinner } from '@/components/Spinner'
import { TextField } from '@/components/TextField'
import { superAdminApiClient } from '@/features/admin/api/superAdminApi'
import { catalogResetPhraseFor } from '@/features/admin/types'
import type { CatalogResetPreview, SuperAdminClientDetail } from '@/features/admin/types'
import { isAppError } from '@/types/api'

export interface ResetCatalogModalProps {
  client: SuperAdminClientDetail
  onClose: () => void
  onSuccess: (result: CatalogResetPreview) => void
}

/**
 * Clears a tenant's catalog so they can onboard again after a bad upload.
 *
 * The dialog is built around the dry run rather than a confirmation sentence, because the
 * numbers are the only thing that distinguishes "this client uploaded 500 junk rows last
 * Tuesday" from "this client has been trading for a year". It re-fetches whenever the options
 * change, so the counts on screen always describe the request the button will actually send.
 *
 * Typing the slug is not theatre: the same check runs on the server (see CatalogResetRequest),
 * and this field is how an ops user proves they read which tenant they are pointed at. It is
 * the only destructive super-admin action that cannot be reversed by clicking the opposite
 * button afterwards.
 */
export function ResetCatalogModal({ client, onClose, onSuccess }: ResetCatalogModalProps) {
  const [includeVendorDirectory, setIncludeVendorDirectory] = useState(false)
  const [resetSkuCounters, setResetSkuCounters] = useState(true)
  const [preview, setPreview] = useState<CatalogResetPreview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(true)
  const [typedPhrase, setTypedPhrase] = useState('')
  const [acknowledgedEstablished, setAcknowledgedEstablished] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoadingPreview(true)
    superAdminApiClient
      .previewCatalogReset(client.id, { includeVendorDirectory, resetSkuCounters })
      .then((result) => {
        if (!cancelled) setPreview(result)
      })
      .catch((err) => {
        if (!cancelled) setError(isAppError(err) ? err.message : 'Could not load what this reset would clear.')
      })
      .finally(() => {
        if (!cancelled) setLoadingPreview(false)
      })
    return () => {
      cancelled = true
    }
  }, [client.id, includeVendorDirectory, resetSkuCounters])

  async function handleConfirm() {
    setSubmitting(true)
    setError(null)
    try {
      const result = await superAdminApiClient.resetCatalog(client.id, {
        confirmPhrase: typedPhrase.trim(),
        acknowledgeEstablished: acknowledgedEstablished,
        includeVendorDirectory,
        resetSkuCounters,
      })
      onSuccess(result)
    } catch (err) {
      // The blocked 409 replaces the panel rather than becoming a toast — the ops user needs
      // the list of ordered products, which is the whole reason superAdminApi re-throws that
      // body intact instead of letting the interceptor flatten it.
      const blocked = (err as { catalogResetBlocked?: CatalogResetPreview }).catalogResetBlocked
      if (blocked) {
        setPreview(blocked)
      } else {
        setError(isAppError(err) ? err.message : 'The reset could not be completed.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const requiredPhrase = catalogResetPhraseFor(client.slug)
  // A 409 for an established customer is still an offer, not a dead end: the panel keeps its
  // acknowledge checkbox so the caller can say yes and retry. Only ORDERED_PRODUCTS is final.
  const blocked = preview?.blockedReason === 'ORDERED_PRODUCTS'
  const established = preview?.activity.established ?? false
  const confirmed = typedPhrase.trim().replace(/\s+/g, ' ').toLowerCase() === requiredPhrase
  const acknowledgedIfNeeded = !established || acknowledgedEstablished
  const nothingToClear = !!preview && preview.counts.products === 0 && preview.counts.importSessions === 0

  return (
    <Modal
      open
      onClose={onClose}
      title="Clear catalog and start again"
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={submitting}
            disabled={!confirmed || !acknowledgedIfNeeded || blocked || loadingPreview || nothingToClear}
            onClick={() => void handleConfirm()}
          >
            Clear catalog permanently
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-neutral-600">
          Deletes everything <span className="font-medium text-neutral-900">{client.name}</span> has added to their
          catalog, so they can upload from scratch. Their account, users, roles and settings are untouched — they keep
          the same login.
        </p>

        {loadingPreview && (
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <Spinner /> Checking what this would clear…
          </div>
        )}

        {preview && !loadingPreview && (
          <>
            <div
              className={`rounded-md border p-3 text-sm ${
                blocked ? 'border-danger-200 bg-danger-50 text-danger-800' : 'border-neutral-200 bg-neutral-50'
              }`}
            >
              <div className="flex items-start gap-2">
                {blocked && <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />}
                <p>{preview.message}</p>
              </div>
            </div>

            {blocked ? (
              <ul className="flex flex-col gap-1 text-sm text-neutral-700">
                {preview.blockers.map((blocker) => (
                  <li key={blocker.productId} className="flex justify-between gap-3 border-b border-neutral-100 py-1">
                    <span>
                      {blocker.productName} <span className="text-neutral-400">({blocker.sku})</span>
                    </span>
                    <span className="shrink-0 text-neutral-500">
                      {blocker.orderLines} order {blocker.orderLines === 1 ? 'line' : 'lines'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                  <Count label="Products" value={preview.counts.products} />
                  <Count label="Stock movements" value={preview.counts.stockMovements} />
                  <Count label="Supplier links" value={preview.counts.productVendors} />
                  <Count label="Upload records" value={preview.counts.importSessions} />
                  {includeVendorDirectory && <Count label="Suppliers" value={preview.counts.companyVendors} />}
                  {resetSkuCounters && <Count label="SKU counters" value={preview.counts.skuCounters} />}
                </dl>

                {(preview.counts.foreignCartLines > 0 ||
                  preview.counts.orderLinksCleared > 0 ||
                  preview.counts.derivedProductLinksCleared > 0) && (
                  <div className="rounded-md border border-warning-200 bg-warning-50 p-3 text-sm text-warning-900">
                    <p className="font-medium">This also reaches outside this tenant:</p>
                    <ul className="mt-1 list-inside list-disc">
                      {preview.counts.foreignCartLines > 0 && (
                        <li>{preview.counts.foreignCartLines} cart lines in other tenants' carts will disappear.</li>
                      )}
                      {preview.counts.orderLinksCleared > 0 && (
                        <li>
                          {preview.counts.orderLinksCleared} past order lines will lose their link back to this
                          inventory. The orders themselves are kept.
                        </li>
                      )}
                      {preview.counts.derivedProductLinksCleared > 0 && (
                        <li>
                          {preview.counts.derivedProductLinksCleared} products in other tenants will lose their link to
                          this tenant's listing.
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {established && (
                  <div className="rounded-md border border-danger-200 bg-danger-50 p-3 text-sm text-danger-900">
                    <div className="flex items-start gap-2">
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="font-medium">This does not look like a new customer.</p>
                        <p className="mt-1">
                          {preview.activity.receivedOrders > 0 && (
                            <>
                              They have taken delivery of {preview.activity.receivedOrders}{' '}
                              {preview.activity.receivedOrders === 1 ? 'order' : 'orders'}.{' '}
                            </>
                          )}
                          {preview.activity.firstActivityAt && (
                            <>
                              They have been moving stock for {preview.activity.daysActive} days, since{' '}
                              {new Date(preview.activity.firstActivityAt).toLocaleDateString()}.
                            </>
                          )}
                        </p>
                        <label className="mt-2 flex items-start gap-2 font-medium">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={acknowledgedEstablished}
                            onChange={(e) => setAcknowledgedEstablished(e.target.checked)}
                          />
                          I have checked with this customer and still want to delete their data.
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={includeVendorDirectory}
                      onChange={(e) => setIncludeVendorDirectory(e.target.checked)}
                    />
                    Also clear the suppliers they added
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={resetSkuCounters}
                      onChange={(e) => setResetSkuCounters(e.target.checked)}
                    />
                    Reset auto-generated SKU numbering back to the start
                  </label>
                </div>

                <TextField
                  label={`Type "${requiredPhrase}" to confirm`}
                  name="confirmPhrase"
                  value={typedPhrase}
                  autoComplete="off"
                  placeholder={requiredPhrase}
                  onChange={(e) => setTypedPhrase(e.target.value)}
                  hint="This cannot be undone. There is no restore."
                />
              </>
            )}
          </>
        )}

        {error && <p className="text-sm text-danger-600">{error}</p>}
      </div>
    </Modal>
  )
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="text-base font-semibold text-neutral-900">{value.toLocaleString()}</dd>
    </div>
  )
}
