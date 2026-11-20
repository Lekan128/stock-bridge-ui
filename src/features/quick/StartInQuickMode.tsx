import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { useApiQuery } from '@/data/useApiQuery'
import { profileApi } from '@/features/profile/api/profileApi'

const OPENED_KEY = 'pp.opened'

/**
 * Starts in quick mode (V105; owner, 2026-11-19): someone their manager set to start there lands in it when they open
 * the app or log in - once per opening, so Exit and the Dashboard still work as usual afterwards. Not on a link to a
 * particular page: they wanted that page.
 */
export function StartInQuickMode() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const me = useApiQuery({
    queryKey: ['me'],
    queryFn: () => profileApi.get(),
    fallbackError: "Couldn't load your account.",
    enabled: user?.type === 'tenant',
  })
  const startsInQuick = me.data?.startsInQuickMode === true
  useEffect(() => {
    if (!user || me.data == null) return
    let opened: string | null = null
    try {
      opened = sessionStorage.getItem(OPENED_KEY)
      sessionStorage.setItem(OPENED_KEY, user.id)
    } catch {
      // No session storage (a private window): start in quick mode only from the Dashboard's address, as below.
    }
    if (opened === user.id || !startsInQuick) return
    if (location.pathname === '/app' || location.pathname === '/app/') navigate('/app/quick', { replace: true })
    // Only on the first page of this opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.data, user?.id])
  return null
}
