import { useApiQuery } from '@/data/useApiQuery'
import { useAuth } from '@/auth/useAuth'
import { sellingApi } from '@/features/selling/sellingApi'
import type { SellingSettings } from '@/features/selling/types'

export const SELLING_SETTINGS_KEY = ['selling-settings'] as const

/**
 * The company's selling switch, as every screen reads it (`SELLING_PRICE_PLAN.md` §4.2).
 *
 * From `GET /api/company/selling`, never from the access token: a claim would stay stale until the
 * next refresh, so an owner who turned selling on would see nothing happen. Kept on the device like
 * the rest of the workspace, so a phone offline still shows the screens it last had; read again
 * when the tab comes back and when the connection does (the client's reconnect default), and at
 * most once a minute otherwise - every price field and column asks, and they share one answer.
 */
export function useSellingSettings() {
  const { user } = useAuth()
  return useApiQuery<SellingSettings>({
    queryKey: SELLING_SETTINGS_KEY,
    queryFn: sellingApi.get,
    fallbackError: "Couldn't load your selling settings.",
    enabled: user?.type === 'tenant',
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })
}
