import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Search } from 'lucide-react'
import { api } from '@/api/client'
import { useToast } from '@/components/useToast'
import { isAppError } from '@/types/api'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { queryCatalog, syncCatalog, toProduct } from '@/features/catalog/catalogStore'
import { useCatalogState } from '@/features/catalog/useCatalog'
import { useCompanyCategories } from '@/features/products/categories/useCompanyCategories'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import type { Product } from '@/features/products/types'
import { formatMoney } from '@/features/selling/money'
import { priceInList, useBranchPrices, type PriceGroup } from '@/features/selling/branchPrices'

/** One cell sent to the API: `branchId` absent for the one price (switch off); price null takes it off. */
interface Cell {
  productId: string
  branchId?: string
  price: number | null
  unit?: string
}

const PAGE = 300

/** The unit a row's prices are typed per: its pack when its price was typed per pack, else its stock unit. */
function rowUnit(product: Product): string | undefined {
  return product.unitPriceEnteredUnit ?? undefined
}

/** A cell's price as typed per the row's unit ("5,000" a carton), from the per-stock-unit figure when that's all. */
function shown(product: Product, group: PriceGroup): string {
  const price = priceInList(product, group.listId)
  if (price.unitPrice == null) return ''
  const unit = rowUnit(product)
  if (!unit) return String(price.unitPrice)
  if (price.unitPriceEntered != null && price.unitPriceEnteredUnit === unit) return String(price.unitPriceEntered)
  const size = product.packagingSize ?? 1
  return String(Math.round(price.unitPrice * size * 100) / 100)
}

const cellKey = (productId: string, listId: string | undefined) => `${productId}:${listId ?? 'one'}`

/**
 * The price sheet (BRANCH_PRICES_PLAN.md §10; owner 2026-11-21): many prices typed like a spreadsheet, right in the
 * app - no file to download, fill in and bring back. A column per set of branch prices (one "Price" column with the
 * switch off). Enter goes down, Tab across; pasting a column from Excel or Google Sheets fills the cells below. Each
 * cell saves when you leave it, with Undo. Reads the phone's copy of the catalogue; saving needs a connection. A phone
 * shows one column at a time.
 */
export function PriceSheetPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const online = useOnlineStatus()
  const { showToast } = useToast()
  const catalog = useCatalogState()
  const { on, groups: allGroups } = useBranchPrices()
  const { categories } = useCompanyCategories(true)
  const { options: units } = useUnitOfMeasureOptions()
  const groups = useMemo(() => allGroups.filter((group) => group.branches.length > 0), [allGroups])

  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [missingAt, setMissingAt] = useState<string>('') // a list id, or 'any' with the switch off
  const [rows, setRows] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [loaded, setLoaded] = useState(0)
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(0)
  const [last, setLast] = useState<{ said: string; undo: Cell[] } | null>(null)
  const focusList = params.get('prices') ?? undefined
  const [phoneColumn, setPhoneColumn] = useState<string | undefined>(focusList)
  const generation = useRef(0)

  // Rows from the phone's catalogue: every active product, kept in stock or made here, by name.
  const load = useCallback(
    async (from: number, reset: boolean) => {
      const gen = reset ? ++generation.current : generation.current
      const result = await queryCatalog({
        search,
        status: 'active',
        categoryId,
        stockStatus: 'all',
        price: !on && missingAt === 'any' ? 'none' : undefined,
        sort: { field: 'name', direction: 'asc' },
        offset: from,
        limit: PAGE,
        allBranches: true,
        madeHere: 'include',
      })
      if (gen !== generation.current) return
      let next = result.rows.map(toProduct)
      if (on && missingAt) next = next.filter((product) => priceInList(product, missingAt).unitPrice == null)
      setTotal(result.total)
      setLoaded(from + result.rows.length)
      setRows((current) => (reset ? next : [...current, ...next]))
    },
    [search, categoryId, missingAt, on],
  )
  useEffect(() => {
    if (catalog.phase === 'ready') void load(0, true)
  }, [load, catalog.phase, catalog.version])

  const columns: PriceGroup[] = on ? groups.filter((group) => group.listId) : [{ listId: undefined, branches: groups.flatMap((g) => g.branches) }]
  const isFor = (product: Product, group: PriceGroup) =>
    !on || product.forAllBranches !== false || group.branches.some((branch) => (product.forBranchIds ?? []).includes(branch.id))
  const valueOf = (product: Product, group: PriceGroup) => values[cellKey(product.id, group.listId)] ?? shown(product, group)
  const unitLabel = (product: Product) => {
    const code = rowUnit(product) ?? product.unitOfMeasure
    return units.find((unit) => unit.code === code)?.label ?? code ?? '—'
  }
  const columnName = (group: PriceGroup) => (on ? group.branches.map((branch) => branch.name).join(', ') : 'Price')

  /** Sends cells; on success the sheet keeps what was typed and the catalogue catches up. */
  async function save(cells: Cell[], said: string, undo: Cell[]) {
    if (cells.length === 0) return
    setSaving((n) => n + 1)
    try {
      await api.put('/api/prices', { cells })
      setLast({ said, undo })
      void syncCatalog().catch(() => {})
    } catch (error) {
      showToast(isAppError(error) ? error.message : "Couldn't save that price. Try again.", 'error')
      // Put the cells back as they were, so the sheet never shows a price that wasn't saved.
      setValues((current) => {
        const next = { ...current }
        for (const cell of cells) {
          const product = rows.find((row) => row.id === cell.productId)
          const group = columns.find((column) => (column.listId ? column.branches[0]?.id === cell.branchId : !cell.branchId))
          if (product && group) next[cellKey(product.id, group.listId)] = shown(product, group)
        }
        return next
      })
    } finally {
      setSaving((n) => n - 1)
    }
  }

  const toCell = (product: Product, group: PriceGroup, typed: string): Cell | 'bad' => {
    const clean = typed.replace(/[₦,\s]/g, '')
    if (clean !== '' && !(Number(clean) >= 0)) return 'bad'
    return {
      productId: product.id,
      branchId: group.listId ? group.branches[0]?.id : undefined,
      price: clean === '' ? null : Number(clean),
      unit: rowUnit(product),
    }
  }

  /** A cell left: saved when it changed. */
  function commit(product: Product, group: PriceGroup) {
    const typed = valueOf(product, group)
    const before = shown(product, group)
    if (typed.replace(/[₦,\s]/g, '') === before) return
    const cell = toCell(product, group, typed)
    if (cell === 'bad') {
      showToast(`Type the price of ${product.name} as a number, or leave it blank.`, 'error')
      setValues((current) => ({ ...current, [cellKey(product.id, group.listId)]: before }))
      return
    }
    const undo = toCell(product, group, before) as Cell
    const where = on ? ` at ${columnName(group)}` : ''
    void save([cell], cell.price == null ? `${product.name}${where}: no price now` : `Saved: ${product.name}${where}, ${formatMoney(cell.price)}`, [undo])
  }

  /** A column pasted from a spreadsheet: one value a row, down from this cell, over the rows it can go in. */
  function paste(event: React.ClipboardEvent<HTMLInputElement>, from: number, group: PriceGroup) {
    const lines = event.clipboardData.getData('text').split(/\r?\n/).map((line) => line.split('\t')[0].trim())
    while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
    if (lines.length < 2) return
    event.preventDefault()
    const cells: Cell[] = []
    const undo: Cell[] = []
    const next = { ...values }
    let index = from
    for (const typed of lines) {
      while (index < rows.length && !isFor(rows[index], group)) index += 1
      if (index >= rows.length) break
      const product = rows[index]
      const cell = toCell(product, group, typed)
      if (cell !== 'bad') {
        next[cellKey(product.id, group.listId)] = typed
        cells.push(cell)
        undo.push(toCell(product, group, shown(product, group)) as Cell)
      }
      index += 1
    }
    setValues(next)
    void save(cells, `Pasted ${cells.length} prices${on ? ` into ${columnName(group)}` : ''}`, undo)
  }

  /** Enter and the arrows move like a spreadsheet. */
  function move(event: React.KeyboardEvent<HTMLInputElement>, row: number, column: number) {
    const go = (r: number, c: number) => {
      const target = document.querySelector<HTMLInputElement>(`[data-cell="${r}:${c}"]`)
      if (!target) return false
      event.preventDefault()
      target.focus()
      target.select()
      return true
    }
    const input = event.currentTarget
    if (event.key === 'Enter' || event.key === 'ArrowDown') {
      for (let r = row + 1; r < rows.length; r += 1) if (go(r, column)) return
    } else if (event.key === 'ArrowUp') {
      for (let r = row - 1; r >= 0; r -= 1) if (go(r, column)) return
    } else if (event.key === 'ArrowRight' && input.selectionStart === input.value.length) {
      go(row, column + 1)
    } else if (event.key === 'ArrowLeft' && input.selectionStart === 0) {
      go(row, column - 1)
    } else if (event.key === 'Escape') {
      const product = rows[row]
      const group = columns[column]
      setValues((current) => ({ ...current, [cellKey(product.id, group.listId)]: shown(product, group) }))
    }
  }

  async function undoLast() {
    if (!last) return
    const undo = last.undo
    setLast(null)
    setValues((current) => {
      const next = { ...current }
      for (const cell of undo) {
        const group = columns.find((column) => (column.listId ? column.branches[0]?.id === cell.branchId : !cell.branchId))
        if (group) next[cellKey(cell.productId, group.listId)] = cell.price == null ? '' : String(cell.price)
      }
      return next
    })
    await save(undo, 'Put back', [])
  }

  const cellInput = (product: Product, group: PriceGroup, row: number, column: number) =>
    isFor(product, group) ? (
      <input
        data-cell={`${row}:${column}`}
        aria-label={`${product.name}${on ? ` at ${columnName(group)}` : ''}`}
        inputMode="decimal"
        disabled={!online}
        value={valueOf(product, group)}
        onChange={(event) => setValues((current) => ({ ...current, [cellKey(product.id, group.listId)]: event.target.value }))}
        onBlur={() => commit(product, group)}
        onKeyDown={(event) => move(event, row, column)}
        onPaste={(event) => paste(event, row, group)}
        onFocus={(event) => event.currentTarget.select()}
        placeholder="No price"
        className={`h-9 w-full min-w-0 bg-transparent px-2.5 text-right text-sm tabular-nums outline-none placeholder:text-neutral-400 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:ring-inset disabled:cursor-not-allowed ${
          valueOf(product, group) === '' ? '' : 'font-medium text-neutral-900'
        }`}
      />
    ) : (
      <span className="block px-2.5 text-right text-xs text-neutral-400">Not for {group.branches.map((b) => b.name).join(', ')}</span>
    )

  const phoneGroup = columns.find((group) => group.listId === phoneColumn) ?? columns[0]
  const phoneIndex = columns.indexOf(phoneGroup)

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate('/app/products')}
          aria-label="Back"
          className="rounded-md p-1.5 text-neutral-600 hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-neutral-900 lg:text-2xl">Price sheet</h1>
          <p className="text-sm text-neutral-600">
            {on
              ? 'A column for each branch’s prices. Blank: no price there yet. Enter goes down; paste a column from Excel.'
              : 'Every product’s price. Enter goes down; paste a column from Excel.'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 basis-48 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
          <input
            type="search"
            aria-label="Search products"
            placeholder="Search products"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-md border border-neutral-300 bg-white py-1.5 pr-3 pl-8 text-sm"
          />
        </label>
        <select
          aria-label="Category"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm"
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Show"
          value={missingAt}
          onChange={(event) => setMissingAt(event.target.value)}
          className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm"
        >
          <option value="">Every product</option>
          {on ? (
            columns.map((group) => (
              <option key={group.listId} value={group.listId}>
                No price at {columnName(group)}
              </option>
            ))
          ) : (
            <option value="any">No price yet</option>
          )}
        </select>
      </div>

      {!online && (
        <p className="rounded-md bg-warning-50 px-3 py-2 text-sm text-warning-800">Prices are saved online: connect to change them.</p>
      )}
      {catalog.phase !== 'ready' && <p className="text-sm text-neutral-500">Getting your products onto this device…</p>}

      {/* Laptop: the whole sheet. */}
      <div className="hidden overflow-x-auto rounded-lg border border-neutral-200 bg-white sm:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-neutral-50 text-left text-xs font-medium text-neutral-600">
              <th className="sticky left-0 z-10 border-b border-neutral-200 bg-neutral-50 px-3 py-2">Product</th>
              <th className="border-b border-l border-neutral-200 px-3 py-2">Unit</th>
              {columns.map((group) => (
                <th
                  key={group.listId ?? 'one'}
                  className={`min-w-36 border-b border-l border-neutral-200 px-3 py-2 text-right ${group.listId === focusList ? 'bg-primary-50 text-primary-800' : ''}`}
                >
                  {columnName(group)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((product, row) => (
              <tr key={product.id} className="odd:bg-white even:bg-neutral-50/40">
                <td className="sticky left-0 z-10 max-w-64 truncate border-b border-neutral-100 bg-inherit px-3 py-1.5 font-medium text-neutral-900">
                  {product.name}
                </td>
                <td className="border-b border-l border-neutral-100 px-3 py-1.5 whitespace-nowrap text-neutral-500">{unitLabel(product)}</td>
                {columns.map((group, column) => (
                  <td key={group.listId ?? 'one'} className="border-b border-l border-neutral-100 p-0">
                    {cellInput(product, group, row, column)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phone: one column at a time. */}
      <div className="flex flex-col gap-2 sm:hidden">
        {on && columns.length > 1 && (
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Prices at">
            {columns.map((group) => (
              <button
                key={group.listId}
                type="button"
                role="tab"
                aria-selected={group === phoneGroup}
                onClick={() => setPhoneColumn(group.listId)}
                className={`rounded-full border px-3 py-1 text-sm ${
                  group === phoneGroup ? 'border-primary-300 bg-primary-50 font-medium text-primary-800' : 'border-neutral-300 bg-white text-neutral-700'
                }`}
              >
                {columnName(group)}
              </button>
            ))}
          </div>
        )}
        <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
          {rows.map((product, row) => (
            <li key={product.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-neutral-900">{product.name}</span>
                <span className="block text-xs text-neutral-500">per {unitLabel(product)}</span>
              </span>
              <span className="w-32 shrink-0 rounded-md border border-neutral-300">{phoneGroup && cellInput(product, phoneGroup, row, phoneIndex)}</span>
            </li>
          ))}
        </ul>
      </div>

      {rows.length === 0 && catalog.phase === 'ready' && <p className="text-sm text-neutral-500">No products match.</p>}
      {loaded < total && (
        <button
          type="button"
          onClick={() => void load(loaded, false)}
          className="self-start rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
        >
          Show more ({total - loaded} more)
        </button>
      )}

      <div aria-live="polite" className="min-h-6 text-sm">
        {saving > 0 ? (
          <span className="text-neutral-500">Saving…</span>
        ) : last ? (
          <span className="text-accent-700">
            {last.said}
            {last.undo.length > 0 && (
              <>
                {' · '}
                <button type="button" onClick={() => void undoLast()} className="font-semibold underline">
                  Undo
                </button>
              </>
            )}
          </span>
        ) : null}
      </div>
    </div>
  )
}
