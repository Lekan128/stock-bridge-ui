import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Search, X } from 'lucide-react'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { Button } from '@/components/Button'
import { ErrorState } from '@/components/ErrorState'
import { DraftNote } from '@/features/drafts/DraftNote'
import { useDraft } from '@/features/drafts/useDraft'
import { priceRequestsApi } from '@/features/expected/api/priceRequestsApi'
import { OrderItems } from '@/features/expected/components/OrderItems'
import { addDays, neededWords, shortDate, todayIso } from '@/features/expected/expected'
import { useRecentSuppliers } from '@/features/expected/hooks/useProductPicker'
import { itemFrom, quantityInvalid, quantityOf, type OrderItem } from '@/features/expected/orderItems'
import type { PickerLine } from '@/features/expected/types'
import { useVendorOptions } from '@/features/vendors/hooks/useVendorOptions'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { isAppError } from '@/types/api'

const LIST_PATH = '/app/purchase-orders'
const MAX_SUPPLIERS = 10

const text = {
  title: 'Ask for prices',
  list: 'Purchase orders',
  who: 'Who should quote?',
  whoHint: 'Each one gets their own link to type their prices into. Pick two or three to compare.',
  search: 'Add a supplier',
  recent: 'Ordered from recently',
  add: 'Add',
  remove: (name: string) => `Remove ${name}`,
  none: 'No supplier matches that.',
  max: `Ask at most ${MAX_SUPPLIERS} at once.`,
  replyBy: 'Reply by',
  neededBy: 'Needed by',
  anyTime: 'Any time',
  tomorrow: 'Tomorrow',
  inTwo: 'In 2 days',
  inThree: 'In 3 days',
  nextWeek: 'Next week',
  pickDay: 'Pick a day',
  note: 'Note for them (optional)',
  button: (count: number) => (count === 0 ? 'Pick who should quote' : count === 1 ? 'Ask 1 supplier for prices' : `Ask ${count} suppliers for prices`),
  buttonItems: 'Add items to ask about',
  buttonQuantities: 'Say how many of each',
  offline: 'Ask when online',
  asking: 'Asking…',
  failed: "We couldn't make that request. Nothing was saved.",
  summary: (items: number, suppliers: number) =>
    `${items === 1 ? '1 item' : `${items} items`} · ${suppliers === 1 ? '1 supplier' : `${suppliers} suppliers`}`,
}

interface AskDraftV1 {
  items: OrderItem[]
  vendorIds: string[]
  replyBy: string
  neededBy: string
  note: string
}

/**
 * "Ask for prices" (PURCHASE_ORDER_PLAN.md section 11.3; mockup 1B): the same item lines as an
 * order but no prices, then "Who should quote?" with several suppliers, then when. Price requests
 * commit no money, so anyone who can create orders may send them without approval (owner pick 3).
 */
export function AskForPricesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const permissions = user?.type === 'tenant' ? user.permissions : []
  const canSeeSuppliers = permissions.includes(PERMISSIONS.VIEW_VENDORS)
  const { vendors } = useVendorOptions(canSeeSuppliers)
  const recent = useRecentSuppliers(canSeeSuppliers)
  const online = useOnlineStatus()

  const [items, setItems] = useState<OrderItem[]>([])
  const [vendorIds, setVendorIds] = useState<string[]>([])
  const [replyBy, setReplyBy] = useState(() => addDays(todayIso(), 2))
  const [neededBy, setNeededBy] = useState('')
  const [note, setNote] = useState('')
  const [query, setQuery] = useState('')
  const [focusProductId, setFocusProductId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const draft = useDraft<AskDraftV1>('rfq:new')
  const [restored, setRestored] = useState(false)
  const { initial, save, clear } = draft
  useEffect(() => {
    if (!initial) return
    const saved = initial.value
    if (!Array.isArray(saved.items)) {
      void clear()
      return
    }
    setItems(saved.items)
    setVendorIds(saved.vendorIds ?? [])
    setReplyBy(saved.replyBy && saved.replyBy >= todayIso() ? saved.replyBy : addDays(todayIso(), 2))
    setNeededBy(saved.neededBy && saved.neededBy >= todayIso() ? saved.neededBy : '')
    setNote(saved.note ?? '')
    setRestored(true)
  }, [initial, clear])
  useEffect(() => {
    if (initial === undefined) return
    if (items.length === 0 && vendorIds.length === 0) return
    save({ items, vendorIds, replyBy, neededBy, note })
  }, [initial, save, items, vendorIds, replyBy, neededBy, note])

  const chosen = vendorIds.map((id) => vendors.find((vendor) => vendor.id === id)).filter((vendor) => vendor != null)
  const recentIds = useMemo(() => new Map(recent.map((entry, index) => [entry.vendorId, index])), [recent])
  const matches = vendors
    .filter((vendor) => !vendorIds.includes(vendor.id))
    .filter((vendor) => query.trim() === '' || vendor.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => (recentIds.get(a.id) ?? 999) - (recentIds.get(b.id) ?? 999) || a.name.localeCompare(b.name))
    .slice(0, 6)

  function addItem(options: PickerLine[]) {
    const productId = options[0].productId
    setItems((current) => (current.some((item) => item.key === productId) ? current : [...current, { ...itemFrom(options), price: '' }]))
    setFocusProductId(productId)
  }

  const blank = items.some((item) => quantityOf(item) == null)
  const invalid = items.some(quantityInvalid)
  const canSubmit = items.length > 0 && !blank && !invalid && vendorIds.length > 0 && online && !submitting
  const label = submitting
    ? text.asking
    : items.length === 0
      ? text.buttonItems
      : blank || invalid
        ? text.buttonQuantities
        : !online
          ? text.offline
          : text.button(vendorIds.length)

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const created = await priceRequestsApi.create({
        lines: items.map((item) => ({ productId: item.productId, unit: item.unit, quantity: quantityOf(item) as number })),
        vendorIds,
        replyBy: replyBy || undefined,
        neededBy: neededBy || undefined,
        note: note.trim() || undefined,
      })
      await draft.finish()
      void queryClient.invalidateQueries({ queryKey: ['price-requests'] })
      navigate(`${LIST_PATH}/rfq/${created.id}`, { replace: true })
    } catch (err: unknown) {
      setError(isAppError(err) ? err.message : text.failed)
      setSubmitting(false)
    }
  }

  const today = todayIso()
  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6">
        <div>
          <Breadcrumbs items={[{ label: text.list, to: LIST_PATH }, { label: text.title }]} />
          <h1 className="mt-2 text-2xl font-semibold text-neutral-900">{text.title}</h1>
        </div>

        <DraftNote
          savedAt={draft.savedAt}
          restored={restored}
          onDiscard={() => {
            void draft.clear()
            setRestored(false)
            setItems([])
            setVendorIds([])
            setNote('')
          }}
        />

        <OrderItems
          vendorId=""
          supplierName=""
          branchId=""
          items={items}
          onAdd={addItem}
          onChange={(key, patch) => setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)))}
          onRemove={(key) => setItems((current) => current.filter((item) => item.key !== key))}
          focusProductId={focusProductId}
          disabled={submitting}
          withPrices={false}
        />

        <section aria-labelledby="rfq-who" className="flex flex-col gap-2">
          <h2 id="rfq-who" className="text-sm font-semibold text-neutral-900">
            {text.who}
          </h2>
          <p className="text-xs text-neutral-600">{text.whoHint}</p>
          {chosen.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {chosen.map((vendor) => (
                <li key={vendor.id}>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 py-1 pr-1.5 pl-3 text-sm font-semibold text-primary-900">
                    {vendor.name}
                    <button
                      type="button"
                      onClick={() => setVendorIds((current) => current.filter((id) => id !== vendor.id))}
                      aria-label={text.remove(vendor.name)}
                      className="rounded-full p-0.5 text-primary-700 hover:bg-primary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {vendorIds.length < MAX_SUPPLIERS ? (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-500" aria-hidden="true" />
                <label htmlFor="rfq-supplier-search" className="sr-only">
                  {text.search}
                </label>
                <input
                  id="rfq-supplier-search"
                  type="search"
                  value={query}
                  autoComplete="off"
                  placeholder={text.search}
                  onChange={(event) => setQuery(event.target.value)}
                  className="w-full rounded-md border border-neutral-200 bg-white py-2.5 pr-3 pl-9 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none sm:text-sm"
                />
              </div>
              {matches.length > 0 ? (
                <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
                  {matches.map((vendor) => {
                    const last = recent.find((entry) => entry.vendorId === vendor.id)
                    return (
                      <li key={vendor.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-neutral-900">{vendor.name}</span>
                          {last && (
                            <span className="block text-xs text-neutral-600">
                              {shortDate(last.lastOrderedAt.slice(0, 10))} · {last.products.join(', ').toLowerCase()}
                            </span>
                          )}
                        </span>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setVendorIds((current) => [...current, vendor.id])
                            setQuery('')
                          }}
                        >
                          {text.add}
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                query.trim() !== '' && <p className="text-sm text-neutral-600">{text.none}</p>
              )}
            </>
          ) : (
            <p className="text-xs text-neutral-600">{text.max}</p>
          )}
        </section>

        <section className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-4">
          <DayChips
            label={text.replyBy}
            value={replyBy}
            onChange={setReplyBy}
            choices={[
              [addDays(today, 1), text.tomorrow],
              [addDays(today, 2), text.inTwo],
            ]}
          />
          <DayChips
            label={text.neededBy}
            value={neededBy}
            onChange={setNeededBy}
            choices={[
              ['', text.anyTime],
              [addDays(today, 3), text.inThree],
              [addDays(today, 7), text.nextWeek],
            ]}
          />
          <div className="flex flex-col gap-1">
            <label htmlFor="rfq-note" className="text-xs font-medium text-neutral-700">
              {text.note}
            </label>
            <textarea
              id="rfq-note"
              rows={2}
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-base sm:text-sm"
            />
          </div>
        </section>

        {error && <ErrorState variant="inline" message={error} />}
      </div>

      <div className="sticky -bottom-6 z-10 -mx-6 mt-6 -mb-6 border-t border-neutral-200 bg-white/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-2xl flex-col gap-1">
          <Button variant="action" className="w-full" disabled={!canSubmit} loading={submitting} onClick={() => void submit()}>
            {label}
          </Button>
          {items.length > 0 && vendorIds.length > 0 && <p className="text-center text-xs text-neutral-600">{text.summary(items.length, vendorIds.length)}</p>}
        </div>
      </div>
    </div>
  )
}

/** A day as chips, with "Pick a day" opening the calendar straight away. */
function DayChips({
  label,
  value,
  onChange,
  choices,
}: {
  label: string
  value: string
  onChange: (day: string) => void
  choices: [string, string][]
}) {
  const id = `day-${label.replace(/\s+/g, '-').toLowerCase()}`
  const picked = value !== '' && !choices.some(([day]) => day === value)
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 flex items-baseline gap-2 text-xs font-medium text-neutral-700">
        {label}
        <span className="font-normal text-neutral-900">{value ? neededWords(value) : choices.find(([day]) => day === '')?.[1]}</span>
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {choices.map(([day, word]) => (
          <button
            key={word}
            type="button"
            aria-pressed={value === day}
            onClick={() => onChange(day)}
            className={`rounded-full border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none ${
              value === day ? 'border-primary-100 bg-primary-100 font-semibold text-primary-900' : 'border-neutral-200 bg-white text-neutral-700'
            }`}
          >
            {word}
          </button>
        ))}
        <label
          className={`relative inline-flex cursor-pointer items-center rounded-full border px-3 py-1 text-sm ${
            picked ? 'border-primary-100 bg-primary-100 font-semibold text-primary-900' : 'border-neutral-200 bg-white text-neutral-700'
          }`}
        >
          {text.pickDay}
          <input
            id={id}
            type="date"
            min={todayIso()}
            value={picked ? value : ''}
            onChange={(event) => event.target.value && onChange(event.target.value)}
            onClick={(event) => {
              try {
                event.currentTarget.showPicker()
              } catch {
                // Older browsers open it on their own.
              }
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label={`${label}: ${text.pickDay}`}
          />
        </label>
      </div>
    </fieldset>
  )
}
