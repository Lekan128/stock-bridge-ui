import { StrictMode, type ComponentType } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import '@/index.css'
import { EarlyAccessLanding } from '@/marketing/EarlyAccessLanding'
import { track } from '@/marketing/analytics'
import { FOUNDING_OFFER } from '@/marketing/config'
import { AccountLink } from '@/marketing/islands/AccountLink'
import { HeroReceipt } from '@/marketing/islands/HeroReceipt'
import { OPEN_SETUP_EVENT, type IslandName } from '@/marketing/islands/Island'
import { ScarcityLine } from '@/marketing/islands/ScarcityLine'
import { SetupDialog } from '@/marketing/islands/SetupDialog'
import { StickyCta } from '@/marketing/islands/StickyCta'

// The landing page's own small bundle: no router, no data layer, no workspace code. The HTML is
// already on screen (prerendered); this only makes the interactive parts work.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ISLANDS: Record<IslandName, ComponentType<any>> = {
  account: AccountLink,
  scarcity: ScarcityLine,
  receipt: HeroReceipt,
  setup: SetupDialog,
  sticky: StickyCta,
}

const root = document.getElementById('root')!

if (FOUNDING_OFFER) {
  for (const element of document.querySelectorAll<HTMLElement>('[data-island]')) {
    const Island = ISLANDS[element.dataset.island as IslandName]
    const props = element.dataset.props ? JSON.parse(element.dataset.props) : {}
    if (Island) hydrateRoot(element, <Island {...props} />)
  }
  // Every "Get my free setup" opens the two-field form; without JavaScript it is a plain link to sign-up.
  document.addEventListener('click', (event) => {
    const cta = (event.target as Element).closest<HTMLElement>('[data-cta]')
    if (!cta || event.defaultPrevented || event.metaKey || event.ctrlKey) return
    event.preventDefault()
    track('cta_clicked', { place: cta.dataset.cta })
    window.dispatchEvent(new Event(OPEN_SETUP_EVENT))
  })
  track('landing_viewed', { page: location.pathname })
} else if (root.hasChildNodes()) {
  hydrateRoot(root, <StrictMode><EarlyAccessLanding /></StrictMode>)
} else {
  createRoot(root).render(<StrictMode><EarlyAccessLanding /></StrictMode>)
}
