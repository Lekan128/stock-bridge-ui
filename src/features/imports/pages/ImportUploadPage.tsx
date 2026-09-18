import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ClipboardPaste, Download, Lock, Upload } from 'lucide-react'
import { PERMISSIONS, type Permission } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { Button, buttonClassName } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { TextField } from '@/components/TextField'
import { ErrorState } from '@/components/ErrorState'
import { useToast } from '@/components/useToast'
import { importsApi } from '@/features/imports/api/importsApi'
import { ImportDropzone } from '@/features/imports/components/ImportDropzone'
import { ImportStepFrame } from '@/features/imports/components/ImportStepFrame'
import { RecentImportsList } from '@/features/imports/components/RecentImportsList'
import { copy } from '@/features/imports/copy'
import type { ImportKind, ImportMode, StockInFilter } from '@/features/imports/types'
import { productsApi } from '@/features/products/api/productsApi'
import { useCompanyCategories } from '@/features/products/categories/useCompanyCategories'
import { useVendorOptions } from '@/features/vendors/hooks/useVendorOptions'
import { isAppError } from '@/types/api'
import { downloadBlob } from '@/utils/downloadBlob'

const SELECT_CLASS =
  'w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none disabled:bg-neutral-50'

/** Today in the user's own timezone, as the `YYYY-MM-DD` a date input holds. */
function todayIso(): string {
  return new Date().toLocaleDateString('en-CA')
}

function kindFromSearch(value: string | null): ImportKind {
  return value === 'STOCK_IN' ? 'STOCK_IN' : 'PRODUCT_CATALOG'
}

/** Bulk-import contract §3 — the kind-specific authority the service re-checks server-side. */
const KIND_PERMISSION: Record<ImportKind, Permission> = {
  PRODUCT_CATALOG: PERMISSIONS.MANAGE_PRODUCTS,
  STOCK_IN: PERMISSIONS.MANAGE_INVENTORY,
}

/**
 * Step 1 (spec §9.2).
 *
 * Three things are answered before a byte is uploaded: what the limits are, where the template
 * comes from, and what should happen to a product that already exists. The last one is a
 * validation input, not a preference, which is why it lives here and not on the review screen.
 */
export function ImportUploadPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { user } = useAuth()
  const kind = kindFromSearch(searchParams.get('kind'))
  const permissions = user?.type === 'tenant' ? user.permissions : []
  const allowed = permissions.includes(KIND_PERMISSION[kind])

  /**
   * The product list's "Stock in selected" hands its selection over in the URL, so the sheet
   * downloaded here covers exactly the rows that were ticked (contract §3's `productIds`, which
   * wins over `filter`). Absent — arriving from the chooser — it falls back to the whole active
   * catalog.
   */
  const productIds = (searchParams.get('productIds') ?? '').split(',').filter(Boolean)

  const [file, setFile] = useState<File | null>(null)
  /**
   * Always "create". A product that already exists is changed by uploading a sheet from Download
   * my products - its hidden Ref says which product each row is (BULK_IMPORT_CX_PLAN.md task 2.3)
   * - so there is no "if a product already exists" question to ask.
   */
  const mode: ImportMode = 'CREATE_ONLY'
  const [uploading, setUploading] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(0)
  const [downloading, setDownloading] = useState(false)
  const [downloadingProducts, setDownloadingProducts] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Task 3.2: the rows on someone's clipboard, offered beside the dropzone rather than elsewhere. */
  const [pasting, setPasting] = useState(false)
  const [pastedText, setPastedText] = useState('')
  const [checkingPaste, setCheckingPaste] = useState(false)

  const isStockIn = kind === 'STOCK_IN'

  /*
   * BULK_IMPORT_CX_PLAN.md task 1.5. Which products the stock sheet lists, and the delivery's
   * date, invoice and supplier — asked once here instead of on every row of the sheet.
   */
  const canSeeSuppliers = permissions.includes(PERMISSIONS.VIEW_VENDORS)
  const { vendors } = useVendorOptions(isStockIn && canSeeSuppliers)
  const [sheetScope, setSheetScope] = useState<StockInFilter>('ALL')
  const [sheetVendorId, setSheetVendorId] = useState('')
  const [deliveryDate, setDeliveryDate] = useState(todayIso)
  const [invoiceNo, setInvoiceNo] = useState('')
  const [deliveryVendorId, setDeliveryVendorId] = useState('')
  // A storekeeper here holds MANAGE_INVENTORY; the category list needs VIEW_PRODUCTS, which every
  // role has today but is checked anyway, the same way suppliers are.
  const canSeeCategories = permissions.includes(PERMISSIONS.VIEW_PRODUCTS)
  const { categories, loading: loadingCategories } = useCompanyCategories(isStockIn && canSeeCategories)
  const [sheetCategoryId, setSheetCategoryId] = useState('')
  const sheetNeedsChoice =
    (sheetScope === 'BY_VENDOR' && sheetVendorId === '') || (sheetScope === 'BY_CATEGORY' && sheetCategoryId === '')

  /**
   * The chooser already hides the card this user cannot use, so reaching here means a bookmark,
   * a shared link, or a hand-typed `?kind=`. Saying so is better than bouncing them to the
   * chooser, where the missing card would explain nothing.
   */
  if (!allowed) {
    return (
      <ImportStepFrame step={0} title={copy.upload.title(kind)}>
        <EmptyState
          icon={Lock}
          title={copy.upload.notAllowedTitle(kind)}
          description={copy.upload.notAllowedBody}
          action={
            <Link to="/app/products/import" className={buttonClassName('secondary')}>
              {copy.common.back}
            </Link>
          }
        />
      </ImportStepFrame>
    )
  }

  /**
   * "Download my products": the catalog as an editable sheet whose hidden Ref finds each product
   * again on the way back in. Authenticated like the template below, and saved the same way.
   */
  async function handleDownloadMyProducts() {
    setDownloadingProducts(true)
    try {
      downloadBlob(await productsApi.export(), 'my-products.xlsx')
    } catch {
      showToast('We could not fetch your products. Please try again.', 'error')
    } finally {
      setDownloadingProducts(false)
    }
  }

  /**
   * A template is an authenticated binary, so it is fetched with the bearer token and saved from
   * an object URL — a bare `<a href>` would send no credentials and answer 401.
   */
  async function handleDownloadTemplate() {
    setDownloading(true)
    try {
      if (isStockIn) {
        await importsApi.downloadStockInTemplate({
          productIds,
          filter: sheetScope,
          vendorId: sheetVendorId,
          categoryId: sheetCategoryId,
        })
      }
      else await importsApi.downloadProductTemplate()
    } catch {
      showToast('We could not fetch that template. Please try again.', 'error')
    } finally {
      setDownloading(false)
    }
  }

  async function handleUpload(candidate: File) {
    setUploading(true)
    setUploadPercent(0)
    setError(null)
    try {
      const created = await importsApi.create(
        candidate,
        kind,
        mode,
        setUploadPercent,
        isStockIn
          ? { deliveryDate, invoiceNo: invoiceNo.trim() || undefined, vendorId: deliveryVendorId || undefined }
          : undefined,
      )
      navigate(`/app/products/import/${created.id}`, { replace: true })
    } catch (err: unknown) {
      setError(isAppError(err) ? err.message : 'We could not read that file. Please try again.')
      setUploading(false)
    }
  }

  /**
   * The pasted block becomes the same session an uploaded file becomes, so this lands on the
   * review screen exactly where an upload lands.
   */
  async function handlePaste() {
    setCheckingPaste(true)
    setError(null)
    try {
      const created = await importsApi.createFromPaste({
        text: pastedText,
        kind,
        mode,
        ...(isStockIn
          ? { deliveryDate, invoiceNo: invoiceNo.trim() || undefined, vendorId: deliveryVendorId || undefined }
          : {}),
      })
      navigate(`/app/products/import/${created.id}`, { replace: true })
    } catch (err: unknown) {
      setError(isAppError(err) ? err.message : copy.upload.pasteFailed)
      setCheckingPaste(false)
    }
  }

  return (
    <ImportStepFrame
      step={0}
      title={copy.upload.title(kind)}
      subtitle={
        <Link
          to="/app/products/import"
          className="rounded-md text-primary-700 underline underline-offset-2 hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          {copy.common.back}
        </Link>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Step 1. Above the dropzone, because it comes first — see copy.upload.stepDownload. */}
        <section aria-labelledby="import-step-download">
          <h2 id="import-step-download" className="text-sm font-semibold text-neutral-900">
            {copy.upload.stepDownload}
          </h2>
          <div className="mt-2 flex flex-col gap-3 rounded-lg border border-primary-200 bg-primary-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-primary-900">
              {isStockIn ? copy.upload.stockInTemplateBody : copy.upload.templateBody}
            </p>
            <Button
              variant="secondary"
              className="shrink-0"
              loading={downloading}
              disabled={isStockIn && productIds.length === 0 && sheetNeedsChoice}
              onClick={() => void handleDownloadTemplate()}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {isStockIn ? copy.upload.stockInTemplateLink : copy.upload.templateLink}
            </Button>
            </div>
            {isStockIn && productIds.length > 0 && (
              <p className="text-xs text-primary-900">{copy.upload.sheetScopeSelected(productIds.length)}</p>
            )}
            {isStockIn && productIds.length === 0 && (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-xs font-medium text-primary-900">{copy.upload.sheetScopeLabel}</legend>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {(
                    [
                      ['ALL', copy.upload.sheetScopeAll],
                      ...(canSeeSuppliers ? [['BY_VENDOR', copy.upload.sheetScopeSupplier]] : []),
                      ...(canSeeCategories ? [['BY_CATEGORY', copy.upload.sheetScopeCategory]] : []),
                      ['LOW_STOCK', copy.upload.sheetScopeLowStock],
                    ] as [StockInFilter, string][]
                  ).map(([value, label]) => (
                    <label key={value} className="flex items-center gap-2 text-sm text-neutral-800">
                      <input
                        type="radio"
                        name="sheet-scope"
                        value={value}
                        checked={sheetScope === value}
                        onChange={() => setSheetScope(value)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                      />
                      {label}
                    </label>
                  ))}
                </div>
                {sheetScope === 'BY_VENDOR' && (
                  <div className="max-w-sm">
                    <label htmlFor="sheet-supplier" className="sr-only">
                      {copy.upload.sheetSupplierLabel}
                    </label>
                    <select
                      id="sheet-supplier"
                      value={sheetVendorId}
                      onChange={(event) => setSheetVendorId(event.target.value)}
                      className={SELECT_CLASS}
                    >
                      <option value="">{copy.upload.sheetSupplierPlaceholder}</option>
                      {vendors.map((vendor) => (
                        <option key={vendor.id} value={vendor.id}>
                          {vendor.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {sheetScope === 'BY_CATEGORY' && (
                  <div className="max-w-sm">
                    <label htmlFor="sheet-category" className="sr-only">
                      {copy.upload.sheetCategoryLabel}
                    </label>
                    <select
                      id="sheet-category"
                      value={sheetCategoryId}
                      onChange={(event) => setSheetCategoryId(event.target.value)}
                      disabled={!loadingCategories && categories.length === 0}
                      aria-describedby={
                        !loadingCategories && categories.length === 0 ? 'sheet-category-none' : undefined
                      }
                      className={SELECT_CLASS}
                    >
                      <option value="">{copy.upload.sheetCategoryPlaceholder}</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    {!loadingCategories && categories.length === 0 && (
                      <p id="sheet-category-none" className="mt-1.5 text-xs text-primary-900">
                        {copy.upload.sheetCategoryNone}
                      </p>
                    )}
                  </div>
                )}
              </fieldset>
            )}
          </div>
          <p className="mt-2 text-xs text-neutral-500">{copy.upload.alreadyHaveFile}</p>
          {!isStockIn && (
            <p className="mt-1 text-xs text-neutral-500">
              {copy.upload.editExistingPrompt}{' '}
              <button
                type="button"
                onClick={() => void handleDownloadMyProducts()}
                disabled={downloadingProducts}
                className="rounded font-medium text-primary-700 underline underline-offset-2 hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-60"
              >
                {copy.upload.editExistingLink}
              </button>
              {copy.upload.editExistingRest}
            </p>
          )}
        </section>

        {isStockIn && (
          <section aria-labelledby="import-step-delivery" className="flex flex-col gap-3">
            <div>
              <h2 id="import-step-delivery" className="text-sm font-semibold text-neutral-900">
                {copy.upload.stepDelivery}
              </h2>
              <p className="mt-0.5 text-xs text-neutral-500">{copy.upload.deliveryBody}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField
                id="delivery-date"
                type="date"
                label={copy.upload.deliveryDate}
                value={deliveryDate}
                max={todayIso()}
                required
                disabled={uploading}
                onChange={(event) => setDeliveryDate(event.target.value)}
              />
              <TextField
                id="delivery-invoice"
                label={copy.upload.invoiceNo}
                hint={copy.upload.invoiceHint}
                value={invoiceNo}
                maxLength={200}
                disabled={uploading}
                onChange={(event) => setInvoiceNo(event.target.value)}
              />
              {canSeeSuppliers && (
                <div>
                  <label htmlFor="delivery-supplier" className="mb-1.5 block text-sm font-medium text-neutral-700">
                    {copy.upload.deliverySupplier}
                  </label>
                  <select
                    id="delivery-supplier"
                    value={deliveryVendorId}
                    disabled={uploading}
                    onChange={(event) => setDeliveryVendorId(event.target.value)}
                    className={SELECT_CLASS}
                  >
                    <option value="">{copy.upload.deliverySupplierAny}</option>
                    {vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-neutral-500">{copy.upload.deliverySupplierHint}</p>
                </div>
              )}
            </div>
          </section>
        )}

        <section aria-labelledby="import-step-upload" className="flex flex-col gap-3">
          <h2 id="import-step-upload" className="text-sm font-semibold text-neutral-900">
            {isStockIn ? copy.upload.stockInStepUpload : copy.upload.stepUpload}
          </h2>
          {!pasting && (
            <ImportDropzone
              file={file}
              disabled={uploading}
              uploadPercent={uploading ? uploadPercent : null}
              onSelect={(picked) => {
                setError(null)
                setFile(picked)
              }}
              onReject={(message) => {
                setFile(null)
                setError(message)
              }}
              onClear={() => setFile(null)}
            />
          )}

          {pasting && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="import-paste" className="text-sm font-medium text-neutral-700">
                {copy.upload.pasteLabel}
              </label>
              <p id="import-paste-hint" className="text-xs text-neutral-500">
                {copy.upload.pasteHint}
              </p>
              <textarea
                id="import-paste"
                rows={8}
                value={pastedText}
                disabled={checkingPaste}
                aria-describedby="import-paste-hint"
                onChange={(event) => {
                  setError(null)
                  setPastedText(event.target.value)
                }}
                placeholder={copy.upload.pastePlaceholder}
                className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 font-mono text-base text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none disabled:bg-neutral-50 sm:text-sm"
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setError(null)
              setPasting((was) => !was)
            }}
            className="self-start rounded-sm text-sm font-medium text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            {pasting ? copy.upload.pasteHide : copy.upload.pasteToggle}
          </button>

          {error && <ErrorState variant="inline" message={error} />}
        </section>

        <div className="flex justify-end">
          {pasting ? (
            <Button
              disabled={pastedText.trim() === '' || (isStockIn && deliveryDate === '')}
              loading={checkingPaste}
              onClick={() => void handlePaste()}
            >
              <ClipboardPaste className="h-4 w-4" aria-hidden="true" />
              {checkingPaste ? copy.upload.pasteChecking : copy.upload.pasteSubmit}
            </Button>
          ) : (
            <Button
              disabled={!file || (isStockIn && deliveryDate === '')}
              loading={uploading}
              onClick={() => file && void handleUpload(file)}
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              {uploading ? copy.upload.checking : copy.upload.submit}
            </Button>
          )}
        </div>

        <RecentImportsList kind={kind} />
      </div>
    </ImportStepFrame>
  )
}
