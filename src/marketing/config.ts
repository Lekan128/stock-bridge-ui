/**
 * Build-time settings for the marketing pages. `VITE_` variables reach both the prerender and the
 * browser bundle, so the HTML and the hydrated islands always agree.
 */

/**
 * The founding offer is on the page (LANDING_PAGE_PLAN.md, step 3). Off by default: production
 * keeps the early-access page until the owners switch the offer on, which `scripts/prerender.mjs`
 * refuses for a production build until the founders' photos and names are in `founders.ts`.
 */
export const FOUNDING_OFFER = import.meta.env.VITE_FOUNDING_OFFER === 'true'

/** The API the islands call. Same variable as the app. */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

/** PostHog (EU), from LAUNCH_MATERIALS.md §4. Unset: events are not sent anywhere. */
export const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined
export const POSTHOG_HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://eu.i.posthog.com'
