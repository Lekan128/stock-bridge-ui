import { useCallback, useState } from 'react'
import { useAnalyticsResource } from '@/features/marketplace/analytics/hooks/useAnalyticsResource'
import { vendorStatementApi } from '@/features/vendor/api/vendorStatementApi'
import type { VendorRangeParams, VendorStatement } from '@/features/vendor/types'
import { isAppError } from '@/types/api'

/**
 * The statement itself. Reuses `useAnalyticsResource` like the own-sales hooks do, for the
 * same two behaviours: `refetch` so an error state can offer Retry, and keeping the previous
 * data while a new range is in flight so moving the date control does not blank the page.
 */
export function useVendorStatement(params: VendorRangeParams) {
  return useAnalyticsResource<VendorRangeParams, VendorStatement>(vendorStatementApi.statement, params)
}

/**
 * The CSV download, as an action rather than a resource.
 *
 * Deliberately not a `useAnalyticsResource`: a download is something a reader ASKS for, and a
 * hook that fetched on mount would pull the whole statement twice on every page load and
 * every range change.
 *
 * The object URL is revoked immediately after the click. Browsers keep the blob alive for the
 * duration of the download regardless, and leaving it uncollected would pin the file in
 * memory for the life of the tab — which on a vendor who exports a year of statements is a
 * real leak rather than a theoretical one.
 */
export function useStatementDownload() {
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const download = useCallback(async (params: VendorRangeParams, filename: string) => {
    setDownloading(true)
    setError(null)
    try {
      const blob = await vendorStatementApi.exportCsv(params)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      setError(isAppError(err) ? err.message : 'The statement could not be downloaded. Please try again.')
    } finally {
      setDownloading(false)
    }
  }, [])

  return { download, downloading, error }
}
