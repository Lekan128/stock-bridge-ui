import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { Button } from '@/components/Button'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/Skeleton'
import { queryKeys } from '@/data/queryKeys'
import { useApiQuery } from '@/data/useApiQuery'
import { useOptionalWorkingBranch } from '@/features/branches/useWorkingBranch'
import { useCompany } from '@/features/company/hooks/useCompany'
import { DraftNote } from '@/features/drafts/DraftNote'
import { useDraft } from '@/features/drafts/useDraft'
import { expectedApi } from '@/features/expected/api/expectedApi'
import { DeliveryDetails } from '@/features/expected/components/DeliveryDetails'
import { OrderItems } from '@/features/expected/components/OrderItems'
import { SendChoice } from '@/features/expected/components/SendChoice'
import { defaultSendWay, type SendWay } from '@/features/expected/sendWay'
import { SupplierSearch } from '@/features/expected/components/SupplierSearch'
import { expectedCopy } from '@/features/expected/copy'
import { mayEditSupplier, orderMoney, todayIso } from '@/features/expected/expected'
import { useProductsById, useRecentSuppliers } from '@/features/expected/hooks/useProductPicker'
import { OrderTotals } from '@/features/expected/components/OrderTotals'
import {
  amountOf,
  groupByProduct,
  itemFrom,
  moneyOf,
  moneyText,
  priceForUnit,
  priceInvalid,
  priceOf,
  priceText,
  quantityInvalid,
  quantityOf,
  type OrderItem,
} from '@/features/expected/orderItems'
import type { ExpectedDelivery, PageResponse, PickerLine } from '@/features/expected/types'
import { useVendorOptions } from '@/features/vendors/hooks/useVendorOptions'
import type { CompanyVendor } from '@/features/vendors/types'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { isAppError } from '@/types/api'

const LIST_PATH = '/app/purchase-orders'
const text = expectedCopy.form

/** What a new order keeps on the phone between visits (Pattern C: a form that creates something keeps a draft). */
interface OrderDraftV2 {
  vendorId: string
  items: OrderItem[]
  neededBy: string
  note: string
  branchId: string
  sendWay: SendWay | null
  /** As typed; absent on a draft kept before prices. */
  deliveryCharge?: string
}

/**
 * A purchase order, made or changed (redesign 2026-11-04, owner-approved mockups A–C). One page, in
 * the order of the job: supplier, items, delivery, how the supplier gets it, then one button that
 * says what pressing it does. Each part is either filled in or one short line with "Change"; nothing
 * is a popup except adding a new supplier, which is the directory's own form (Pattern A).
 *
 * Opened from elsewhere with what to order already known:
 * - `?vendor=<id>` — a supplier's page ("New purchase order")
 * - `?products=<id,id>` — "Order more" on a product, "Order these" on the low-stock list
 * - `?again=<orderId>` — "Order again"
 * - `/:id/change` — "Change order": same form, supplier kept, the button saves.
 */
export function PurchaseOrderFormPage() {
  const { id: changingId } = useParams()
  const changing = changingId != null
  const [params] = useSearchParams()
  const againId = params.get('again') ?? ''
  const prefillVendor = params.get('vendor') ?? ''
  const prefillProducts = useMemo(
    () => (params.get('products') ?? '').split(',').map((part) => part.trim()).filter(Boolean),
    [params],
  )
  const prefilled = changing || againId !== '' || prefillVendor !== '' || prefillProducts.length > 0

  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const permissions = user?.type === 'tenant' ? user.permissions : []
  const canSeeSuppliers = permissions.includes(PERMISSIONS.VIEW_VENDORS)
  const canManageSuppliers = permissions.includes(PERMISSIONS.MANAGE_VENDORS)
  const canEditCompany = permissions.includes(PERMISSIONS.MANAGE_COMPANY_PROFILE)
  // Someone who can only create (V78): the order waits for approval instead of going to the supplier.
  const forApproval = !permissions.includes(PERMISSIONS.SEND_PURCHASE_ORDER)
  const { vendors, upsert: addVendor } = useVendorOptions(canSeeSuppliers)
  const recent = useRecentSuppliers(canSeeSuppliers && !changing)
  const { company } = useCompany()
  const online = useOnlineStatus()

  const [vendorId, setVendorId] = useState(prefillVendor)
  const [items, setItems] = useState<OrderItem[]>([])
  const [neededBy, setNeededBy] = useState('')
  const [note, setNote] = useState('')
  const [deliveryText, setDeliveryText] = useState('')
  const [approvalNote, setApprovalNote] = useState('')
  const [pickedBranch, setPickedBranch] = useState('')
  const [pickedWay, setPickedWay] = useState<SendWay | null>(null)
  const [editingEmail, setEditingEmail] = useState(false)
  const [focusProductId, setFocusProductId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const vendor = vendors.find((entry) => entry.id === vendorId)
  const sendWay: SendWay = pickedWay ?? defaultSendWay(vendor)

  // Where it is going (MULTI_BRANCH_UX_PLAN.md §5.10): this branch by default; nothing asked at one branch.
  const branch = useOptionalWorkingBranch()
  const multiBranch = branch?.isMultiBranch ?? false
  const recordable = multiBranch ? (branch?.recordable ?? []) : []
  const defaultBranch =
    branch?.working && recordable.some((option) => option.id === branch.working?.id)
      ? branch.working.id
      : recordable.length === 1
        ? recordable[0].id
        : ''
  const branchId = pickedBranch || defaultBranch
  const deliverBranch = multiBranch
    ? recordable.find((option) => option.id === branchId)
    : (branch?.branches.find((option) => option.main) ?? branch?.branches[0])
  const deliverTo = deliverBranch
    ? { name: multiBranch ? deliverBranch.name : undefined, address: deliverBranch.address }
    : null

  // ---------------------------------------------------------------- what it starts from -------
  const sourceId = changing ? changingId : againId
  const source = useApiQuery<ExpectedDelivery>({
    queryKey: queryKeys.expected.detail(sourceId || null),
    queryFn: () => expectedApi.get(sourceId),
    fallbackError: text.loadFailed,
    enabled: sourceId !== '',
  })
  const sourceOrder = source.data ?? null
  const sourceProducts = useMemo(
    () => (sourceOrder ? [...new Set(sourceOrder.lines.map((line) => line.productId))] : prefillProducts),
    [sourceOrder, prefillProducts],
  )
  const prefillVendorId = sourceOrder?.vendorId ?? prefillVendor
  const sourceLines = useProductsById(
    sourceId !== '' && !sourceOrder ? [] : sourceProducts,
    prefillVendorId,
    branchId,
    changing ? changingId : '',
  )
  const prefillDone = useRef(false)

  useEffect(() => {
    if (prefillDone.current || !prefilled) return
    if (sourceId !== '' && !sourceOrder) return
    if (sourceProducts.length > 0 && !sourceLines.lines) return
    prefillDone.current = true
    const optionsByProduct = new Map(groupByProduct(sourceLines.lines ?? []).map((group) => [group[0].productId, group]))
    if (sourceOrder) {
      setVendorId(sourceOrder.vendorId ?? '')
      setNote(sourceOrder.note ?? '')
      if (sourceOrder.deliveryCharge != null) setDeliveryText(String(sourceOrder.deliveryCharge))
      if (changing) {
        setNeededBy(sourceOrder.expectedDate ?? '')
        if (sourceOrder.branchId) setPickedBranch(sourceOrder.branchId)
      }
      const seen = new Set<string>()
      const next: OrderItem[] = []
      for (const line of sourceOrder.lines) {
        const options = optionsByProduct.get(line.productId)
        if (!options) continue
        const item = itemFrom(options, String(line.quantity))
        item.unit = options.some((option) => option.unit === line.unit) ? line.unit : item.unit
        // Changing an order keeps its own prices; "Order again" starts from the newest price instead.
        if (changing) item.price = line.price != null ? moneyText(line.price) : ''
        else if (item.unit !== itemFrom(options).unit) item.price = priceForUnit(itemFrom(options), item.unit)
        // One line per product; an old order that asked for one product two ways keeps both.
        item.key = seen.has(line.productId) ? `${line.productId}:${line.unit}` : line.productId
        seen.add(line.productId)
        next.push(item)
      }
      setItems(next)
    } else {
      setItems(sourceProducts.flatMap((productId) => {
        const options = optionsByProduct.get(productId)
        return options ? [itemFrom(options)] : []
      }))
    }
  }, [prefilled, sourceId, sourceOrder, sourceProducts, sourceLines.lines, changing])

  // ---------------------------------------------------------------- the draft ---------------
  const draft = useDraft<OrderDraftV2>('order:new', !prefilled)
  const [restoredDraft, setRestoredDraft] = useState(false)
  const { initial: initialDraft, save: saveDraftNow, clear: clearDraft } = draft
  useEffect(() => {
    if (!initialDraft) return
    const saved = initialDraft.value
    // A draft from before the redesign kept its lines another way: it can't be put back, so it goes.
    if (!Array.isArray(saved.items)) {
      void clearDraft()
      return
    }
    setVendorId(saved.vendorId)
    setItems(saved.items)
    // A day that has passed since cannot be asked for any more.
    setNeededBy(saved.neededBy !== '' && saved.neededBy < todayIso() ? '' : saved.neededBy)
    setNote(saved.note)
    setDeliveryText(saved.deliveryCharge ?? '')
    setPickedBranch(saved.branchId)
    setPickedWay(saved.sendWay)
    setRestoredDraft(true)
  }, [initialDraft, clearDraft])
  useEffect(() => {
    if (prefilled || initialDraft === undefined) return
    if (items.length === 0 && note.trim() === '') return
    saveDraftNow({ vendorId, items, neededBy, note, branchId: pickedBranch, sendWay: pickedWay, deliveryCharge: deliveryText })
  }, [prefilled, initialDraft, saveDraftNow, vendorId, items, neededBy, note, pickedBranch, pickedWay, deliveryText])

  // ---------------------------------------------------------------- an order already open ---
  const openOrders = useApiQuery<PageResponse<ExpectedDelivery>>({
    queryKey: ['expected', 'open-for', vendorId],
    queryFn: () => expectedApi.list({ view: 'OPEN', vendorId, page: 0, size: 1 }),
    fallbackError: text.loadFailed,
    enabled: vendorId !== '' && !changing,
    persist: false,
  })
  const alreadyOpen = openOrders.data?.content.find((order) => order.poNumber != null && order.id !== changingId)

  // ---------------------------------------------------------------- lines -------------------
  function handleAdd(options: PickerLine[]) {
    const productId = options[0].productId
    setItems((current) => (current.some((item) => item.key === productId) ? current : [...current, itemFrom(options)]))
    setFocusProductId(productId)
  }
  function handleChange(key: string, patch: Partial<Pick<OrderItem, 'unit' | 'quantity' | 'price'>>) {
    setItems((current) =>
      current.map((item) => {
        if (item.key !== key) return item
        // A new unit carries its price with it: ₦45,000 a bag becomes ₦900 a kg, not ₦45,000 a kg.
        const price = patch.unit != null && patch.unit !== item.unit && patch.price == null ? priceForUnit(item, patch.unit) : undefined
        return { ...item, ...patch, ...(price != null ? { price } : {}) }
      }),
    )
  }
  function handleRemove(key: string) {
    setItems((current) => current.filter((item) => item.key !== key))
  }
  function handleSupplierChange(next: string) {
    setVendorId(next)
    setPickedWay(null)
    setEditingEmail(false)
  }
  function handleVendorUpdated(updated: CompanyVendor) {
    addVendor(updated)
    // A new address is untried: the choice is asked again rather than switched to email.
    setPickedWay(null)
  }

  // ---------------------------------------------------------------- the button ----------------
  const blank = items.filter((item) => quantityOf(item) == null && !quantityInvalid(item)).length
  const invalid = items.some(quantityInvalid)
  // Every line of a new order has a price (owner, 2026-11-06). Changing an order made before prices
  // may leave them all out, but not some: the supplier sees prices on all lines or on none.
  const requirePrices =
    !changing || (sourceOrder?.lines.some((line) => line.price != null) ?? false) || items.some((item) => priceText(item).trim() !== '')
  const missingPrice = requirePrices && items.some((item) => priceOf(item) == null && !priceInvalid(item))
  const badPrice = items.some(priceInvalid)
  const deliveryCharge = moneyOf(deliveryText)
  const badDelivery = deliveryText.trim() !== '' && deliveryCharge == null
  const priced = items.length > 0 && items.every((item) => priceOf(item) != null)
  const itemsTotal = items.reduce((sum, item) => sum + (amountOf(item) ?? 0), 0)
  const grandTotal = Math.round((itemsTotal + (deliveryCharge ?? 0)) * 100) / 100
  const neededInPast = neededBy !== '' && neededBy < todayIso() && !(changing && neededBy === sourceOrder?.expectedDate)
  const needsBranch = multiBranch && branchId === ''
  const canSubmit =
    vendorId !== '' &&
    items.length > 0 &&
    blank === 0 &&
    !invalid &&
    !missingPrice &&
    !badPrice &&
    !badDelivery &&
    !neededInPast &&
    !needsBranch &&
    online &&
    !submitting
  const supplierName = vendor?.name ?? sourceOrder?.vendorName ?? ''
  const label = submitting
    ? changing ? text.saving : text.making
    : vendorId === ''
      ? text.buttonChoose
      : items.length === 0
        ? text.buttonAddItems
        : blank > 0 || invalid
          ? text.buttonQuantities
          : missingPrice || badPrice
            ? text.buttonPrices
            : !online
            ? text.buttonOffline
            : forApproval
              ? changing
                ? text.buttonSaveForApproval
                : text.buttonForApproval
            : changing
              ? text.buttonSave
              : sendWay === 'EMAIL'
                ? text.buttonEmail(supplierName)
                : sendWay === 'WHATSAPP'
                  ? text.buttonWhatsApp
                  : sendWay === 'PHONE'
                    ? text.buttonPhone
                    : text.buttonSelf

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    setSubmitError(null)
    const lines = items.map((item) => {
      const price = priceOf(item)
      return { productId: item.productId, unit: item.unit, quantity: quantityOf(item) as number, ...(price != null ? { price } : {}) }
    })
    const charge = deliveryCharge != null ? { deliveryCharge } : {}
    const forApprover = forApproval && approvalNote.trim() !== '' ? { approvalNote: approvalNote.trim() } : {}
    try {
      if (changing && changingId) {
        const updated = await expectedApi.change(changingId, {
          expectedDate: neededBy || undefined,
          note: note.trim() || undefined,
          lines,
          ...charge,
          ...forApprover,
        })
        queryClient.setQueryData(queryKeys.expected.detail(changingId), updated)
        void queryClient.invalidateQueries({ queryKey: queryKeys.expected.all })
        navigate(`${LIST_PATH}/${changingId}`, { replace: true, state: { changed: true } })
        return
      }
      const created = await expectedApi.create({
        purchaseOrder: true,
        // Nothing goes to the supplier from an order that waits for approval.
        emailRequested: !forApproval && sendWay === 'EMAIL',
        orderedByPhone: !forApproval && sendWay === 'PHONE',
        vendorId,
        ...(branchId ? { branchId } : {}),
        expectedDate: neededBy || undefined,
        note: note.trim() || undefined,
        lines,
        ...charge,
        ...forApprover,
      })
      await draft.finish()
      void queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.expected.all })
      navigate(`${LIST_PATH}/${created.id}`, { replace: true, state: { justCreated: true, send: forApproval ? undefined : sendWay } })
    } catch (err: unknown) {
      setSubmitError(isAppError(err) ? err.message : changing ? text.changeFailed : text.failed)
      setSubmitting(false)
    }
  }

  const title = changing ? text.changeTitle(sourceOrder?.poNumber ?? '') : text.newTitle
  if (sourceId !== '' && source.loading && !sourceOrder) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4" role="status" aria-busy="true">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }
  if (sourceId !== '' && !sourceOrder && source.error) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <ErrorState title={text.loadFailed} message={source.error} onRetry={source.refetch} />
      </div>
    )
  }

  const alreadySent = changing && sourceOrder != null && !sourceOrder.waitingToBeSent
  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6">
        <div>
          <Breadcrumbs items={[{ label: expectedCopy.list.title, to: LIST_PATH }, { label: title }]} />
          <h1 className="mt-2 text-2xl font-semibold text-neutral-900">{title}</h1>
          {alreadySent && <p className="mt-1 text-sm text-neutral-600">{text.changeNoteFor(supplierName)}</p>}
        </div>

        <DraftNote
          savedAt={draft.savedAt}
          restored={restoredDraft}
          onDiscard={() => {
            void draft.clear()
            setRestoredDraft(false)
            setVendorId('')
            setItems([])
            setNeededBy('')
            setNote('')
            setDeliveryText('')
            setPickedBranch('')
            setPickedWay(null)
          }}
        />

        <SupplierSearch
          vendors={vendors}
          recent={recent}
          value={vendorId}
          onChange={handleSupplierChange}
          canCreate={canManageSuppliers}
          onCreated={addVendor}
          locked={changing}
          disabled={submitting}
        />

        {alreadyOpen && (
          <p className="rounded-md bg-primary-50 px-3 py-2 text-sm text-neutral-800">
            {text.openOrder(
              alreadyOpen.poNumber ?? '',
              alreadyOpen.vendorName ?? supplierName,
              alreadyOpen.lines.filter((line) => line.outstanding > 0).slice(0, 3).map((line) => line.productName.toLowerCase()).join(', '),
            )}{' '}
            <Link to={`${LIST_PATH}/${alreadyOpen.id}`} className="font-medium text-primary-700 hover:underline">
              {text.openOrderLink}
            </Link>
          </p>
        )}

        {vendorId === '' ? (
          <p className="text-sm text-neutral-600">{text.supplierFirst}</p>
        ) : (
          <>
            <OrderItems
              vendorId={vendorId}
              supplierName={supplierName}
              branchId={branchId}
              items={items}
              onAdd={handleAdd}
              onChange={handleChange}
              onRemove={handleRemove}
              focusProductId={focusProductId}
              disabled={submitting}
              changingOrderId={changing ? changingId : undefined}
            />

            {items.length > 0 && (
              <OrderTotals
                supplierName={supplierName}
                itemsTotal={priced ? itemsTotal : null}
                delivery={deliveryText}
                onDeliveryChange={setDeliveryText}
                deliveryInvalid={badDelivery}
                total={priced ? grandTotal : null}
                disabled={submitting}
              />
            )}

            <DeliveryDetails
              supplierName={supplierName}
              deliverTo={deliverTo}
              branches={recordable.map((option) => ({ id: option.id, name: option.name, address: option.address }))}
              branchId={branchId}
              onBranchChange={setPickedBranch}
              canEditAddress={canEditCompany}
              neededBy={neededBy}
              onNeededByChange={setNeededBy}
              note={note}
              onNoteChange={setNote}
              disabled={submitting}
            />

            {forApproval && (
              <section aria-labelledby="po-approval-heading" className="flex flex-col gap-2">
                <h2 id="po-approval-heading" className="text-sm font-semibold text-neutral-900">
                  {text.approvalHeading}
                </h2>
                <p className="rounded-md bg-primary-50 px-3 py-2 text-sm text-neutral-800">{text.approvalSays(supplierName)}</p>
                <label htmlFor="po-approval-note" className="text-xs font-medium text-neutral-700">
                  {text.approvalNoteLabel}
                </label>
                <textarea
                  id="po-approval-note"
                  rows={2}
                  maxLength={500}
                  value={approvalNote}
                  disabled={submitting}
                  placeholder={text.approvalNotePlaceholder}
                  onChange={(event) => setApprovalNote(event.target.value)}
                  className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none sm:text-sm"
                />
              </section>
            )}

            {!changing && !forApproval && vendor && (
              <SendChoice
                vendor={vendor}
                value={sendWay}
                onChange={setPickedWay}
                canEditEmail={mayEditSupplier(vendor, canManageSuppliers)}
                editingEmail={editingEmail}
                onEditingEmailChange={setEditingEmail}
                onVendorUpdated={handleVendorUpdated}
                disabled={submitting}
              />
            )}

            {company && company.logoUrl == null && canEditCompany && (
              <p className="text-sm text-neutral-600">
                {text.noLogo}{' '}
                <Link to="/app/company" className="font-medium text-primary-700 hover:underline">
                  {text.addLogo}
                </Link>
              </p>
            )}
          </>
        )}

        {submitError && <ErrorState variant="inline" message={submitError} />}
      </div>

      {/* Sticky inside <main> (the scroll container, p-6): the offsets take the bar to its edges. */}
      <div className="sticky -bottom-6 z-10 -mx-6 mt-6 -mb-6 border-t border-neutral-200 bg-white/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-2xl flex-col gap-1">
          <Button variant="action" className="w-full" disabled={!canSubmit} loading={submitting} onClick={() => void handleSubmit()}>
            {label}
          </Button>
          {vendorId !== '' && items.length > 0 && (
            <p className="text-center text-xs text-neutral-600" aria-live="polite">
              {!online ? text.offlineNote : text.summary(supplierName, items.length, priced && !badDelivery ? orderMoney(grandTotal) : undefined)}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
