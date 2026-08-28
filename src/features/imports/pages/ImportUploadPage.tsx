import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Download, Lock, Upload } from 'lucide-react'
import { PERMISSIONS, type Permission } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { Button, buttonClassName } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { useToast } from '@/components/useToast'
import { IMPORTS_MOCK_ENABLED, importsApi } from '@/features/imports/api/importsApi'
import { DevFixtureBar } from '@/features/imports/components/DevFixtureBar'
import { ImportDropzone } from '@/features/imports/components/ImportDropzone'
import { ImportModeChoice } from '@/features/imports/components/ImportModeChoice'
import { ImportStepFrame } from '@/features/imports/components/ImportStepFrame'
import { RecentImportsList } from '@/features/imports/components/RecentImportsList'
import { copy } from '@/features/imports/copy'
import type { ImportKind, ImportMode } from '@/features/imports/types'
import { isAppError } from '@/types/api'

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
  const [mode, setMode] = useState<ImportMode>('CREATE_ONLY')
  const [uploading, setUploading] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(0)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isStockIn = kind === 'STOCK_IN'

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
   * A template is an authenticated binary, so it is fetched with the bearer token and saved from
   * an object URL — a bare `<a href>` would send no credentials and answer 401.
   */
  async function handleDownloadTemplate() {
    setDownloading(true)
    try {
      if (isStockIn) await importsApi.downloadStockInTemplate({ productIds, filter: 'ALL' })
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
      const created = await importsApi.create(candidate, kind, mode, setUploadPercent)
      navigate(`/app/products/import/${created.id}`, { replace: true })
    } catch (err: unknown) {
      setError(isAppError(err) ? err.message : 'We could not read that file. Please try again.')
      setUploading(false)
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

        {error && <ErrorState variant="inline" message={error} />}

        <p className="text-sm text-neutral-600">
          <span className="font-medium text-neutral-800">{copy.upload.templateLead}</span>{' '}
          <button
            type="button"
            onClick={() => void handleDownloadTemplate()}
            disabled={downloading}
            className="inline-flex items-center gap-1 rounded-md font-medium text-primary-700 underline underline-offset-2 hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-60"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            {isStockIn ? copy.upload.stockInTemplateLink : copy.upload.templateLink}
          </button>{' '}
          {isStockIn ? copy.upload.stockInTemplateTail : copy.upload.templateTail}
        </p>

        {/* Meaningless for a delivery — the contract persists CREATE_ONLY and ignores it (§1). */}
        {!isStockIn && <ImportModeChoice value={mode} onChange={setMode} disabled={uploading} />}

        <div className="flex justify-end">
          <Button
            disabled={!file}
            loading={uploading}
            onClick={() => file && void handleUpload(file)}
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            {uploading ? copy.upload.checking : copy.upload.submit}
          </Button>
        </div>

        {/* Gated on the mock, not merely on DEV: against a real API these fixture buttons would
          hand the server a six-byte file with a fixture's name on it. */}
        {IMPORTS_MOCK_ENABLED && (
          <DevFixtureBar
            onPick={(fixtureFile) => {
              setFile(fixtureFile)
              setError(null)
            }}
          />
        )}

        <RecentImportsList kind={kind} />
      </div>
    </ImportStepFrame>
  )
}
