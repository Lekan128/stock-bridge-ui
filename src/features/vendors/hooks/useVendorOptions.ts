import { useCallback } from 'react'
import { queryKeys } from '@/data/queryKeys'
import { useApiQuery } from '@/data/useApiQuery'
import { vendorsApi } from '@/features/vendors/api/vendorsApi'
import type { CompanyVendor } from '@/features/vendors/types'

const NO_VENDORS: CompanyVendor[] = []

function byName(a: CompanyVendor, b: CompanyVendor): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
}

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
 *
 * `upsert` applies a supplier the caller just created (via `SupplierField`'s "+ Add new supplier")
 * so it is selectable immediately, without waiting on a second fetch of the whole 200-row list —
 * the same shape `useCompanyCategories` already gives the category picker.
 */
export function useVendorOptions(enabled: boolean) {
  const result = useApiQuery<CompanyVendor[]>({
    queryKey: queryKeys.vendors.options,
    queryFn: () => vendorsApi.list({ page: 0, size: 200 }).then((response) => response.content),
    fallbackError: 'Could not load your suppliers.',
    enabled,
  })
  const { setData } = result

  const upsert = useCallback(
    (vendor: CompanyVendor) => {
      setData((current) => [...(current ?? []).filter((entry) => entry.id !== vendor.id), vendor].sort(byName))
    },
    [setData],
  )

  // A failed load still reads as "no suppliers" here, as before: the pickers that use this offer
  // "+ Add new supplier" either way.
  return { vendors: enabled ? (result.data ?? NO_VENDORS) : NO_VENDORS, loading: result.loading, upsert }
}
