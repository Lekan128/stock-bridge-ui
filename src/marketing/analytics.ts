import { POSTHOG_HOST, POSTHOG_KEY } from '@/marketing/config'

/**
 * The funnel events (LAUNCH_MATERIALS.md §4), sent straight to PostHog's capture endpoint: no SDK,
 * so the page stays inside its JavaScript budget. Nothing is sent until VITE_POSTHOG_KEY is set.
 */
const ID_KEY = 'pp.visitorId'

function visitorId(): string {
  try {
    const existing = localStorage.getItem(ID_KEY)
    if (existing) return existing
    const id = crypto.randomUUID()
    localStorage.setItem(ID_KEY, id)
    return id
  } catch {
    return 'anonymous'
  }
}

export function track(event: string, properties: Record<string, unknown> = {}): void {
  if (!POSTHOG_KEY) return
  const params = new URLSearchParams(location.search)
  const body = JSON.stringify({
    api_key: POSTHOG_KEY,
    event,
    distinct_id: visitorId(),
    properties: {
      $current_url: location.href,
      $pathname: location.pathname,
      $referrer: document.referrer,
      utm_source: params.get('utm_source') ?? undefined,
      utm_campaign: params.get('utm_campaign') ?? undefined,
      ...properties,
    },
  })
  try {
    const sent = navigator.sendBeacon?.(`${POSTHOG_HOST}/i/v0/e/`, body)
    if (!sent) void fetch(`${POSTHOG_HOST}/i/v0/e/`, { method: 'POST', body, keepalive: true })
  } catch {
    // Analytics must never break the page.
  }
}
