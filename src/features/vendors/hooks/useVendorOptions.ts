import { useEffect, useState } from 'react'
import { vendorsApi } from '@/features/vendors/api/vendorsApi'
import type { CompanyVendor } from '@/features/vendors/types'

/**
 * The company's active vendors, flattened for a `<select>` on the product form.
 *
 * Fetched as one large page rather than paged, because a picker is not a browsable list: a buyer
 * choosing a supplier wants to find the one they mean, and paging a dropdown hides the option they
 * were looking for behind a control nobody expects in a select. Two hundred covers a real supplier
 * directory comfortably; a company past that has outgrown a plain select and needs a typeahead,
 * which is a different component and not one this module invents speculatively.
 *
 * `enabled` is false for a caller without VIEW_VENDORS — the request would be a 403, and asking
 * for it just to discard the answer would put a red herring in everyone's network tab. The form
 * hides the field in that case rather than rendering an empty picker that looks broken.
 *
 * A failure is deliberately swallowed into an empty list rather than surfaced. This is one
 * optional field on somebody else's form: a vendor directory that will not load must not stop a
 * product being saved.
 */
export function useVendorOptions(enabled: boolean) {
  const [vendors, setVendors] = useState<CompanyVendor[]>([])
  const [loading, setLoading] = useState(enabled)

  useEffect(() => {
    if (!enabled) {
      setVendors([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)

    vendorsApi
      .list({ page: 0, size: 200 })
      .then((response) => {
        if (!cancelled) setVendors(response.content)
      })
      .catch(() => {
        if (!cancelled) setVendors([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [enabled])

  return { vendors, loading }
}
