import { useEffect, useState } from 'react'
import { companyApi } from '@/features/company/api/companyApi'
import type { Company } from '@/features/company/types'
import { isAppError } from '@/types/api'

/** The caller's own company (GET /api/company) — open to every authenticated tenant user. */
export function useCompany() {
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    companyApi
      .get()
      .then((response) => {
        if (!cancelled) setCompany(response)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(isAppError(err) ? err.message : 'Something went wrong. Please try again.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [reloadToken])

  return { company, setCompany, loading, error, refetch: () => setReloadToken((t) => t + 1) }
}
