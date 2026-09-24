import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { FileSpreadsheet, PackageSearch, Search } from 'lucide-react'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { Button, buttonClassName } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/Skeleton'
import { TextField } from '@/components/TextField'
import { useToast } from '@/components/useToast'
import { ReceivingExpectedBanner } from '@/features/expected/components/ReceivingExpectedBanner'
import { outstandingEntries } from '@/features/expected/expected'
import { useExpectedDelivery } from '@/features/expected/hooks/useExpectedDelivery'
import { importsApi } from '@/features/imports/api/importsApi'
import { DeliveryConfirmDialog } from '@/features/imports/components/DeliveryConfirmDialog'
import { BarcodeScanField } from '@/features/imports/components/BarcodeScanField'
import { DeliveryLineRow } from '@/features/imports/components/DeliveryLineRow'
import { copy } from '@/features/imports/copy'
import {
  formatPrice,
  groupByProduct,
  lineKey,
  matchesSearch,
  tally,
  validQuantity,
  type DeliveryEntry,
} from '@/features/imports/delivery'
import { useDeliveryLines } from '@/features/imports/hooks/useDeliveryLines'
import type { CommitPreview, DeliveryLine, ImportSession } from '@/features/imports/types'
import { useVendorOptions } from '@/features/vendors/hooks/useVendorOptions'
import { isAppError } from '@/types/api'

const SELECT_CLASS =
  'w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-base text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none disabled:bg-neutral-50 sm:text-sm'

const SPREADSHEET_PATH = '/app/products/import/new?kind=STOCK_IN'

/** Today in the user's own timezone, as the `YYYY-MM-DD` a date input holds. */
function todayIso(): string {
  return new Date().toLocaleDateString('en-CA')
}

/** An import the server has built from the typed lines, waiting on the confirm dialog. */
interface PendingDelivery {
  session: ImportSession
  preview: CommitPreview
}

/**
 * "Record a delivery" (BULK_IMPORT_CX_PLAN.md task 2.1) — a small delivery without a spreadsheet.
 *
 * Built for a phone at the gate: supplier, date and invoice once at the top, then that supplier's
 * products with a quantity box per way each is bought, and one button at the bottom that always
 * says how many lines it will add and what they come to.
 *
 * Underneath it is the ordinary stock-in import (task 2.2): the typed lines are posted, the server
 * checks them exactly as it checks a sheet, and the same preview, commit and result screens take
 * over. So a line with an error goes to the full review, and anything recorded here can be undone
 * from the result page like any upload.
 *
 * <h2>`?expected=<id>` — receiving something that was written down first</h2>
 * Opened from an expected delivery (task 3.1) the screen is the same screen, filled in: the
 * supplier, the date and their reference come off the order, every line still owed opens with the
 * quantity owed and the price agreed, and a banner says which order is being received. The id
 * rides along on the request, so committing credits that order and closes it once every line is
 * met — and undoing the import takes the credit back. Nothing else about the screen changes, and
 * with no such parameter none of it happens at all.
 */
export function RecordDeliveryPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [searchParams] = useSearchParams()
  const expectedId = searchParams.get('expected')
  const permissions = user?.type === 'tenant' ? user.permissions : []
  const canSeeSuppliers = permissions.includes(PERMISSIONS.VIEW_VENDORS)
  const { vendors } = useVendorOptions(canSeeSuppliers)

  const [vendorId, setVendorId] = useState('')
  /** "+ Something not on this list" — every product, while the supplier stays on the delivery. */
  const [showAll, setShowAll] = useState(false)
  const [deliveryDate, setDeliveryDate] = useState(todayIso)
  const [invoiceNo, setInvoiceNo] = useState('')
  const [search, setSearch] = useState('')
  const [entries, setEntries] = useState<Record<string, DeliveryEntry>>({})

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingDelivery | null>(null)
  const [committing, setCommitting] = useState(false)
  const [commitError, setCommitError] = useState<string | null>(null)

  const filter = vendorId && !showAll ? 'BY_VENDOR' : 'ALL'
  const { lines, loading, error, refetch } = useDeliveryLines(filter, vendorId || undefined)
  const supplierName = vendors.find((vendor) => vendor.id === vendorId)?.name

  const {
    expected,
    loading: expectedLoading,
    error: expectedError,
  } = useExpectedDelivery(expectedId)

  /**
   * Fill the form in from the order being received, once.
   *
   * `expected` is set exactly once per id by the hook, so this runs once and never fights the
   * person typing. Anything already typed in the moment before the order arrived wins over the
   * pre-fill for the same reason — the two spreads are in that order deliberately.
   *
   * The date is deliberately NOT taken from the order. That date is when the delivery was DUE,
   * and this field is when it ARRIVED — which is today, since that is when somebody is standing
   * at the gate recording it. They differ exactly when the supplier was late, and filling in the
   * promised day then would backdate the stock movement by however long the delay was, quietly
   * changing which stock FIFO draws from and what it cost. The one case where the two agree is
   * the one where leaving it as today is already right.
   *
   * The supplier is filled in, and the list is opened to the whole catalog rather than to that
   * supplier's products: an order from Tony can contain a product whose usual supplier is Ada,
   * and filtering to Tony would leave that line typed but off-screen.
   */
  useEffect(() => {
    if (!expected) return
    if (expected.vendorId != null) setVendorId(expected.vendorId)
    if (expected.reference != null) setInvoiceNo(expected.reference)
    setShowAll(true)
    setEntries((prev) => ({ ...outstandingEntries(expected), ...prev }))
  }, [expected])

  const groups = useMemo(
    () => groupByProduct((lines ?? []).filter((line) => matchesSearch(line, search))),
    [lines, search],
  )
  const totals = useMemo(() => tally(entries), [entries])

  /** Typed quantities on lines the current list does not include — they are still sent. */
  const hiddenCount = useMemo(() => {
    const shown = new Set((lines ?? []).map(lineKey))
    return Object.entries(entries).filter(([key, entry]) => !shown.has(key) && validQuantity(entry) != null).length
  }, [lines, entries])

  const today = todayIso()
  const dateError =
    deliveryDate === '' ? copy.delivery.dateMissing : deliveryDate > today ? copy.delivery.dateFuture : undefined

  const count = totals.lines.length
  // With a line priced nowhere, the sum would understate the delivery, so the button leaves it out.
  const totalText = count > 0 && !totals.partial ? formatPrice(totals.total) : null
  const canSubmit = count > 0 && !totals.invalid && !dateError && !submitting

  function handleLineChange(line: DeliveryLine, patch: Partial<Omit<DeliveryEntry, 'line'>>) {
    const key = lineKey(line)
    setEntries((prev) => {
      const current = prev[key] ?? { quantity: '', price: '', editingPrice: false }
      return { ...prev, [key]: { ...current, line, ...patch } }
    })
  }

  /**
   * A scanned product's lines, made visible and ready to count.
   *
   * The scan does not type a quantity - how many arrived is the one thing the scanner cannot know
   * - so the line is seeded blank, which is enough to put it on screen under its product. The
   * list is opened to the whole catalog first, because the scanned box may well be from a
   * supplier other than the one filtering the list, and a row that was added but cannot be seen
   * is worse than no row at all.
   */
  function handleScanned(scanned: DeliveryLine[]) {
    if (scanned.length === 0) return
    setShowAll(true)
    setSearch('')
    setEntries((prev) => {
      const next = { ...prev }
      for (const line of scanned) {
        const key = lineKey(line)
        next[key] = next[key] ?? { line, quantity: '', price: '', editingPrice: false }
      }
      return next
    })
  }

  function handleSupplierChange(nextId: string) {
    setVendorId(nextId)
    setShowAll(false)
  }

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    setSubmitError(null)

    let session: ImportSession
    try {
      session = await importsApi.createDelivery({
        deliveryDate,
        invoiceNo: invoiceNo.trim() || undefined,
        vendorId: vendorId || undefined,
        // Carried through review and commit, so what actually went in is what gets credited
        // against the order — not what this screen pre-filled.
        expectedDeliveryId: expectedId ?? undefined,
        lines: totals.lines,
      })
    } catch (err: unknown) {
      setSubmitError(isAppError(err) ? err.message : copy.delivery.failed)
      setSubmitting(false)
      return
    }

    // A line the server cannot record needs the full review — it has the fixes a dialog does not.
    if (session.errorCount > 0) {
      navigate(`/app/products/import/${session.id}`)
      return
    }

    try {
      const preview = await importsApi.preview(session.id)
      setCommitError(null)
      setPending({ session, preview })
    } catch {
      // The lines are saved; posting them again would make a second copy. The review screen can
      // pick this one up where it stopped.
      showToast(copy.delivery.previewFailed, 'info')
      navigate(`/app/products/import/${session.id}`)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCommit() {
    if (!pending) return
    const { id } = pending.session
    setCommitting(true)
    setCommitError(null)
    try {
      const result = await importsApi.commit(id)
      showToast(copy.delivery.done, 'success')
      navigate(`/app/products/import/${id}/result`, { replace: true, state: { result } })
    } catch (err: unknown) {
      setCommitError(isAppError(err) ? err.message : copy.delivery.commitFailed)
      setCommitting(false)
    }
  }

  /**
   * "Not yet" throws the unconfirmed import away. The typed lines are still on screen, and the
   * next press builds a fresh one from whatever they say by then — leaving this one behind would
   * only put a stale entry in the recent imports list.
   */
  function handleCancel() {
    if (!pending) return
    void importsApi.discard(pending.session.id).catch(() => undefined)
    setPending(null)
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">{copy.delivery.title}</h1>
          <p className="mt-1 text-sm text-neutral-600">{copy.delivery.subtitle}</p>
          <Link
            to={SPREADSHEET_PATH}
            className="mt-2 inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
            {copy.delivery.useSheet}
          </Link>
        </div>

        {expectedId != null && (
          <ReceivingExpectedBanner expected={expected} loading={expectedLoading} error={expectedError} />
        )}

        <section className="grid gap-4 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-3">
          {canSeeSuppliers && (
            <div className="sm:col-span-3">
              <label htmlFor="delivery-supplier" className="mb-1.5 block text-sm font-medium text-neutral-700">
                {copy.delivery.supplier}
              </label>
              <select
                id="delivery-supplier"
                value={vendorId}
                disabled={submitting}
                onChange={(event) => handleSupplierChange(event.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">{copy.delivery.supplierAny}</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <TextField
            id="delivery-date"
            type="date"
            label={copy.delivery.date}
            value={deliveryDate}
            max={today}
            required
            disabled={submitting}
            error={dateError}
            onChange={(event) => setDeliveryDate(event.target.value)}
          />
          <div className="sm:col-span-2">
            <TextField
              id="delivery-invoice"
              label={copy.delivery.invoiceNo}
              hint={copy.delivery.invoiceHint}
              value={invoiceNo}
              maxLength={200}
              disabled={submitting}
              onChange={(event) => setInvoiceNo(event.target.value)}
            />
          </div>
        </section>

        <section aria-labelledby="delivery-lines-heading" className="flex flex-col gap-3">
          <h2 id="delivery-lines-heading" className="text-sm font-semibold text-neutral-900">
            {copy.delivery.linesHeading}
          </h2>

          {/* Task 3.3: scan the box and its row appears, already in the list below. */}
          <BarcodeScanField disabled={submitting} onFound={handleScanned} />

          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400"
              aria-hidden="true"
            />
            <label htmlFor="delivery-search" className="sr-only">
              {copy.delivery.search}
            </label>
            <input
              id="delivery-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={copy.delivery.searchPlaceholder}
              className="w-full rounded-md border border-neutral-200 bg-white py-2 pr-3 pl-9 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none sm:text-sm"
            />
          </div>

          {loading && (
            <div className="flex flex-col gap-3" aria-busy="true" aria-label={copy.common.loading}>
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} className="h-24 w-full" />
              ))}
            </div>
          )}

          {!loading && error && <ErrorState title={copy.delivery.loadFailed} message={error} onRetry={refetch} />}

          {!loading && !error && lines && lines.length === 0 && filter === 'BY_VENDOR' && (
            <EmptyState
              icon={PackageSearch}
              title={copy.delivery.supplierEmpty(supplierName ?? copy.delivery.supplier)}
              action={
                <Button variant="secondary" onClick={() => setShowAll(true)}>
                  {copy.delivery.supplierEmptyAction}
                </Button>
              }
            />
          )}

          {!loading && !error && lines && lines.length === 0 && filter === 'ALL' && (
            <EmptyState
              icon={PackageSearch}
              title={copy.delivery.noProductsTitle}
              description={copy.delivery.noProductsBody}
              action={
                <Link to="/app/products" className={buttonClassName('primary')}>
                  {copy.delivery.noProductsAction}
                </Link>
              }
            />
          )}

          {!loading && !error && lines && lines.length > 0 && groups.length === 0 && (
            <p className="rounded-lg border border-neutral-200 bg-white px-4 py-8 text-center text-sm text-neutral-500">
              {copy.delivery.noMatch(search.trim())}
            </p>
          )}

          {!loading && !error && groups.length > 0 && (
            <ul className="flex flex-col gap-3">
              {groups.map((group) => (
                <li key={group.productId} className="rounded-lg border border-neutral-200 bg-white px-4 pt-3">
                  <h3 className="text-sm font-semibold text-neutral-900">
                    {group.productName}
                    <span className="ml-2 text-xs font-normal text-neutral-500">{group.sku}</span>
                  </h3>
                  <ul className="divide-y divide-neutral-100">
                    {group.lines.map((line) => {
                      const key = lineKey(line)
                      return <DeliveryLineRow key={key} line={line} entry={entries[key]} onChange={handleLineChange} />
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}

          {!loading && hiddenCount > 0 && (
            <p className="flex flex-wrap items-center gap-x-2 text-sm text-neutral-600">
              {copy.delivery.hiddenTyped(hiddenCount)}
              {filter === 'BY_VENDOR' && (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="rounded-sm font-medium text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  {copy.delivery.showAll}
                </button>
              )}
            </p>
          )}

          <div className="flex flex-col items-start gap-2 text-sm">
            {filter === 'BY_VENDOR' && !loading && !error && lines && lines.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="rounded-sm font-medium text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                {copy.delivery.somethingElse}
              </button>
            )}
            <p className="text-neutral-600">
              {copy.delivery.notInCatalog}{' '}
              <Link
                to="/app/products"
                className="rounded-sm font-medium text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                {copy.delivery.notInCatalogLink}
              </Link>
            </p>
          </div>

          {submitError && <ErrorState variant="inline" message={submitError} />}
        </section>
      </div>

      {/*
        Sticky inside <main>, which is the scroll container and carries p-6: the negative offsets
        take the bar to its edges, and the bottom padding clears a phone's home indicator.
      */}
      <div className="sticky -bottom-6 z-10 -mx-6 mt-6 -mb-6 border-t border-neutral-200 bg-white/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-2xl flex-col gap-1">
          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {copy.delivery.totalAnnounce(count, totalText)}
          </p>
          <Button className="w-full" disabled={!canSubmit} loading={submitting} onClick={() => void handleSubmit()}>
            {submitting
              ? copy.delivery.saving
              : count === 0
                ? copy.delivery.submitEmpty
                : copy.delivery.submit(count, totalText)}
          </Button>
          {count > 0 && totals.partial && (
            <p className="text-center text-xs text-neutral-500">{copy.delivery.totalPartial}</p>
          )}
        </div>
      </div>

      <DeliveryConfirmDialog
        preview={pending?.preview ?? null}
        warningCount={pending?.session.warningCount ?? 0}
        committing={committing}
        error={commitError}
        onConfirm={() => void handleCommit()}
        onReview={() => pending && navigate(`/app/products/import/${pending.session.id}`)}
        onClose={handleCancel}
      />
    </div>
  )
}
