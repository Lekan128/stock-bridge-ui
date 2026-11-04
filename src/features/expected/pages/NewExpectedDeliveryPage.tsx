import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Check, ClipboardList, PackageSearch, Search } from 'lucide-react'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { Button, buttonClassName } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/Skeleton'
import { TextField } from '@/components/TextField'
import { useToast } from '@/components/useToast'
import { queryKeys } from '@/data/queryKeys'
import { useCompany } from '@/features/company/hooks/useCompany'
import { todayIso } from '@/features/expected/expected'
import { InlineEmailEditor } from '@/features/expected/components/InlineEmailEditor'
import { mayEditSupplier, SupplierContact } from '@/features/expected/components/SupplierContact'
import { Switch } from '@/components/Switch'
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
import { useOptionalWorkingBranch } from '@/features/branches/useWorkingBranch'
import { SupplierField } from '@/features/vendors/components/SupplierField'
import { useVendorOptions } from '@/features/vendors/hooks/useVendorOptions'
import type { CompanyVendor } from '@/features/vendors/types'
import { isAppError } from '@/types/api'

const LIST_PATH = '/app/purchase-orders'

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
 *
 * **Two modes, one page** (`PURCHASE_ORDER_PLAN.md`). The default is **New purchase order**: pick a
 * supplier, say what you want, and a numbered purchase order is made — a PDF, and something to send
 * the supplier — with no prices anywhere, because the supplier answers with the price. The link under
 * the title flips the same page, in place and without losing anything typed, to **Record what you
 * ordered**: the original "I ordered this by phone, write it down" screen, unchanged.
 */
export function NewExpectedDeliveryPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const permissions = user?.type === 'tenant' ? user.permissions : []
  const canSeeSuppliers = permissions.includes(PERMISSIONS.VIEW_VENDORS)
  const canManageSuppliers = permissions.includes(PERMISSIONS.MANAGE_VENDORS)
  const canEditCompany = permissions.includes(PERMISSIONS.MANAGE_COMPANY_PROFILE)
  const { vendors, upsert: addVendor } = useVendorOptions(canSeeSuppliers)
  const queryClient = useQueryClient()
  const { company } = useCompany()

  // A purchase order needs a supplier to be addressed to, so somebody who cannot see suppliers can
  // only record (the page is then exactly what it was before purchase orders).
  const [recordChosen, setRecordChosen] = useState(false)
  const recordOnly = recordChosen || !canSeeSuppliers
  const isOrder = !recordOnly
  const [emailOn, setEmailOn] = useState(false)
  // Where the supplier's email field is open — at the top beside their details, or at the bottom beside
  // the switch. One field, one place at a time.
  const [editingEmail, setEditingEmail] = useState<'top' | 'bottom' | null>(null)

  const [vendorId, setVendorId] = useState('')
  /** "+ Something not on this list" — every product, while the supplier stays on the order. */
  const [showAll, setShowAll] = useState(false)
  const [expectedDate, setExpectedDate] = useState('')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [search, setSearch] = useState('')
  const [entries, setEntries] = useState<Record<string, DeliveryEntry>>({})
  // "Going to" (MULTI_BRANCH_UX_PLAN.md §5.10): the branch it is for - this one by default, and the
  // delivery shows on that branch's Needs you only. Not asked at a one-branch company (rule 1).
  const branch = useOptionalWorkingBranch()
  const multiBranch = branch?.isMultiBranch ?? false
  const goingToOptions = multiBranch ? (branch?.recordable ?? []) : []
  // Worked out on each render rather than once: the branches may arrive after the screen opens.
  const defaultGoingTo =
    branch?.working && goingToOptions.some((option) => option.id === branch.working?.id)
      ? branch.working.id
      : goingToOptions.length === 1
        ? goingToOptions[0].id
        : ''
  const [pickedGoingTo, setGoingTo] = useState('')
  const goingTo = pickedGoingTo || defaultGoingTo
  // Somebody who records at no branch can't say where it is going, and the server would refuse it.
  const nowhereToRecord = multiBranch && !branch?.loading && goingToOptions.length === 0
  const needsGoingTo = multiBranch && !goingTo

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const filter = vendorId && !showAll ? 'BY_VENDOR' : 'ALL'
  const { lines, loading, error, refetch } = useDeliveryLines(filter, vendorId || undefined)
  // A purchase order is often the first thing a supplier is ever asked for, so nothing is linked to
  // them yet. Making somebody press "Show all products" to get to the list they obviously want is a
  // dead end with a button on it: show everything straight away, and say why.
  const supplierHasNoProducts = isOrder && filter === 'BY_VENDOR' && !loading && !error && lines != null && lines.length === 0
  const [everythingBecauseNoneLinked, setEverythingBecauseNoneLinked] = useState(false)
  useEffect(() => {
    if (supplierHasNoProducts) {
      setEverythingBecauseNoneLinked(true)
      setShowAll(true)
    }
  }, [supplierHasNoProducts])
  const vendor = vendors.find((entry) => entry.id === vendorId)
  const supplierName = vendor?.name
  const supplierEmail = vendor?.email?.trim() || ''
  const hasPhone = (vendor?.contactPhone ?? '').trim() !== ''
  const willEmail = isOrder && emailOn && supplierEmail !== ''

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
  // ISO dates compare as text. Only a purchase order refuses a past day.
  const neededInPast = isOrder && expectedDate !== '' && expectedDate < todayIso()
  const canSubmit =
    count > 0 &&
    !totals.invalid &&
    !submitting &&
    !needsGoingTo &&
    !neededInPast &&
    (!isOrder || vendorId !== '')

  function handleLineChange(line: DeliveryLine, patch: Partial<Omit<DeliveryEntry, 'line'>>) {
    const key = lineKey(line)
    setEntries((prev) => {
      const current = prev[key] ?? { quantity: '', price: '', editingPrice: false }
      return { ...prev, [key]: { ...current, line, ...patch } }
    })
  }

  /** A saved email is a new, untried address: the directory row updates and the switch asks again. */
  function handleVendorUpdated(updated: CompanyVendor) {
    addVendor(updated)
    setEmailOn(false)
  }

  function handleSupplierChange(nextId: string) {
    setVendorId(nextId)
    setShowAll(false)
    setEverythingBecauseNoneLinked(false)
    setEditingEmail(null)
    // "Email this order to Tony" starts on only for a supplier an email has already gone through to
    // (and whose address has not changed since) — otherwise off, always.
    const next = vendors.find((entry) => entry.id === nextId)
    setEmailOn(next?.emailOrders === true && (next.email ?? '').trim() !== '')
  }

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      if (isOrder) {
        // No prices: a purchase order says what is wanted, and the supplier answers with the price.
        const created = await expectedApi.create({
          purchaseOrder: true,
          emailRequested: willEmail,
          vendorId,
          ...(goingTo ? { branchId: goingTo } : {}),
          expectedDate: expectedDate || undefined,
          note: note.trim() || undefined,
          lines: totals.lines.map((line) => ({ productId: line.productId, unit: line.unit, quantity: line.quantity })),
        })
        // The supplier's "email starts on" and the list both changed on the server.
        void queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all })
        void queryClient.invalidateQueries({ queryKey: queryKeys.expected.all })
        // Straight to the order itself: that page says what was made and how to get it to the supplier.
        navigate(`${LIST_PATH}/${created.id}`, { replace: true, state: { justCreated: true } })
        return
      }
      await expectedApi.create({
        vendorId: vendorId || undefined,
        ...(goingTo ? { branchId: goingTo } : {}),
        expectedDate: expectedDate || undefined,
        reference: reference.trim() || undefined,
        note: note.trim() || undefined,
        lines: totals.lines,
      })
      showToast(expectedCopy.create.done, 'success')
      navigate(LIST_PATH, { replace: true })
    } catch (err: unknown) {
      setSubmitError(isAppError(err) ? err.message : isOrder ? expectedCopy.order.failed : expectedCopy.create.failed)
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">
            {isOrder ? expectedCopy.order.title : expectedCopy.create.title}
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            {isOrder ? expectedCopy.order.subtitle : expectedCopy.create.subtitle}
          </p>
          {canSeeSuppliers && (
            <button
              type="button"
              onClick={() => setRecordChosen(isOrder)}
              disabled={submitting}
              className="mt-2 block rounded-sm text-left text-sm font-medium text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
              {isOrder ? expectedCopy.order.recordLink : expectedCopy.create.makeOrderLink}
            </button>
          )}
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
              {/* `SupplierField` — "+ Add new supplier" opens a modal rather than navigating away,
                  so a half-built delivery (date, reference, lines already ticked) survives the
                  round trip. See `UX_CONSISTENCY_DESIGN_PLAN.md`, Pattern A. */}
              <SupplierField
                id="expected-supplier"
                label={expectedCopy.create.supplier}
                placeholderLabel={isOrder ? expectedCopy.order.supplierPlaceholder : expectedCopy.create.supplierAny}
                value={vendorId}
                disabled={submitting}
                onChange={handleSupplierChange}
                vendors={vendors}
                canCreate={canManageSuppliers}
                onCreated={addVendor}
                hint={vendor && isOrder ? undefined : isOrder ? expectedCopy.order.supplierHint : expectedCopy.create.supplierHint}
              />
              {isOrder && vendor && (
                <SupplierContact
                  vendor={vendor}
                  canEdit={canManageSuppliers}
                  editing={editingEmail === 'top'}
                  onEditingChange={(open) => setEditingEmail(open ? 'top' : null)}
                  onVendorUpdated={handleVendorUpdated}
                />
              )}
            </div>
          )}
          {nowhereToRecord && (
            <p role="alert" className="text-sm text-danger-700 sm:col-span-2">
              You don't record stock at any branch, so you can't say where this is going. Ask whoever manages your
              branches.
            </p>
          )}
          {goingToOptions.length > 0 && (
            <div className="sm:col-span-2">
              <label htmlFor="expected-going-to" className="mb-1.5 block text-sm font-medium text-neutral-700">
                Going to
              </label>
              <select
                id="expected-going-to"
                value={goingTo}
                disabled={submitting}
                onChange={(event) => setGoingTo(event.target.value)}
                className="h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm"
              >
                <option value="">Choose a branch</option>
                {goingToOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {/*
            No `max` and no validation: a date in the past is exactly what an overdue order is,
            and the list is built to show it.
          */}
          <TextField
            id="expected-date"
            type="date"
            label={isOrder ? expectedCopy.order.needed : expectedCopy.create.date}
            hint={isOrder ? expectedCopy.order.neededHint : expectedCopy.create.dateHint}
            value={expectedDate}
            disabled={submitting}
            // A purchase order asks for something still to come, so a day that has passed cannot be
            // picked — and one typed in by hand is refused below. (Recording what you ordered keeps
            // the old rule: a missed date is a real, overdue order.)
            min={isOrder ? todayIso() : undefined}
            error={neededInPast ? expectedCopy.order.neededInPast : undefined}
            onChange={(event) => setExpectedDate(event.target.value)}
          />
          {/* Their invoice or order number: it exists once they have answered, so a purchase order does
              not ask for it. */}
          {!isOrder && (
            <TextField
              id="expected-reference"
              label={expectedCopy.create.reference}
              hint={expectedCopy.create.referenceHint}
              value={reference}
              maxLength={200}
              disabled={submitting}
              onChange={(event) => setReference(event.target.value)}
            />
          )}
          <div className="sm:col-span-2">
            <label htmlFor="expected-note" className="mb-1.5 block text-sm font-medium text-neutral-700">
              {isOrder ? expectedCopy.order.note : expectedCopy.create.note}
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
              {isOrder ? expectedCopy.order.noteHint : expectedCopy.create.noteHint}
            </p>
          </div>
        </section>

        <section aria-labelledby="expected-lines-heading" className="flex flex-col gap-3">
          <h2 id="expected-lines-heading" className="text-sm font-semibold text-neutral-900">
            {isOrder ? expectedCopy.order.linesHeading : expectedCopy.create.linesHeading}
          </h2>

          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-500"
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
            <div role="status" className="flex flex-col gap-3" aria-busy="true" aria-label={copy.common.loading}>
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} className="h-24 w-full" />
              ))}
            </div>
          )}

          {!loading && error && <ErrorState title={copy.delivery.loadFailed} message={error} onRetry={refetch} />}

          {isOrder && everythingBecauseNoneLinked && showAll && vendor && (
            <p className="text-sm text-neutral-600">{expectedCopy.order.noneLinked(vendor.name)}</p>
          )}

          {!loading && !error && lines && lines.length === 0 && filter === 'BY_VENDOR' && !isOrder && (
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
                          quantityLabel={(isOrder ? expectedCopy.order : expectedCopy.create).quantityLabel(
                            line.productName,
                            line.comesIn,
                          )}
                          hidePrice={isOrder}
                          showUnitWord={isOrder}
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

        {isOrder && vendor && (
          <section aria-labelledby="po-happens-heading" className="flex flex-col gap-2 text-sm text-neutral-700">
            <h2 id="po-happens-heading" className="text-sm font-semibold text-neutral-900">
              {expectedCopy.order.happens.heading}
            </h2>
            <ul className="flex flex-col gap-1.5">
              <HappensLine done>{expectedCopy.order.happens.pdf}</HappensLine>
            </ul>

            {/* The email choice sits here, above the button it changes — not up beside the supplier, where
                it is out of sight by the time somebody has scrolled a product list. */}
            {editingEmail === 'bottom' ? (
              <InlineEmailEditor
                vendor={vendor}
                onSaved={(updated) => {
                  handleVendorUpdated(updated)
                  setEditingEmail(null)
                }}
                onCancel={() => setEditingEmail(null)}
              />
            ) : supplierEmail ? (
              <div className="flex items-center justify-between gap-3 border-y border-neutral-200 py-3">
                <span id="po-email-switch-label" className="min-w-0 flex-1 break-words font-medium text-neutral-900">
                  {expectedCopy.contact.switchLabel(supplierEmail)}
                </span>
                <Switch
                  checked={emailOn}
                  onChange={setEmailOn}
                  label={expectedCopy.contact.switchLabel(supplierEmail)}
                  labelledBy="po-email-switch-label"
                  disabled={submitting}
                />
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-y border-neutral-200 py-3 text-neutral-600">
                <span>{expectedCopy.contact.noEmailToSendTo(vendor.name)}</span>
                {mayEditSupplier(vendor, canManageSuppliers) && (
                  <button
                    type="button"
                    onClick={() => setEditingEmail('bottom')}
                    className="rounded-sm font-medium text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                  >
                    {expectedCopy.contact.addEmail}
                  </button>
                )}
              </div>
            )}
            <ul className="flex flex-col gap-1.5">
              <HappensLine>
                {willEmail
                  ? hasPhone
                    ? expectedCopy.order.happens.nextAfterEmail
                    : expectedCopy.order.happens.nextAfterEmailCopyOnly
                  : supplierEmail && hasPhone
                    ? expectedCopy.order.happens.nextBoth
                    : supplierEmail
                      ? expectedCopy.order.happens.nextEmail
                      : hasPhone
                        ? expectedCopy.order.happens.nextWhatsApp
                        : expectedCopy.order.happens.nextCopy}
              </HappensLine>
            </ul>
            {!supplierEmail && !hasPhone && (
              <p className="text-neutral-600">{expectedCopy.order.noContact(vendor.name)}</p>
            )}
            {company && company.logoUrl == null && canEditCompany && (
              <p className="text-neutral-600">
                {expectedCopy.order.noLogo}{' '}
                <Link
                  to="/app/company"
                  className="rounded-sm font-medium text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                  {expectedCopy.order.addLogo}
                </Link>
              </p>
            )}
          </section>
        )}
      </div>

      {/*
        Sticky inside <main>, which is the scroll container and carries p-6: the negative offsets
        take the bar to its edges, and the bottom padding clears a phone's home indicator.
      */}
      <div className="sticky -bottom-6 z-10 -mx-6 mt-6 -mb-6 border-t border-neutral-200 bg-white/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-2xl flex-col gap-1">
          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {isOrder ? expectedCopy.order.count(count) : expectedCopy.create.totalAnnounce(count, totalText)}
          </p>
          <Button className="w-full" disabled={!canSubmit} loading={submitting} onClick={() => void handleSubmit()}>
            {isOrder
              ? submitting
                ? expectedCopy.order.creating
                : vendorId === ''
                  ? expectedCopy.order.chooseSupplier
                  : count === 0
                    ? expectedCopy.order.submitEmpty
                    : `${willEmail ? expectedCopy.order.submitAndEmail(supplierName ?? '') : expectedCopy.order.submit} · ${expectedCopy.order.count(count)}`
              : submitting
                ? expectedCopy.create.saving
                : count === 0
                  ? expectedCopy.create.submitEmpty
                  : expectedCopy.create.submit(count, totalText)}
          </Button>
          {!isOrder && count > 0 && totals.partial && (
            <p className="text-center text-xs text-neutral-500">{expectedCopy.create.totalPartial}</p>
          )}
        </div>
      </div>
    </div>
  )
}

/** One line of "What happens next": a tick for what is done for you, a dot for what you can do after. */
function HappensLine({ done, children }: { done?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      {done ? (
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" aria-hidden="true" />
      ) : (
        <span className="mt-2 ml-1.5 mr-0.5 h-1 w-1 shrink-0 rounded-full bg-neutral-400" aria-hidden="true" />
      )}
      <span>{children}</span>
    </li>
  )
}
