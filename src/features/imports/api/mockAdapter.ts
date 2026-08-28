/**
 * In-memory stand-in for `/api/imports`, so the whole import experience can be built and looked
 * at before a byte of backend exists.
 *
 * M5 wired `importsApi` to real axios calls and KEPT this file: it is the only way to work on an
 * import screen without a running backend, and the fixtures below are more useful than anything
 * a stub could produce. It is reached only when `IMPORTS_MOCK_ENABLED` is true — that is
 * `import.meta.env.DEV` (a literal `false` in a production build, so this module is folded out
 * of the bundle) AND `VITE_IMPORTS_MOCK=true` in your `.env`. Nothing outside `api/` imports it,
 * and no component knows it exists — that is the point.
 *
 * It is deliberately more than a stub: it re-validates a row after an edit, collapses a bulk
 * fix across every row sharing a value, and composes preview/result prose server-side-style, so
 * the screens are exercised against realistic behaviour rather than static JSON.
 *
 * State survives a reload via sessionStorage so "Save & finish later", a refresh mid-review and
 * a shared link can all actually be tried.
 */
import type { AppError } from '@/types/api'
import { GRID_PAGE_SIZE, MAX_ROWS } from '@/features/imports/constants'
import type {
  CommitLine,
  CommitPreview,
  ImportCellValue,
  ImportFieldDescriptor,
  ImportKind,
  ImportMode,
  ImportResult,
  ImportRow,
  ImportRowError,
  ImportRowFilterStatus,
  ImportRowStatus,
  ImportRowWarning,
  ImportSession,
  ImportSessionSummary,
  Page,
  UndoBlockedResponse,
  UnresolvedValue,
  ValueMappingRequest,
} from '@/features/imports/types'

// ------------------------------------------------------------------ helpers

const STORAGE_KEY = 'pp.imports.mock.v1'

function delay<T>(value: T, ms = 220): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

function fail(status: number, message: string, extra: Record<string, unknown> = {}): never {
  const error: AppError & Record<string, unknown> = { status, message, ...extra }
  throw error
}

function iso(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString()
}

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

function newId(): string {
  return crypto.randomUUID()
}

// ------------------------------------------------------------ field catalog

function text(key: string, label: string, required = false, helpText: string | null = null): ImportFieldDescriptor {
  return { key, label, type: 'TEXT', required, readOnly: false, primaryInput: false, helpText, options: null }
}

function money(key: string, label: string, helpText: string | null = null): ImportFieldDescriptor {
  return { key, label, type: 'MONEY', required: false, readOnly: false, primaryInput: false, helpText, options: null }
}

function number(key: string, label: string, helpText: string | null = null): ImportFieldDescriptor {
  return { key, label, type: 'NUMBER', required: false, readOnly: false, primaryInput: false, helpText, options: null }
}

const BASE_UNITS = [
  { value: 'PIECE', label: 'Piece' },
  { value: 'KG', label: 'Kilogram (kg)' },
  { value: 'G', label: 'Gram (g)' },
  { value: 'LITER', label: 'Litre (L)' },
  { value: 'ML', label: 'Millilitre (ml)' },
  { value: 'M', label: 'Metre (m)' },
]

const PACKAGING_UNITS = [
  { value: 'BAG', label: 'Bag' },
  { value: 'CARTON', label: 'Carton' },
  { value: 'CRATE', label: 'Crate' },
  { value: 'SACK', label: 'Sack' },
  { value: 'PACK', label: 'Pack' },
]

const PRODUCT_FIELDS: ImportFieldDescriptor[] = [
  text('name', 'Product name', true, 'What you call it on the shelf.'),
  text('sku', 'SKU', true, 'Your own code for this product. Repeat it on the next row to add a second supplier.'),
  text('description', 'Description'),
  money('unit_price', 'Selling price'),
  money('cost_price', 'Cost price', 'What you pay for one unit.'),
  number('quantity_on_hand', 'Opening stock', 'Only counts on a row that creates a new product.'),
  number('low_stock_threshold', 'Low stock alert at'),
  {
    key: 'unit_of_measure',
    label: 'Unit of measure',
    type: 'ENUM',
    required: true,
    readOnly: false,
    primaryInput: false,
    helpText: 'What one unit of this product is measured in.',
    options: BASE_UNITS,
  },
  {
    key: 'packaging_unit',
    label: 'Packaging',
    type: 'ENUM',
    required: false,
    readOnly: false,
    primaryInput: false,
    helpText: 'How it arrives — a bag, a carton, a crate.',
    options: PACKAGING_UNITS,
  },
  number('packaging_size', 'Units per pack', 'A 50kg bag is 50.'),
  text('vendor_name', 'Supplier', false, 'Pick from your supplier list, or type a new one.'),
  text('vendor_sku', "Supplier's code"),
  {
    key: 'is_preferred_vendor',
    label: 'Preferred supplier',
    type: 'BOOLEAN',
    required: false,
    readOnly: false,
    primaryInput: false,
    helpText: 'TRUE on the supplier you buy from by default. Only one per product.',
    options: null,
  },
]

const STOCK_IN_FIELDS: ImportFieldDescriptor[] = [
  { ...text('sku', 'SKU', true), readOnly: true },
  { ...text('product_name', 'Product'), readOnly: true },
  text('vendor_name', 'Supplier', false, 'Who this delivery came from.'),
  {
    key: 'quantity',
    label: 'Quantity received',
    type: 'NUMBER',
    required: false,
    readOnly: false,
    primaryInput: true,
    helpText: 'Leave blank for anything that did not arrive — we skip those rows.',
    options: null,
  },
  {
    key: 'unit',
    label: 'Unit',
    type: 'ENUM',
    required: false,
    readOnly: false,
    primaryInput: false,
    helpText: 'What the quantity is counted in.',
    options: [...BASE_UNITS, ...PACKAGING_UNITS],
  },
  money('unit_cost', 'Cost per unit'),
  number('packaging_size', 'Units per pack'),
  {
    key: 'received_date',
    label: 'Date received',
    type: 'DATE',
    required: false,
    readOnly: false,
    primaryInput: false,
    helpText: 'When the delivery actually arrived, not today.',
    options: null,
  },
  text('reference', 'Invoice or waybill no.'),
]

function fieldsFor(kind: ImportKind): ImportFieldDescriptor[] {
  return kind === 'STOCK_IN' ? STOCK_IN_FIELDS : PRODUCT_FIELDS
}

// ----------------------------------------------------------------- fixtures

interface Store {
  sessions: Record<string, ImportSession>
  rows: Record<string, ImportRow[]>
  results: Record<string, ImportResult>
  history: ImportSessionSummary[]
}

const VENDORS = [
  { id: 'v-dangote', label: 'Dangote Nigeria Plc' },
  { id: 'v-adefoods', label: 'Ade Foods Ltd' },
  { id: 'v-honeywell', label: 'Honeywell Flour Mills' },
  { id: 'v-golden', label: 'Golden Penny Foods' },
]

const CATALOG = [
  ['RICE-50', 'Rice 50kg', 'KG', 'BAG', 50],
  ['GARRI-25', 'Garri 25kg', 'KG', 'BAG', 25],
  ['OIL-5L', 'Groundnut Oil 5L', 'LITER', 'CARTON', 12],
  ['BEANS-100', 'Brown Beans 100kg', 'KG', 'SACK', 100],
  ['SUGAR-50', 'Granulated Sugar 50kg', 'KG', 'BAG', 50],
  ['FLOUR-50', 'Wheat Flour 50kg', 'KG', 'BAG', 50],
  ['SALT-1', 'Table Salt 1kg', 'KG', 'PACK', 24],
  ['MILK-400', 'Powdered Milk 400g', 'G', 'CARTON', 24],
  ['TOM-70', 'Tomato Paste 70g', 'G', 'CARTON', 100],
  ['SPAG-500', 'Spaghetti 500g', 'G', 'CARTON', 20],
  ['SEM-10', 'Semovita 10kg', 'KG', 'BAG', 10],
  ['YAM-1', 'Yam Tuber', 'PIECE', 'CRATE', 20],
] as const

function catalogEntry(index: number) {
  return CATALOG[index % CATALOG.length]
}

function emptyRow(id: string, excelRow: number): ImportRow {
  return {
    id,
    excelRow,
    status: 'SKIPPED',
    raw: {},
    normalized: {},
    errors: [],
    warnings: [],
    resolvedEntityId: null,
    resolvedEntityLabel: null,
    continuationOf: null,
    outcome: null,
  }
}

function productRow(
  excelRow: number,
  index: number,
  overrides: Partial<ImportRow> = {},
): ImportRow {
  const [sku, name, unit, packaging, packSize] = catalogEntry(index)
  const suffix = index >= CATALOG.length ? `-${Math.floor(index / CATALOG.length) + 1}` : ''
  const raw: Record<string, ImportCellValue> = {
    name: suffix ? `${name} (${VENDORS[index % VENDORS.length].label.split(' ')[0]})` : name,
    sku: `${sku}${suffix}`,
    description: '',
    unit_price: null,
    cost_price: 18000 + index * 250,
    quantity_on_hand: index % 3 === 0 ? 40 + index : null,
    low_stock_threshold: 10,
    unit_of_measure: unit,
    packaging_unit: packaging,
    packaging_size: packSize,
    vendor_name: VENDORS[index % VENDORS.length].label,
    vendor_sku: `${sku}-${index}`,
    is_preferred_vendor: index % VENDORS.length === 0 ? 'TRUE' : '',
  }
  return {
    id: newId(),
    excelRow,
    status: 'VALID',
    raw,
    normalized: { ...raw },
    errors: [],
    warnings: [],
    resolvedEntityId: null,
    resolvedEntityLabel: null,
    continuationOf: null,
    outcome: null,
    ...overrides,
  }
}

function unitError(rawValue: string, bulkFixCount: number): ImportRowError {
  return {
    column: 'unit_of_measure',
    message: `We don't recognise "${rawValue}" as a unit. Did you mean Kilogram (kg)?`,
    suggestion: { value: 'KG', label: 'Kilogram (kg)' },
    bulkFixCount,
  }
}

function missingUnitError(productName: string): ImportRowError {
  return {
    column: 'unit_of_measure',
    message: `Every product needs a unit of measure — what is ${productName} measured in?`,
    suggestion: null,
    bulkFixCount: null,
  }
}

const IGNORED_QUANTITY_WARNING: ImportRowWarning = {
  column: 'quantity_on_hand',
  message:
    'This product already exists, so the quantity on this row is ignored. Add stock with Record stock you received instead.',
}

function buildCleanRows(count: number): ImportRow[] {
  const rows: ImportRow[] = []
  for (let i = 0; i < count; i += 1) rows.push(productRow(i + 2, i))
  return rows
}

function buildMessyRows(): ImportRow[] {
  const rows: ImportRow[] = []
  let excel = 2
  let index = 0

  // A healthy opening stretch, including a §7.1 continuation row.
  for (let i = 0; i < 6; i += 1) rows.push(productRow(excel++, index++))

  const parent = rows[1]
  const continuation = productRow(excel++, 1, {
    continuationOf: parent.excelRow,
  })
  continuation.raw = {
    ...continuation.raw,
    name: '',
    description: '',
    unit_of_measure: '',
    packaging_unit: '',
    packaging_size: null,
    quantity_on_hand: null,
    cost_price: 17200,
    vendor_name: 'Ade Foods Ltd',
    vendor_sku: 'AF-GARRI-25',
    is_preferred_vendor: '',
  }
  continuation.normalized = { ...continuation.raw }
  rows.push(continuation)

  // Eight rows that spelled the unit "KGS" — the bulk-fix showcase.
  for (let i = 0; i < 8; i += 1) {
    const row = productRow(excel++, index++)
    row.raw.unit_of_measure = 'KGS'
    row.normalized.unit_of_measure = null
    row.status = 'ERROR'
    row.errors = [unitError('KGS', 8)]
    rows.push(row)
  }

  // Two rows with no unit at all — the copy rule's headline example.
  for (let i = 0; i < 2; i += 1) {
    const row = productRow(excel++, index++)
    row.raw.unit_of_measure = ''
    row.normalized.unit_of_measure = null
    row.status = 'ERROR'
    row.errors = [missingUnitError(String(row.raw.name))]
    rows.push(row)
  }

  // A repeated SKU with the same supplier — a real duplicate, not a continuation row.
  const duplicate = productRow(excel++, 0)
  duplicate.status = 'ERROR'
  duplicate.errors = [
    {
      column: 'sku',
      message: `Row ${rows[0].excelRow} already uses the code ${String(duplicate.raw.sku)} for the same supplier. Give this one its own code, or name a different supplier to add a second supplier line.`,
      suggestion: null,
      bulkFixCount: null,
    },
  ]
  rows.push(duplicate)

  // Two suppliers both marked preferred.
  const preferredClash = productRow(excel++, index++)
  preferredClash.raw.is_preferred_vendor = 'TRUE'
  preferredClash.normalized.is_preferred_vendor = 'TRUE'
  preferredClash.status = 'ERROR'
  preferredClash.errors = [
    {
      column: 'is_preferred_vendor',
      message: 'Two suppliers on this product are both marked preferred. Only one can be.',
      suggestion: null,
      bulkFixCount: null,
    },
  ]
  rows.push(preferredClash)

  // Four rows that update an existing product and carry a quantity — non-negotiable #8.
  for (let i = 0; i < 4; i += 1) {
    const row = productRow(excel++, index++)
    row.raw.quantity_on_hand = 120 + i * 10
    row.normalized.quantity_on_hand = null
    row.status = 'WARNING'
    row.warnings = [IGNORED_QUANTITY_WARNING]
    row.resolvedEntityLabel = String(row.raw.name)
    rows.push(row)
  }

  // Three rows naming a supplier we cannot match, one naming another.
  for (let i = 0; i < 3; i += 1) {
    const row = productRow(excel++, index++)
    row.raw.vendor_name = 'Dangote Ltd'
    row.normalized.vendor_name = null
    rows.push(row)
  }
  const otherVendorRow = productRow(excel++, index++)
  otherVendorRow.raw.vendor_name = 'Ade & Sons'
  otherVendorRow.normalized.vendor_name = null
  rows.push(otherVendorRow)

  // The rest of a normal file.
  for (let i = 0; i < 16; i += 1) rows.push(productRow(excel++, index++))

  // Two blank lines someone left at the bottom.
  rows.push(emptyRow(newId(), excel++))
  rows.push(emptyRow(newId(), excel++))

  return rows
}

function buildStockInRows(): ImportRow[] {
  const rows: ImportRow[] = []
  let excel = 2

  for (let i = 0; i < CATALOG.length; i += 1) {
    const [sku, name, unit, packaging] = catalogEntry(i)
    const filled = i < 8
    const raw: Record<string, ImportCellValue> = {
      sku,
      product_name: name,
      vendor_name: VENDORS[i % VENDORS.length].label,
      quantity: filled ? 20 + i * 5 : null,
      unit: packaging || unit,
      unit_cost: 18500 + i * 300,
      packaging_size: null,
      received_date: '2026-08-14',
      reference: filled ? `WB-40${i}` : '',
    }
    rows.push({
      id: newId(),
      excelRow: excel++,
      // Blank quantity is a silent skip, never an error (contract §8.11).
      status: filled ? 'VALID' : 'SKIPPED',
      raw,
      normalized: { ...raw },
      errors: [],
      warnings: [],
      resolvedEntityId: filled ? `p-${sku}` : null,
      resolvedEntityLabel: name,
      continuationOf: null,
      outcome: null,
    })
  }

  // A unit this product is not stocked in — the error names the two that are (spec §8.3).
  const wrongUnit = rows[0]
  wrongUnit.raw.unit = 'CARTON'
  wrongUnit.normalized.unit = null
  wrongUnit.status = 'ERROR'
  wrongUnit.errors = [
    {
      column: 'unit',
      message: 'Rice 50kg is stocked in Kilogram (kg) or Bag. Pick one of those.',
      suggestion: { value: 'BAG', label: 'Bag' },
      bulkFixCount: null,
    },
  ]

  // A delivery date in the future.
  const futureDate = rows[3]
  futureDate.raw.received_date = '2027-01-04'
  futureDate.normalized.received_date = null
  futureDate.status = 'ERROR'
  futureDate.errors = [
    {
      column: 'received_date',
      message: "That date hasn't happened yet. When did this delivery actually arrive?",
      suggestion: null,
      bulkFixCount: null,
    },
  ]

  // Two rows typed at the bottom for something not in the catalog yet (spec §6.7).
  const newItem: ImportRow = {
    id: newId(),
    excelRow: excel++,
    status: 'ERROR',
    raw: {
      sku: 'PALM-25',
      product_name: 'Palm Oil 25L',
      vendor_name: 'Ade Foods Ltd',
      quantity: 30,
      unit: 'CARTON',
      unit_cost: 42000,
      packaging_size: null,
      received_date: '2026-08-14',
      reference: 'WB-412',
    },
    normalized: {
      sku: null,
      product_name: 'Palm Oil 25L',
      vendor_name: 'Ade Foods Ltd',
      quantity: 30,
      unit: 'CARTON',
      unit_cost: 42000,
      packaging_size: null,
      received_date: '2026-08-14',
      reference: 'WB-412',
    },
    errors: [
      {
        column: 'sku',
        message: "You don't stock anything with the code PALM-25 yet. Create it, or leave this delivery line out.",
        suggestion: null,
        bulkFixCount: null,
      },
    ],
    warnings: [],
    resolvedEntityId: null,
    resolvedEntityLabel: null,
    continuationOf: null,
    outcome: null,
  }
  rows.push(newItem)

  return rows
}

function messyUnresolvedValues(): UnresolvedValue[] {
  return [
    {
      column: 'vendor_name',
      columnLabel: 'Supplier',
      value: 'Dangote Ltd',
      rowCount: 3,
      excelRows: [],
      kind: 'VENDOR',
      suggestions: [
        { id: 'v-dangote', label: 'Dangote Nigeria Plc', hint: '31 products', score: 0.86 },
        { id: 'v-golden', label: 'Golden Penny Foods', hint: '8 products', score: 0.21 },
      ],
      allowCreateNew: true,
      allowBlank: true,
      allowSkipRows: false,
      resolution: null,
    },
    {
      column: 'vendor_name',
      columnLabel: 'Supplier',
      value: 'Ade & Sons',
      rowCount: 1,
      excelRows: [],
      kind: 'VENDOR',
      suggestions: [{ id: 'v-adefoods', label: 'Ade Foods Ltd', hint: '12 products', score: 0.44 }],
      allowCreateNew: true,
      allowBlank: true,
      allowSkipRows: false,
      resolution: null,
    },
  ]
}

function stockInUnresolvedValues(): UnresolvedValue[] {
  return [
    {
      column: 'sku',
      columnLabel: 'Product',
      value: 'PALM-25',
      rowCount: 1,
      excelRows: [],
      kind: 'PRODUCT',
      suggestions: [{ id: 'p-OIL-5L', label: 'Groundnut Oil 5L', hint: 'OIL-5L', score: 0.31 }],
      allowCreateNew: true,
      allowBlank: false,
      allowSkipRows: true,
      resolution: null,
    },
  ]
}

// --------------------------------------------------------------- the store

function seedHistory(): ImportSessionSummary[] {
  return [
    {
      id: 'hist-1',
      kind: 'PRODUCT_CATALOG',
      status: 'COMMITTED',
      originalFilename: 'products-jan.xlsx',
      rowCount: 42,
      createdCount: 38,
      updatedCount: 4,
      summaryText: '38 created, 4 updated',
      uploadedByName: 'Ada Obi',
      createdAt: iso(-2 * DAY),
      committedAt: iso(-2 * DAY + 4 * 60 * 1000),
      undoable: true,
    },
    {
      id: 'hist-2',
      kind: 'STOCK_IN',
      status: 'COMMITTED',
      originalFilename: 'july-deliveries.xlsx',
      rowCount: 18,
      createdCount: 0,
      updatedCount: 18,
      summaryText: '18 deliveries recorded, 22 rows left blank',
      uploadedByName: 'Tunde Bello',
      createdAt: iso(-9 * DAY),
      committedAt: iso(-9 * DAY),
      undoable: false,
    },
  ]
}

function blankStore(): Store {
  return { sessions: {}, rows: {}, results: {}, history: seedHistory() }
}

/**
 * Lazily built, never at module load.
 *
 * `let store = load()` here would be a module-level side effect (it touches sessionStorage), and
 * a module with a side effect cannot be tree-shaken — which meant this whole file rode into the
 * production bundle and read sessionStorage on every page load even though `IMPORTS_MOCK_ENABLED`
 * is a literal `false` there. Deferring it makes the module side-effect free, so Rollup drops it.
 */
let store: Store | null = null

function state(): Store {
  store ??= load()
  return store
}

function load(): Store {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return blankStore()
    return JSON.parse(raw) as Store
  } catch {
    return blankStore()
  }
}

function save(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state()))
  } catch {
    /* private mode, quota — the mock still works for the life of the tab */
  }
}

function requireSession(id: string): ImportSession {
  const found = state().sessions[id]
  if (!found) fail(404, "We couldn't find that upload. It may have expired.")
  return found
}

// ------------------------------------------------------- validation (mock)

function isBlank(value: ImportCellValue): boolean {
  return value === null || value === undefined || String(value).trim() === ''
}

/**
 * Just enough re-validation to make an edit feel real: an error clears when the cell it points
 * at now holds an acceptable value. The real thing runs on the server (contract §2).
 */
function revalidate(row: ImportRow, fields: ImportFieldDescriptor[]): ImportRow {
  const remaining = row.errors.filter((error) => {
    const field = fields.find((f) => f.key === error.column)
    const value = row.normalized[error.column]
    if (isBlank(value)) return true
    if (field?.type === 'ENUM' && field.options) {
      return !field.options.some((option) => option.value === String(value))
    }
    return false
  })

  const status: ImportRowStatus =
    row.status === 'SKIPPED'
      ? 'SKIPPED'
      : remaining.length > 0
        ? 'ERROR'
        : row.warnings.length > 0
          ? 'WARNING'
          : 'VALID'

  return { ...row, errors: remaining, status }
}

function recount(session: ImportSession, rows: ImportRow[]): ImportSession {
  return {
    ...session,
    rowCount: rows.length,
    validCount: rows.filter((r) => r.status === 'VALID').length,
    errorCount: rows.filter((r) => r.status === 'ERROR').length,
    warningCount: rows.filter((r) => r.status === 'WARNING').length,
    skippedCount: rows.filter((r) => r.status === 'SKIPPED').length,
    status: rows.some((r) => r.status === 'ERROR') || session.unresolvedValues.some((v) => !v.resolution)
      ? 'NEEDS_REVIEW'
      : 'READY',
  }
}

function persist(session: ImportSession, rows: ImportRow[]): ImportSession {
  const counted = recount(session, rows)
  state().sessions[counted.id] = counted
  state().rows[counted.id] = rows
  save()
  return counted
}

// ------------------------------------------------------------- fixture pick

export type MockFixture = 'CLEAN' | 'MESSY' | 'STOCK_IN' | 'TOO_MANY_ROWS' | 'EXPIRED' | 'NEEDS_MAPPING'

/**
 * Which fixture an uploaded file lands on. Keyed off the filename so a real file dragged in
 * during development still exercises whichever case you want, and so the DEV fixture picker on
 * the upload screen can name a case without a second code path.
 */
export function fixtureFor(filename: string, kind: ImportKind): MockFixture {
  const name = filename.toLowerCase()
  if (name.includes('huge') || name.includes('toobig') || name.includes('5200')) return 'TOO_MANY_ROWS'
  if (name.includes('expired')) return 'EXPIRED'
  if (name.includes('supplier') || name.includes('pricelist') || name.includes('mapping')) return 'NEEDS_MAPPING'
  if (kind === 'STOCK_IN') return 'STOCK_IN'
  if (name.includes('messy') || name.includes('error') || name.includes('bad')) return 'MESSY'
  return 'CLEAN'
}

function buildSession(
  fixture: MockFixture,
  filename: string,
  kind: ImportKind,
  mode: ImportMode,
): { session: ImportSession; rows: ImportRow[] } {
  const id = newId()
  const fields = fieldsFor(kind)
  const columnMapping: Record<string, string | null> = {}
  for (const field of fields) columnMapping[field.key] = field.key

  let rows: ImportRow[]
  let unresolvedValues: UnresolvedValue[] = []
  let needsMapping = false
  let unmappedHeaders: string[] = []
  let requiredFieldsMissing: string[] = []

  switch (fixture) {
    case 'MESSY':
      rows = buildMessyRows()
      unresolvedValues = messyUnresolvedValues()
      break
    case 'STOCK_IN':
      rows = buildStockInRows()
      unresolvedValues = stockInUnresolvedValues()
      break
    case 'NEEDS_MAPPING': {
      rows = buildCleanRows(24)
      needsMapping = true
      // A real supplier's price list, headed the way a supplier heads one. Starting from the
      // identity map and deleting a few keys was quicker to write and put `unit_price` and
      // `is_preferred_vendor` on screen under "Your column" — this screen's whole job is to sit
      // between the user's vocabulary and ours, so a fixture that hands it our field keys as the
      // user's own headers is the one shape that cannot test it.
      for (const key of Object.keys(columnMapping)) delete columnMapping[key]
      columnMapping['Item code'] = 'sku'
      columnMapping['Description'] = 'description'
      columnMapping['List price'] = 'unit_price'
      columnMapping['Qty'] = 'quantity_on_hand'
      columnMapping['Re-order level'] = 'low_stock_threshold'
      columnMapping['Units per pack'] = 'packaging_size'
      columnMapping['Supplied by'] = 'vendor_name'
      columnMapping["Supplier's ref"] = 'vendor_sku'
      columnMapping['Main supplier?'] = 'is_preferred_vendor'
      unmappedHeaders = ['Item description', 'Trade price', 'Pack', 'Notes']
      requiredFieldsMissing = ['name', 'unit_of_measure']
      break
    }
    case 'EXPIRED':
      rows = []
      break
    default:
      rows = buildCleanRows(38)
  }

  // The stock-in sheet arrives pre-filled, so unresolved rows come with the sheet.
  for (const value of unresolvedValues) {
    value.excelRows = rows
      .filter((row) => String(row.raw[value.column] ?? '') === value.value)
      .map((row) => row.excelRow)
    value.rowCount = value.excelRows.length || value.rowCount
  }

  const session: ImportSession = {
    id,
    kind,
    mode: kind === 'STOCK_IN' ? 'CREATE_ONLY' : mode,
    status: fixture === 'EXPIRED' ? 'EXPIRED' : 'NEEDS_REVIEW',
    originalFilename: filename,
    rowCount: rows.length,
    validCount: 0,
    errorCount: 0,
    warningCount: 0,
    skippedCount: 0,
    needsMapping,
    columnMapping,
    unmappedHeaders,
    requiredFieldsMissing,
    fields,
    unresolvedValues,
    uploadedByName: 'Ada Obi',
    createdAt: iso(0),
    expiresAt: iso(fixture === 'EXPIRED' ? -HOUR : 48 * HOUR),
    committedAt: null,
  }

  if (fixture === 'EXPIRED') {
    state().sessions[id] = session
    state().rows[id] = rows
    save()
    return { session, rows }
  }

  return { session: persist(session, rows), rows }
}

// ------------------------------------------------------------ preview/commit

function previewLines(session: ImportSession, rows: ImportRow[]): CommitLine[] {
  const live = rows.filter((r) => r.status !== 'SKIPPED')
  const skipped = rows.length - live.length

  if (session.kind === 'STOCK_IN') {
    const quantity = live.reduce((sum, r) => sum + Number(r.normalized.quantity ?? 0), 0)
    const suppliers = new Set(live.map((r) => String(r.normalized.vendor_name ?? ''))).size
    const cost = live.reduce(
      (sum, r) => sum + Number(r.normalized.quantity ?? 0) * Number(r.normalized.unit_cost ?? 0),
      0,
    )
    return [
      { key: 'record', label: 'Record', count: live.length, text: `${live.length} deliveries across ${live.length} products` },
      { key: 'quantity', label: 'Quantity', count: quantity, text: `${quantity.toLocaleString('en-NG')} units received in total` },
      { key: 'suppliers', label: 'Suppliers', count: suppliers, text: `${suppliers} suppliers, dated 14 Aug` },
      { key: 'skip', label: 'Skip', count: skipped, text: `${skipped} rows left blank, so nothing is recorded for them` },
      {
        key: 'cost',
        label: 'Total cost',
        count: Math.round(cost),
        text: `₦${Math.round(cost).toLocaleString('en-NG')} added to your cost of stock`,
      },
    ]
  }

  const updates = live.filter((r) => r.resolvedEntityLabel !== null).length
  const creates = live.length - updates
  const newVendors = session.unresolvedValues.filter((v) => v.resolution?.kind === 'CREATE_NEW').length
  const withOpening = live.filter(
    (r) => r.resolvedEntityLabel === null && Number(r.normalized.quantity_on_hand ?? 0) > 0,
  )
  const openingUnits = withOpening.reduce((sum, r) => sum + Number(r.normalized.quantity_on_hand ?? 0), 0)

  // Zero lines are omitted, not rendered as "0 rows you marked as skipped" — the confirm screen
  // is prose, and prose does not list things that are not happening.
  const lines: CommitLine[] = [
    { key: 'create', label: 'Create', count: creates, text: `${creates} new products` },
  ]
  if (updates > 0) {
    lines.push({ key: 'update', label: 'Update', count: updates, text: `${updates} existing products` })
  }
  if (skipped > 0) {
    lines.push({ key: 'skip', label: 'Skip', count: skipped, text: `${skipped} rows you marked as skipped` })
  }
  if (newVendors > 0) {
    lines.push({
      key: 'vendors',
      label: 'Suppliers',
      count: newVendors,
      text: `${newVendors} new suppliers will be added to your directory`,
    })
  }
  if (withOpening.length > 0) {
    lines.push({
      key: 'stock',
      label: 'Stock',
      count: withOpening.length,
      text: `Opening balance of ${openingUnits.toLocaleString('en-NG')} kg recorded across ${withOpening.length} products`,
    })
  }
  return lines
}

/** The recent-imports one-liner, composed where the server would compose it (contract §4). */
function composeSummaryText(result: ImportResult): string {
  const parts: string[] = []
  if (result.createdCount > 0) parts.push(`${result.createdCount} created`)
  if (result.updatedCount > 0) parts.push(`${result.updatedCount} updated`)
  if (result.skippedCount > 0) parts.push(`${result.skippedCount} skipped`)
  return parts.length > 0 ? parts.join(', ') : `${result.createdCount + result.updatedCount} rows`
}

function buildResult(session: ImportSession, rows: ImportRow[]): ImportResult {
  const live = rows.filter((r) => r.status !== 'SKIPPED')
  const updated = live.filter((r) => r.resolvedEntityLabel !== null).length
  const created = live.length - updated
  const skipped = rows.length - live.length
  const vendorsCreated = session.unresolvedValues.filter((v) => v.resolution?.kind === 'CREATE_NEW').length
  const isStockIn = session.kind === 'STOCK_IN'
  // Only rows that actually created a product with a quantity write an opening-balance movement
  // (spec §6.7: opening balance is only ever available on a row that creates a product).
  const openingRows = live.filter(
    (r) => r.resolvedEntityLabel === null && Number(r.normalized.quantity_on_hand ?? 0) > 0,
  ).length

  const lines: CommitLine[] = isStockIn
    ? [
        { key: 'record', label: 'Recorded', count: live.length, text: `${live.length} deliveries recorded` },
        { key: 'skip', label: 'Skipped', count: skipped, text: `${skipped} rows were blank` },
      ]
    : [
        { key: 'create', label: 'Created', count: created, text: `${created} products created` },
        ...(updated > 0
          ? [{ key: 'update', label: 'Updated', count: updated, text: `${updated} products updated` }]
          : []),
        ...(vendorsCreated > 0
          ? [
              {
                key: 'vendors',
                label: 'Suppliers',
                count: vendorsCreated,
                text: `${vendorsCreated} suppliers added to your directory`,
              },
            ]
          : []),
        ...(openingRows > 0
          ? [
              {
                key: 'stock',
                label: 'Stock',
                count: openingRows,
                text: `Opening stock recorded for ${openingRows} products`,
              },
            ]
          : []),
      ]

  return {
    sessionId: session.id,
    status: 'COMMITTED',
    headline: isStockIn ? `Recorded ${live.length} deliveries` : `Imported ${live.length} rows`,
    lines,
    createdCount: created,
    updatedCount: updated,
    skippedCount: skipped,
    failedCount: 0,
    vendorsCreated,
    productsCreated: isStockIn ? 1 : created,
    movementsCreated: isStockIn ? live.length : openingRows,
    undoable: true,
    undoBlockedReason: null,
    reportUrl: `/api/imports/${session.id}/report`,
    targetUrl: '/app/products',
  }
}

// -------------------------------------------------------------- the adapter

/**
 * Every method that can `fail()` before it returns is `async`.
 *
 * `requireSession` throws synchronously, and the callers do `importsApi.get(id).then(...).catch(...)`
 * inside a `useEffect` — so a throw at *call* time happened before the `.catch` was ever
 * attached, escaped the effect, and white-screened the whole route with no error boundary in the
 * app to catch it. Every ordinary "that upload is gone" path — a stale link, a new tab, an
 * expired record — hit it. `async` turns the same throw into the rejected promise the real axios
 * client always produced, which is what the screens' error states were written against.
 */
export const mockAdapter = {
  reset(): void {
    store = blankStore()
    save()
  },

  async create(
    file: File,
    kind: ImportKind,
    mode: ImportMode,
    onProgress?: (pct: number) => void,
  ): Promise<ImportSession> {
    // Reported, not ignored: the upload progress bar is otherwise unobservable without a real
    // server, which is how it stayed unstyled long enough for M5 to have to flag it.
    if (onProgress) {
      for (const pct of [0, 18, 46, 74, 100]) {
        onProgress(pct)
        await delay(null, 90)
      }
    }
    const fixture = fixtureFor(file.name, kind)
    if (fixture === 'TOO_MANY_ROWS') {
      return delay(null, 400).then(() =>
        fail(
          400,
          `This file has 5,200 rows — the limit is ${MAX_ROWS.toLocaleString('en-NG')}. Split it into two files and upload them one after the other.`,
        ),
      )
    }
    const { session } = buildSession(fixture, file.name, kind, mode)
    return delay(session, 650)
  },

  async get(id: string): Promise<ImportSession> {
    return delay(requireSession(id))
  },

  async rows(
    id: string,
    params: { status?: ImportRowFilterStatus; page?: number; size?: number },
  ): Promise<Page<ImportRow>> {
    requireSession(id)
    const all = state().rows[id] ?? []
    const status = params.status ?? 'ALL'
    // ISSUES is ERROR+WARNING in one correctly-paged response (contract §3) — the review
    // screen's default view, so it is the server's job to page it, not the client's to merge.
    const filtered =
      status === 'ALL'
        ? all
        : status === 'ISSUES'
          ? all.filter((row) => row.status === 'ERROR' || row.status === 'WARNING')
          : all.filter((row) => row.status === status)
    const size = params.size ?? GRID_PAGE_SIZE
    const page = params.page ?? 0
    const content = filtered.slice(page * size, page * size + size)
    return delay({
      content,
      totalElements: filtered.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / size)),
      number: page,
      size,
      first: page === 0,
      last: (page + 1) * size >= filtered.length,
    })
  },

  async patchRow(id: string, rowId: string, normalized: Record<string, ImportCellValue>): Promise<ImportRow> {
    const session = requireSession(id)
    const rows = state().rows[id] ?? []
    const index = rows.findIndex((row) => row.id === rowId)
    if (index < 0) fail(404, "We couldn't find that row.")

    const updated = revalidate(
      { ...rows[index], normalized: { ...rows[index].normalized, ...normalized } },
      session.fields,
    )
    rows[index] = updated
    persist(session, rows)
    return delay(updated, 180)
  },

  async skipRow(id: string, rowId: string, skipped: boolean): Promise<ImportRow> {
    const session = requireSession(id)
    const rows = state().rows[id] ?? []
    const index = rows.findIndex((row) => row.id === rowId)
    if (index < 0) fail(404, "We couldn't find that row.")

    const base = { ...rows[index], status: skipped ? ('SKIPPED' as ImportRowStatus) : ('VALID' as ImportRowStatus) }
    const updated = skipped ? base : revalidate(base, session.fields)
    rows[index] = updated
    persist(session, rows)
    return delay(updated, 160)
  },

  async patchMapping(id: string, columnMapping: Record<string, string | null>): Promise<ImportSession> {
    const session = requireSession(id)
    const rows = state().rows[id] ?? []
    const mappedFields = new Set(Object.values(columnMapping).filter(Boolean) as string[])
    const stillMissing = session.fields.filter((f) => f.required && !mappedFields.has(f.key)).map((f) => f.key)
    const next: ImportSession = {
      ...session,
      columnMapping,
      requiredFieldsMissing: stillMissing,
      needsMapping: stillMissing.length > 0,
      unmappedHeaders: Object.entries(columnMapping)
        .filter(([, field]) => field === null)
        .map(([header]) => header),
    }
    return delay(persist(next, rows), 500)
  },

  async resolveValue(id: string, body: ValueMappingRequest): Promise<ImportSession> {
    const session = requireSession(id)
    const rows = state().rows[id] ?? []

    const to = body.to
    let literal: string | null = null
    if (to.kind === 'EXISTING') {
      const targetId = to.id
      literal =
        session.unresolvedValues
          .find((v) => v.column === body.column && v.value === body.from)
          ?.suggestions.find((s) => s.id === targetId)?.label ?? body.from
    } else if (to.kind === 'LITERAL') {
      literal = to.value
    } else if (to.kind === 'CREATE_NEW') {
      literal = body.from
    }

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i]
      if (String(row.raw[body.column] ?? '') !== body.from) continue
      if (to.kind === 'SKIP_ROWS') {
        rows[i] = { ...row, status: 'SKIPPED' }
        continue
      }
      rows[i] = revalidate(
        { ...row, normalized: { ...row.normalized, [body.column]: literal } },
        session.fields,
      )
    }

    const next: ImportSession = {
      ...session,
      unresolvedValues: session.unresolvedValues.map((value) =>
        value.column === body.column && value.value === body.from ? { ...value, resolution: body.to } : value,
      ),
    }
    return delay(persist(next, rows), 320)
  },

  async preview(id: string): Promise<CommitPreview> {
    const session = requireSession(id)
    const rows = state().rows[id] ?? []
    const live = rows.filter((r) => r.status !== 'SKIPPED')
    const blocked = rows.some((r) => r.status === 'ERROR')
    const isStockIn = session.kind === 'STOCK_IN'

    return delay({
      headline: isStockIn
        ? `Record ${live.length} deliveries from ${session.originalFilename}`
        : `Import ${live.length} rows from ${session.originalFilename}`,
      lines: previewLines(session, rows),
      confirmLabel: isStockIn ? `Record ${live.length} deliveries` : `Import ${live.length} rows`,
      blocked,
      blockedReason: blocked ? 'Some rows still need fixing before this can run.' : null,
    })
  },

  async commit(id: string): Promise<ImportResult> {
    const session = requireSession(id)
    if (session.status === 'COMMITTED') {
      const existing = state().results[id]
      if (existing) return delay(existing)
    }
    const rows = state().rows[id] ?? []
    const committed = rows.map((row) => ({
      ...row,
      status: (row.status === 'SKIPPED' ? 'SKIPPED' : 'COMMITTED') as ImportRowStatus,
      outcome: (row.status === 'SKIPPED'
        ? 'SKIPPED'
        : row.resolvedEntityLabel
          ? 'UPDATED'
          : 'CREATED') as ImportRow['outcome'],
    }))
    const result = buildResult(session, rows)
    state().sessions[id] = { ...session, status: 'COMMITTED', committedAt: iso(0) }
    state().rows[id] = committed
    state().results[id] = result
    state().history = [
      {
        id,
        kind: session.kind,
        status: 'COMMITTED',
        originalFilename: session.originalFilename,
        rowCount: session.rowCount,
        createdCount: result.createdCount,
        updatedCount: result.updatedCount,
        // Composed here because the server composes it (contract §4) — the list never
        // string-builds a count of its own.
        summaryText: composeSummaryText(result),
        uploadedByName: session.uploadedByName,
        createdAt: session.createdAt,
        committedAt: iso(0),
        undoable: true,
      },
      ...state().history,
    ]
    save()
    return delay(result, 900)
  },

  async result(id: string): Promise<ImportResult> {
    const existing = state().results[id]
    if (!existing) fail(404, "We couldn't find the report for that import.")
    return delay(existing)
  },

  async undo(id: string): Promise<ImportResult> {
    const session = requireSession(id)
    const rows = state().rows[id] ?? []
    if (session.kind === 'STOCK_IN') {
      const blockers = rows
        .filter((row) => row.status !== 'SKIPPED')
        .slice(0, 3)
        .map((row) => ({
          excelRow: row.excelRow,
          label: String(row.raw.product_name ?? row.raw.name ?? 'Product'),
          reason: 'Already sold from',
          entityId: row.resolvedEntityId ?? 'p-unknown',
        }))
      const body: UndoBlockedResponse = {
        message: `${blockers.length} of these ${rows.filter((r) => r.status !== 'SKIPPED').length} deliveries have already been sold from, so this import can't be undone all at once.`,
        blockers,
      }
      return delay(null, 400).then(() => fail(409, body.message, { undoBlocked: body }))
    }

    const result = state().results[id]
    if (!result) fail(404, "We couldn't find that import.")
    const undone: ImportResult = {
      ...result,
      headline: 'This import has been undone',
      lines: [
        { key: 'reverted', label: 'Reverted', count: result.createdCount, text: `${result.createdCount} products removed again` },
        { key: 'restored', label: 'Restored', count: result.updatedCount, text: `${result.updatedCount} products put back as they were` },
      ],
      undoable: false,
      undoBlockedReason: null,
    }
    state().results[id] = undone
    state().history = state().history.map((entry) => (entry.id === id ? { ...entry, undoable: false } : entry))
    save()
    return delay(undone, 700)
  },

  discard(id: string): Promise<void> {
    delete state().sessions[id]
    delete state().rows[id]
    save()
    return delay(undefined, 200)
  },

  list(params: { kind?: ImportKind; page?: number; size?: number }): Promise<Page<ImportSessionSummary>> {
    const uncommitted: ImportSessionSummary[] = Object.values(state().sessions)
      .filter((s) => s.status !== 'COMMITTED')
      .map((s) => ({
        id: s.id,
        kind: s.kind,
        status: s.status,
        originalFilename: s.originalFilename,
        rowCount: s.rowCount,
        createdCount: null,
        updatedCount: null,
        summaryText:
          s.errorCount > 0
            ? `${s.rowCount} rows, ${s.errorCount} still need attention`
            : `${s.rowCount} rows, ready to import`,
        uploadedByName: s.uploadedByName,
        createdAt: s.createdAt,
        committedAt: null,
        undoable: false,
      }))

    const all = [...uncommitted, ...state().history]
      .filter((entry) => !params.kind || entry.kind === params.kind)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

    const size = params.size ?? 5
    const page = params.page ?? 0
    return delay({
      content: all.slice(page * size, page * size + size),
      totalElements: all.length,
      totalPages: Math.max(1, Math.ceil(all.length / size)),
      number: page,
      size,
      first: page === 0,
      last: (page + 1) * size >= all.length,
    })
  },
}
