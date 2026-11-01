import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Search, X } from 'lucide-react'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { useWorkingBranch } from '@/features/branches/useWorkingBranch'
import { queryCatalog, toProduct } from '@/features/catalog/catalogStore'
import { useProductFinder } from '@/features/catalog/useProductFinder'
import { DraftNote } from '@/features/drafts/DraftNote'
import { useDraft } from '@/features/drafts/useDraft'
import { submitTransfer } from '@/features/outbox/outboxStore'
import { productsApi } from '@/features/products/api/productsApi'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import type { Product, UnitOption } from '@/features/products/types'
import { formatNumber, stockUnitWord, unitNoun } from '@/features/products/unitCopy'
import { resolveUnitSymbol, stockUnitOption, toBaseQuantity } from '@/features/products/unitSet'
import { unitsFor } from '@/features/selling/sale/saleLine'
import { useTransfers } from '@/features/transfers/useTransfers'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { isAppError } from '@/types/api'

const SELECT_CLASS =
  'w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-base text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none disabled:bg-neutral-50 sm:text-sm'

/** One product on the waybill being written. */
interface SendLine {
  key: string
  product: Product
  /** The unit counted in, by its label - unique within a product's set. */
  unitLabel: string
  quantity: string
}

interface SendDraft {
  fromBranchId: string
  toBranchId: string
  lines: SendLine[]
  carriedByName: string
  carriedByPhone: string
  note: string
}

/** A new line opens in the product's pack (crates, bags) when it has one, as the stock-in sheet does. */
function openingOption(options: UnitOption[]): UnitOption {
  return options.find((option) => !option.isStockUnit) ?? stockUnitOption(options)
}

/** A branch's figure for this product, when the person sees that branch. */
function figureAt(product: Product, branchId: string): number | undefined {
  return product.branchStock?.find((entry) => entry.branchId === branchId)?.quantityOnHand
}

/**
 * Send stock (MULTI_BRANCH_UX_PLAN.md §5.4): one screen shaped like Record a delivery - the two
 * branches at the top, a line per product showing both branches' stock, carried by and a note, and a
 * button that names what it does. It goes through the outbox, so it works offline; the waybill
 * number comes from the server once it arrives.
 *
 * Opened with `?product=` (the product page's "Send to…"), `?products=` (Inventory's selection),
 * `?to=`, `?from=`, or `?all=<branch>` to empty a branch that is closing (§5.11).
 */
export function SendStockPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { working, recordable, sendTo, nameOf } = useWorkingBranch()
  const { options: catalogue } = useUnitOfMeasureOptions()
  const online = useOnlineStatus()

  const recordableIds = new Set(recordable.map((branch) => branch.id))
  const askedFrom = searchParams.get('all') ?? searchParams.get('from')
  // Chosen here, or else worked out from the branch list each render - it may still be loading when
  // the screen opens, and a choice fixed then would stay empty.
  const [fromChoice, setFromBranchId] = useState<string | null>(null)
  const fallbackFrom =
    askedFrom && recordableIds.has(askedFrom) ? askedFrom : working && recordableIds.has(working.id) ? working.id : (recordable[0]?.id ?? '')
  const fromBranchId = fromChoice && recordableIds.has(fromChoice) ? fromChoice : fallbackFrom
  const [toBranchId, setToBranchId] = useState<string>(() => searchParams.get('to') ?? '')
  const [lines, setLines] = useState<SendLine[]>([])
  const [carriedByName, setCarriedByName] = useState('')
  const [carriedByPhone, setCarriedByPhone] = useState('')
  const [note, setNote] = useState('')
  const [receiveNow, setReceiveNow] = useState(false)
  const [term, setTerm] = useState('')
  const [sending, setSending] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const destinations = sendTo.filter((branch) => branch.id !== fromBranchId)
  const fromName = nameOf(fromBranchId) ?? 'this branch'
  const toName = destinations.find((branch) => branch.id === toBranchId)?.name
  // Both ends at once (§5.6): only for someone who may record at both.
  const mayReceiveNow = toBranchId !== '' && recordableIds.has(toBranchId) && recordableIds.has(fromBranchId)

  // Past drivers, suggested as people type (§5.4): from the transfers already on this phone.
  const recent = useTransfers({}, true)
  const drivers = useMemo(() => {
    const seen = new Map<string, string | undefined>()
    for (const transfer of recent.data?.content ?? []) {
      if (transfer.carriedByName && !seen.has(transfer.carriedByName)) seen.set(transfer.carriedByName, transfer.carriedByPhone)
    }
    return [...seen.entries()]
  }, [recent.data])

  // ------------------------------------------------------------------------------ the draft (A5)
  const draft = useDraft<SendDraft>('transfer:new')
  const [restored, setRestored] = useState(false)
  const { initial, save } = draft
  useEffect(() => {
    if (!initial) return
    const saved = initial.value
    setFromBranchId(saved.fromBranchId)
    setToBranchId((current) => current || saved.toBranchId)
    setLines((current) => [...current, ...saved.lines.filter((line) => !current.some((c) => c.product.id === line.product.id))])
    setCarriedByName(saved.carriedByName)
    setCarriedByPhone(saved.carriedByPhone)
    setNote(saved.note)
    setRestored(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial])
  useEffect(() => {
    if (initial === undefined || lines.length === 0) return
    save({ fromBranchId, toBranchId, lines, carriedByName, carriedByPhone, note })
  }, [fromBranchId, toBranchId, lines, carriedByName, carriedByPhone, note, initial, save])

  // ---------------------------------------------------------------------- pre-filled from a link
  const prefilled = useRef(false)
  useEffect(() => {
    if (prefilled.current || catalogue.length === 0) return
    // `?product=` from a product page, `?products=a,b,c` from Inventory's selection.
    const productIds = [searchParams.get('product'), ...(searchParams.get('products')?.split(',') ?? [])].filter(
      (id): id is string => !!id,
    )
    const emptying = searchParams.get('all')
    if (productIds.length === 0 && !emptying) return
    prefilled.current = true
    for (const productId of productIds) {
      void productsApi
        .get(productId)
        .then(addProduct)
        .catch(() => undefined)
    }
    if (emptying) {
      // Everything this branch holds, each line at its whole figure: a closing branch sends it all.
      void queryCatalog({
        search: '',
        status: 'active',
        categoryId: '',
        stockStatus: 'all',
        sort: { field: 'name', direction: 'asc' },
        offset: 0,
        limit: 2000,
        branchId: emptying,
      }).then(({ rows }) => {
        const held = rows.map(toProduct).filter((product) => product.quantityOnHand > 0)
        setLines((current) => [
          ...current,
          ...held
            .filter((product) => !current.some((line) => line.product.id === product.id))
            .map((product) => ({
              key: product.id,
              product,
              unitLabel: stockUnitOption(unitsFor(product, catalogue)).label,
              quantity: String(product.quantityOnHand),
            })),
        ])
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogue])

  function addProduct(product: Product) {
    setTerm('')
    setProblem(null)
    setLines((current) => {
      if (current.some((line) => line.product.id === product.id)) return current
      const option = openingOption(unitsFor(product, catalogue))
      return [...current, { key: product.id, product, unitLabel: option.label, quantity: '' }]
    })
    searchRef.current?.focus()
  }

  const finder = useProductFinder(term, addProduct)

  function update(key: string, patch: Partial<SendLine>) {
    setProblem(null)
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  // ------------------------------------------------------------------------------------ checks
  const checked = lines.map((line) => {
    const options = unitsFor(line.product, catalogue)
    const option = options.find((o) => o.label === line.unitLabel) ?? stockUnitOption(options)
    const quantity = Number(line.quantity)
    const valid = line.quantity.trim() !== '' && Number.isInteger(quantity) && quantity > 0
    const base = valid ? toBaseQuantity(quantity, option) : 0
    const has = figureAt(line.product, fromBranchId)
    return { line, options, option, quantity, valid, base, has, short: has != null && base > has }
  })
  const ready = checked.filter((entry) => entry.valid)
  const anyShort = checked.some((entry) => entry.short)
  const anyInvalid = checked.some((entry) => entry.line.quantity.trim() !== '' && !entry.valid)
  const canSend = !sending && fromBranchId !== '' && toName != null && ready.length > 0 && !anyShort && !anyInvalid

  async function send() {
    if (!canSend || !toName) return
    setSending(true)
    setProblem(null)
    const id = crypto.randomUUID()
    try {
      const outcome = await submitTransfer({
        kind: 'TRANSFER_SEND',
        summary: `${ready.length} ${ready.length === 1 ? 'item' : 'items'} to ${toName}`,
        payload: {
          id,
          fromBranchId,
          toBranchId,
          carriedByName: carriedByName.trim() || undefined,
          carriedByPhone: carriedByPhone.trim() || undefined,
          note: note.trim() || undefined,
          receiveNow: mayReceiveNow && receiveNow ? true : undefined,
          lines: ready.map((entry) => ({
            productId: entry.line.product.id,
            quantity: entry.quantity,
            unit: entry.option.isStockUnit ? undefined : entry.option.code || undefined,
          })),
        },
      })
      await draft.finish()
      navigate(`/app/transfers/${outcome.status === 'sent' ? outcome.response.id : id}`, {
        replace: true,
        state: { justSent: true },
      })
    } catch (error) {
      setProblem(isAppError(error) ? error.message : "Couldn't send this. Try again.")
      setSending(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5">
        <div className="flex items-start gap-3">
          <Link to="/app/transfers" aria-label="Back to transfers" className="mt-1 rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">Send stock</h1>
            <p className="mt-1 text-sm text-neutral-600">from {fromName}</p>
          </div>
        </div>

        <DraftNote
          savedAt={draft.savedAt}
          restored={restored}
          onDiscard={() => {
            void draft.clear()
            setRestored(false)
            setLines([])
            setCarriedByName('')
            setCarriedByPhone('')
            setNote('')
          }}
        />

        <section className="grid gap-4 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-2">
          {recordable.length > 1 && (
            <div>
              <label htmlFor="send-from" className="mb-1.5 block text-sm font-medium text-neutral-700">
                From
              </label>
              <select
                id="send-from"
                value={fromBranchId}
                disabled={sending}
                onChange={(event) => {
                  setFromBranchId(event.target.value)
                  if (event.target.value === toBranchId) setToBranchId('')
                }}
                className={SELECT_CLASS}
              >
                {recordable.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className={recordable.length > 1 ? '' : 'sm:col-span-2'}>
            <label htmlFor="send-to" className="mb-1.5 block text-sm font-medium text-neutral-700">
              To
            </label>
            <select
              id="send-to"
              value={toBranchId}
              disabled={sending}
              onChange={(event) => setToBranchId(event.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">Choose a branch</option>
              {destinations.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section aria-labelledby="send-lines-heading" className="flex flex-col gap-3">
          <h2 id="send-lines-heading" className="text-sm font-semibold text-neutral-900">
            What's going
          </h2>

          {checked.length > 0 && (
            <ul className="flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white" aria-label="On this waybill">
              {checked.map(({ line, options, option, base, has, short }) => {
                const unit = resolveUnitSymbol(line.product.unitOfMeasure, catalogue)
                const toHas = toBranchId ? figureAt(line.product, toBranchId) : undefined
                const inputId = `send-qty-${line.key}`
                return (
                  <li key={line.key} className="flex flex-col gap-2 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-medium text-neutral-900">{line.product.name}</p>
                        <p className="text-xs tabular-nums text-neutral-500">
                          {has != null && (
                            <span className={short ? 'font-medium text-danger-700' : ''}>
                              {fromName} has {formatNumber(has)} {stockUnitWord(unit, has)}
                            </span>
                          )}
                          {has != null && toHas != null && toName && ' · '}
                          {toHas != null && toName && (
                            <span>
                              {toName} has {formatNumber(toHas)} {stockUnitWord(unit, toHas)}
                            </span>
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setLines((current) => current.filter((l) => l.key !== line.key))}
                        aria-label={`Take ${line.product.name} off`}
                        className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <label htmlFor={inputId} className="sr-only">
                        How many {line.product.name}
                      </label>
                      <input
                        id={inputId}
                        inputMode="numeric"
                        value={line.quantity}
                        disabled={sending}
                        aria-invalid={short || undefined}
                        onChange={(event) => update(line.key, { quantity: event.target.value.replace(/[^0-9]/g, '') })}
                        className={`h-11 w-24 rounded-md border bg-white px-3 text-base tabular-nums focus:ring-2 focus:outline-none ${
                          short ? 'border-danger-500 focus:ring-danger-100' : 'border-neutral-300 focus:border-primary-500 focus:ring-primary-100'
                        }`}
                      />
                      {options.length > 1 ? (
                        <select
                          aria-label={`Unit for ${line.product.name}`}
                          value={option.label}
                          disabled={sending}
                          onChange={(event) => update(line.key, { unitLabel: event.target.value })}
                          className="h-11 rounded-md border border-neutral-300 bg-white px-2 text-base sm:text-sm"
                        >
                          {options.map((o) => (
                            <option key={o.label} value={o.label}>
                              {o.isStockUnit ? unit : unitNoun(o)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-sm text-neutral-600">{unit}</span>
                      )}
                      {!option.isStockUnit && base > 0 && (
                        <span className="text-xs tabular-nums text-neutral-500">
                          = {formatNumber(base)} {stockUnitWord(unit, base)}
                        </span>
                      )}
                    </div>
                    {short && has != null && (
                      <p className="text-sm text-danger-700">
                        {fromName} has {formatNumber(has)} {stockUnitWord(unit, has)}.
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-neutral-500" aria-hidden="true" />
            <label htmlFor="send-search" className="sr-only">
              Scan or search to add an item
            </label>
            <input
              ref={searchRef}
              id="send-search"
              type="search"
              autoComplete="off"
              enterKeyHint="search"
              value={term}
              disabled={sending}
              onChange={(event) => setTerm(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  finder.onEnter()
                }
              }}
              placeholder={lines.length === 0 ? 'Scan or search to add the first item…' : 'Scan or search to add another item…'}
              className="h-12 w-full rounded-lg border-2 border-neutral-300 bg-white pr-3 pl-11 text-base text-neutral-900 placeholder:text-neutral-500 focus:border-primary-600 focus:outline-none"
            />
          </div>
          {finder.search && (
            <div className="flex flex-col gap-1">
              {finder.results.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addProduct(product)}
                  className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-left hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  <span className="truncate text-base font-medium text-neutral-900">{product.name}</span>
                  <span className="shrink-0 text-sm tabular-nums text-neutral-500">{product.sku}</span>
                </button>
              ))}
              {finder.answered && finder.results.length === 0 && (
                <p className="px-1 text-sm text-neutral-600">Nothing matches “{finder.search}”.</p>
              )}
            </div>
          )}
        </section>

        <section className="grid gap-4 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-2">
          <TextField
            id="send-carried-by"
            label="Carried by (optional)"
            value={carriedByName}
            maxLength={120}
            disabled={sending}
            list="send-drivers"
            autoComplete="off"
            onChange={(event) => {
              const name = event.target.value
              setCarriedByName(name)
              const known = drivers.find(([driver]) => driver === name)
              if (known?.[1] && !carriedByPhone) setCarriedByPhone(known[1])
            }}
          />
          <datalist id="send-drivers">
            {drivers.map(([driver]) => (
              <option key={driver} value={driver} />
            ))}
          </datalist>
          <TextField
            id="send-carried-phone"
            label="Their phone (optional)"
            type="tel"
            value={carriedByPhone}
            maxLength={50}
            disabled={sending}
            onChange={(event) => setCarriedByPhone(event.target.value)}
          />
          <div className="sm:col-span-2">
            <TextField
              id="send-note"
              label="Note (optional)"
              value={note}
              maxLength={1000}
              disabled={sending}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        </section>

        {problem && (
          <p role="alert" className="rounded-md border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
            {problem}
          </p>
        )}
      </div>

      <div className="sticky -bottom-6 z-10 -mx-6 mt-6 -mb-6 border-t border-neutral-200 bg-white/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-2xl flex-col gap-2">
          {mayReceiveNow && (
            <label className="flex min-h-11 items-center gap-2 text-sm text-neutral-800">
              <input type="checkbox" checked={receiveNow} onChange={(event) => setReceiveNow(event.target.checked)} className="h-4 w-4" />
              It's already there — record it as received
            </label>
          )}
          <Button variant="action" className="w-full" disabled={!canSend} loading={sending} onClick={() => void send()}>
            {ready.length === 0
              ? 'Add something to send'
              : !toName
                ? 'Choose where it is going'
                : `${receiveNow && mayReceiveNow ? 'Move' : 'Send'} ${ready.length} ${ready.length === 1 ? 'item' : 'items'} to ${toName}`}
          </Button>
          {!online && ready.length > 0 && (
            <p className="text-center text-xs text-neutral-500">
              You're offline. It's kept on this phone and sent when you're connected; the waybill number comes then.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
