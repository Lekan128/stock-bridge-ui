import { useCallback, useEffect, useState } from 'react'
import { onboardingApi, type OnboardingStatus } from '@/features/onboarding/onboardingApi'

/**
 * The setup checklist's numbers. Fetched on mount and again whenever the owner comes back to the
 * tab, so items the team ticked (products loaded while they were away) tick here too. Offline it
 * keeps the last answer; the checklist is advice, never a blocker.
 */
export function useOnboarding(enabled: boolean) {
  const [status, setStatus] = useState<OnboardingStatus | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    onboardingApi
      .status()
      .then((next) => {
        if (!cancelled) setStatus(next)
      })
      .catch(() => {
        // Silent: the dashboard works without it.
      })
    return () => {
      cancelled = true
    }
  }, [enabled, reload])

  useEffect(() => {
    if (!enabled) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') setReload((value) => value + 1)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [enabled])

  const refetch = useCallback(() => setReload((value) => value + 1), [])
  return { status, refetch }
}
