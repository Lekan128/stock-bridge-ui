import type { ReactNode } from 'react'

/** The "opens soon" page's title and description, the same in the app and the prerendered page. */
export const MARKETPLACE_SOON_TITLE = 'Procurepaddy marketplace - opening soon'
export const MARKETPLACE_SOON_DESCRIPTION =
  'A wholesale marketplace for Nigerian businesses, opening soon: buy stock at wholesale prices, and every order lands straight in your Procurepaddy inventory.'

/** How MarketplaceSoonBand draws a link: a router Link in the app, a plain anchor when prerendered. */
export type SoonLink = (props: { to: string; className: string; children: ReactNode }) => ReactNode

/** A plain anchor: right for the prerendered page, where there is no router. */
export const plainLink: SoonLink = ({ to, className, children }) => (
  <a href={to} className={className}>
    {children}
  </a>
)
