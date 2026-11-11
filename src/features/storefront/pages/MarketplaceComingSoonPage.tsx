import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { MarketplaceSoonBand } from '@/features/storefront/components/MarketplaceSoonBand'
import {
  MARKETPLACE_SOON_DESCRIPTION,
  MARKETPLACE_SOON_TITLE,
  type SoonLink,
} from '@/features/storefront/components/marketplaceSoonLinks'

const routerLink: SoonLink = ({ to, className, children }) => (
  <Link to={to} className={className}>
    {children}
  </Link>
)

/**
 * What every `/marketplace/…` address shows inside the app while the marketplace is closed
 * (MARKETPLACE_OPEN), in the storefront chrome (StorefrontLayout comingSoon).
 *
 * The marketplace is one of the main reasons to choose Procurepaddy, so this page still sells it.
 * It is never a dead end: create a company account (or, signed in, go back to the workspace), ask a
 * person on WhatsApp, or apply to sell. Left-aligned like every empty state (DESIGN.md), with no
 * countdown and no launch date, since none has been set.
 *
 * A first visit to `/marketplace` in production gets the prerendered copy of this page instead
 * (src/marketing/pages/MarketplacePage.tsx), with the same body (MarketplaceSoonBand).
 */
export function MarketplaceComingSoonPage() {
  const { isAuthenticated } = useAuth()

  // The app shell's <head> only says "Procurepaddy". Inside the app the prerendered page's head
  // isn't there, so set the same title and description here.
  useEffect(() => {
    const previousTitle = document.title
    document.title = MARKETPLACE_SOON_TITLE
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const created = !meta
    const previousDescription = meta?.content
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'description'
      document.head.appendChild(meta)
    }
    meta.content = MARKETPLACE_SOON_DESCRIPTION
    return () => {
      document.title = previousTitle
      if (created) meta.remove()
      else meta.content = previousDescription ?? ''
    }
  }, [])

  return <MarketplaceSoonBand signedIn={isAuthenticated} link={routerLink} />
}
