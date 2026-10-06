import { StrictMode, type ComponentType } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import '@/index.css'
import { track } from '@/marketing/analytics'
import { FOUNDING_OFFER } from '@/marketing/config'
import { OPEN_SETUP_EVENT, SETUP_READY_EVENT, type IslandName } from '@/marketing/islands/Island'

// The marketing pages' own small bundle: no router, no data layer, no workspace code. The HTML is
// already on screen (prerendered); this only makes the interactive parts work. Each island's code
// is fetched only by a page that has that island, so a guide doesn't download the setup form.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ISLANDS: Record<IslandName, () => Promise<ComponentType<any>>> = {
  account: () => import('@/marketing/islands/AccountLink').then((m) => m.AccountLink),
  scarcity: () => import('@/marketing/islands/ScarcityLine').then((m) => m.ScarcityLine),
  receipt: () => import('@/marketing/islands/HeroReceipt').then((m) => m.HeroReceipt),
  setup: () => import('@/marketing/islands/SetupDialog').then((m) => m.SetupDialog),
  sticky: () => import('@/marketing/islands/StickyCta').then((m) => m.StickyCta),
  loss: () => import('@/marketing/islands/LossCalculator').then((m) => m.LossCalculator),
}

const root = document.getElementById('root')!
// The home page while the founding offer is off is one hydrated React tree (EarlyAccessLanding);
// every other marketing page, and the home page with the offer on, is static HTML with islands.
const earlyAccessHome = !FOUNDING_OFFER && document.documentElement.dataset.page == null && location.pathname === '/'

if (!earlyAccessHome) {
  let hasSetup = false
  for (const element of document.querySelectorAll<HTMLElement>('[data-island]')) {
    const name = element.dataset.island as IslandName
    const load = ISLANDS[name]
    if (!load) continue
    const props = element.dataset.props ? JSON.parse(element.dataset.props) : {}
    void load().then((Island) => {
      hydrateRoot(element, <Island {...props} />)
    })
    if (name === 'setup') hasSetup = true
  }
  if (FOUNDING_OFFER && hasSetup) {
    // The form listens for the buttons once it has hydrated, and says so; a tap before then waits.
    const ready = new Promise<void>((resolve) => {
      if ((window as Window & { ppSetupReady?: boolean }).ppSetupReady) resolve()
      else window.addEventListener(SETUP_READY_EVENT, () => resolve(), { once: true })
    })
    // Every "Get my free setup" opens the two-field form; without JavaScript it is a plain link to sign-up.
    document.addEventListener('click', (event) => {
      const cta = (event.target as Element).closest<HTMLElement>('[data-cta]')
      if (!cta || event.defaultPrevented || event.metaKey || event.ctrlKey) return
      event.preventDefault()
      track('cta_clicked', { place: cta.dataset.cta, page: location.pathname })
      void ready.then(() => window.dispatchEvent(new Event(OPEN_SETUP_EVENT)))
    })
  }
  track('landing_viewed', { page: location.pathname })
} else {
  // Loaded only in this branch, so no other page downloads it (or the logo and contour artwork it
  // brings): the founding page's JavaScript is held to a 70 KB budget.
  void import('@/marketing/EarlyAccessLanding').then(({ EarlyAccessLanding }) => {
    if (root.hasChildNodes()) hydrateRoot(root, <StrictMode><EarlyAccessLanding /></StrictMode>)
    else createRoot(root).render(<StrictMode><EarlyAccessLanding /></StrictMode>)
  })
}
