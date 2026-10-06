import type { ReactNode } from 'react'
import type { GUIDE_SLUGS } from '@/marketing/paths'

/** One article under `/guides/` (LANDING_PAGE_PLAN.md §5). */
export interface Guide {
  slug: (typeof GUIDE_SLUGS)[number]
  /** The H1 and, with " | Procurepaddy", the page title. */
  title: string
  /** The meta description and the guides index's summary: under 160 characters. */
  description: string
  /** The opening paragraph under the title. */
  lead: string
  /** ISO date of the last real change, for the page and the Article JSON-LD. */
  updated: string
  minutes: number
  body: ReactNode
  related: [string, string][]
}
