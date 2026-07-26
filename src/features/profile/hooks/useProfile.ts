import { useEffect, useState } from 'react'
import { profileApi } from '@/features/profile/api/profileApi'
import type { Profile } from '@/features/profile/types'
import { isAppError } from '@/types/api'

/** The signed-in user's own record (GET /api/me) — available to every authenticated tenant user. */
export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    profileApi
      .get()
      .then((response) => {
        if (!cancelled) setProfile(response)
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

  return { profile, setProfile, loading, error, refetch: () => setReloadToken((t) => t + 1) }
}
