import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ClipboardList, PackageSearch, Search } from 'lucide-react'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { Button, buttonClassName } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/Skeleton'
import { TextField } from '@/components/TextField'
import { useToast } from '@/components/useToast'
import { expectedApi } from '@/features/expected/api/expectedApi'
import { expectedCopy } from '@/features/expected/copy'
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
import type { DeliveryLine } from '@/features/imports/types'
import { useVendorOptions } from '@/features/vendors/hooks/useVendorOptions'
import { isAppError } from '@/types/api'

const SELECT_CLASS =
  'w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-base text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none disabled:bg-neutral-50 sm:text-sm'

const LIST_PATH = '/app/products/expected'

/**
 * "Say what you ordered" (`BULK_IMPORT_CX_PLAN.md` task 3.1).
 *
 * Deliberately the same screen as *Record a delivery*, with a different verb: supplier, date and
 * reference once at the top, then that supplier's products with a quantity box per way each is
 * bought, and one button at the bottom that says how many lines it will save and what they come
 * to. The picker, the arithmetic and the price row are literally the same code — a second way to
 * choose a product and a unit is how the two screens would start disagreeing about what a bag is.
 *
 * Three differences, all of them deliberate:
 *  - **The date may be in the past.** Overdue is a real state and the reason this list exists;
 *    refusing a date somebody has already missed would refuse the truth.
 *  - **The date may be missing.** Plenty of suppliers never say when.
 *  - **Nothing moves.** No stock is recorded here and none is promised — this is a note about a
 *    promise somebody made on the phone, and it only touches the ledger when the goods turn up
 *    and go through the ordinary delivery screen.
 */
export function NewExpectedDeliveryPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const permissions = user?.type === 'tenant' ? user.permissions : []
  const canSeeSuppliers = permissions.includes(PERMISSIONS.VIEW_VENDORS)
  const { vendors } = useVendorOptions(canSeeSuppliers)

  const [vendorId, setVendorId] = useState('')
  /** "+ Something not on this list" — every product, while the supplier stays on the order. */
  const [showAll, setShowAll] = useState(false)
  const [expectedDate, setExpectedDate] = useState('')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [search, setSearch] = useState('')
  const [entries, setEntries] = useState<Record<string, DeliveryEntry>>({})

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const filter = vendorId && !showAll ? 'BY_VENDOR' : 'ALL'
  const { lines, loading, error, refetch } = useDeliveryLines(filter, vendorId || undefined)
  const supplierName = vendors.find((vendor) => vendor.id === vendorId)?.name

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

  const count = totals.lines.length
  // With a line priced nowhere, the sum would understate the order, so the button leaves it out.
  const totalText = count > 0 && !totals.partial ? formatPrice(totals.total) : null
  const canSubmit = count > 0 && !totals.invalid && !submitting

  function handleLineChange(line: DeliveryLine, patch: Partial<Omit<DeliveryEntry, 'line'>>) {
    const key = lineKey(line)
    setEntries((prev) => {
      const current = prev[key] ?? { quantity: '', price: '', editingPrice: false }
      return { ...prev, [key]: { ...current, line, ...patch } }
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
    try {
      await expectedApi.create({
        vendorId: vendorId || undefined,
        expectedDate: expectedDate || undefined,
        reference: reference.trim() || undefined,
        note: note.trim() || undefined,
        lines: totals.lines,
      })
      showToast(expectedCopy.create.done, 'success')
      navigate(LIST_PATH, { replace: true })
    } catch (err: unknown) {
      setSubmitError(isAppError(err) ? err.message : expectedCopy.create.failed)
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">{expectedCopy.create.title}</h1>
          <p className="mt-1 text-sm text-neutral-600">{expectedCopy.create.subtitle}</p>
          <Link
            to={LIST_PATH}
            className="mt-2 inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            {expectedCopy.create.back}
          </Link>
        </div>

        <section className="grid gap-4 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-2">
          {canSeeSuppliers && (
            <div className="sm:col-span-2">
              <label htmlFor="expected-supplier" className="mb-1.5 block text-sm font-medium text-neutral-700">
                {expectedCopy.create.supplier}
              </label>
              <select
                id="expected-supplier"
                value={vendorId}
                disabled={submitting}
                aria-describedby="expected-supplier-hint"
                onChange={(event) => handleSupplierChange(event.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">{expectedCopy.create.supplierAny}</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </select>
              <p id="expected-supplier-hint" className="mt-1.5 text-xs text-neutral-500">
                {expectedCopy.create.supplierHint}
              </p>
            </div>
          )}
          {/*
            No `max` and no validation: a date in the past is exactly what an overdue order is,
            and the list is built to show it.
          */}
          <TextField
            id="expected-date"
            type="date"
            label={expectedCopy.create.date}
            hint={expectedCopy.create.dateHint}
            value={expectedDate}
            disabled={submitting}
            onChange={(event) => setExpectedDate(event.target.value)}
          />
          <TextField
            id="expected-reference"
            label={expectedCopy.create.reference}
            hint={expectedCopy.create.referenceHint}
            value={reference}
            maxLength={200}
            disabled={submitting}
            onChange={(event) => setReference(event.target.value)}
          />
          <div className="sm:col-span-2">
            <label htmlFor="expected-note" className="mb-1.5 block text-sm font-medium text-neutral-700">
              {expectedCopy.create.note}
            </label>
            <textarea
              id="expected-note"
              rows={2}
              value={note}
              maxLength={500}
              disabled={submitting}
              aria-describedby="expected-note-hint"
              onChange={(event) => setNote(event.target.value)}
              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none disabled:bg-neutral-50 sm:text-sm"
            />
            <p id="expected-note-hint" className="mt-1.5 text-xs text-neutral-500">
              {expectedCopy.create.noteHint}
            </p>
          </div>
        </section>

        <section aria-labelledby="expected-lines-heading" className="flex flex-col gap-3">
          <h2 id="expected-lines-heading" className="text-sm font-semibold text-neutral-900">
            {expectedCopy.create.linesHeading}
          </h2>

          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400"
              aria-hidden="true"
            />
            <label htmlFor="expected-search" className="sr-only">
              {copy.delivery.search}
            </label>
            <input
              id="expected-search"
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
              title={copy.delivery.supplierEmpty(supplierName ?? expectedCopy.create.supplier)}
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
                      return (
                        <DeliveryLineRow
                          key={key}
                          line={line}
                          entry={entries[key]}
                          quantityLabel={expectedCopy.create.quantityLabel(line.productName, line.comesIn)}
                          onChange={handleLineChange}
                        />
                      )
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
            {expectedCopy.create.totalAnnounce(count, totalText)}
          </p>
          <Button className="w-full" disabled={!canSubmit} loading={submitting} onClick={() => void handleSubmit()}>
            {submitting
              ? expectedCopy.create.saving
              : count === 0
                ? expectedCopy.create.submitEmpty
                : expectedCopy.create.submit(count, totalText)}
          </Button>
          {count > 0 && totals.partial && (
            <p className="text-center text-xs text-neutral-500">{expectedCopy.create.totalPartial}</p>
          )}
        </div>
      </div>
    </div>
  )
}
