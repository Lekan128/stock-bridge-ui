import { Mail, MessageCircle, ShieldCheck } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { MarketplaceSoonBand } from '@/features/storefront/components/MarketplaceSoonBand'
import { plainLink } from '@/features/storefront/components/marketplaceSoonLinks'
import { AccountLink } from '@/marketing/islands/AccountLink'
import { Island } from '@/marketing/islands/Island'
import { WHATSAPP_NUMBER, WHATSAPP_URL } from '@/marketing/site'

const SUPPORT_EMAIL = 'support@procurepaddy.com'

/**
 * `/marketplace` as real HTML while the marketplace is closed: what a search engine reads, and what
 * anyone arriving from Google or a shared link sees first. Prerendered by `scripts/prerender.mjs`
 * only for a closed build (renderMarketplace in entry-server.tsx); once it opens, `/marketplace` is
 * the app's catalogue again at the same address.
 *
 * Procurepaddy is the marketplace's brand; ProcurePal is its main supplier, not its name.
 *
 * It is the app's "opens soon" page (MarketplaceComingSoonPage in StorefrontLayout comingSoon)
 * redrawn without the app: the same body (MarketplaceSoonBand), and a header and footer that copy
 * the storefront's closed state. The marketplace's support details come from the API in the app;
 * here, with no API, they are Procurepaddy's own. Only "Log in" comes alive (the account island),
 * turning into "Open your workspace" for someone signed in on this browser.
 */
export function MarketplacePage() {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-50 text-neutral-900">
      <div className="hidden bg-primary-900 text-primary-100 md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-1.5 text-xs sm:px-6 lg:px-8">
          <p className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-accent-400" aria-hidden="true" />
            Wholesale supply for Nigerian businesses — invoiced, delivered, tracked.
          </p>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="flex items-center gap-1.5 hover:text-white">
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
            {SUPPORT_EMAIL}
          </a>
        </div>
      </div>

      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <a
            href="/marketplace"
            aria-label="Procurepaddy marketplace"
            className="shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <Logo size={28} />
          </a>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Island name="account">
              <AccountLink />
            </Island>
            <a
              href="/signup"
              className="hidden whitespace-nowrap rounded-md bg-primary-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 sm:inline-flex"
            >
              Sign up
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <MarketplaceSoonBand signedIn={false} link={plainLink} />
      </main>

      <footer className="mt-16 border-t border-neutral-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <Logo size={28} />
              <p className="mt-3 max-w-md text-sm text-neutral-600">
                The Procurepaddy marketplace is opening for Nigerian businesses — kitchens, retailers, pharmacies
                and site teams — and every order will land straight in your own inventory.
              </p>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">Get started</h2>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                <li>
                  <a href="/signup" className="text-neutral-600 hover:text-primary-600 hover:underline">
                    Create a business account
                  </a>
                </li>
                <li>
                  <a href="/login" className="text-neutral-600 hover:text-primary-600 hover:underline">
                    Log in
                  </a>
                </li>
                <li>
                  <a href="/" className="text-neutral-600 hover:text-primary-600 hover:underline">
                    About Procurepaddy
                  </a>
                </li>
              </ul>

              <h2 className="mt-6 text-sm font-semibold text-neutral-900">Support</h2>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                <li>
                  <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-neutral-600 hover:text-primary-600 hover:underline"
                  >
                    <MessageCircle className="h-4 w-4 text-neutral-500" aria-hidden="true" />
                    WhatsApp {WHATSAPP_NUMBER}
                  </a>
                </li>
                <li>
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="flex items-center gap-2 text-neutral-600 hover:text-primary-600 hover:underline"
                  >
                    <Mail className="h-4 w-4 text-neutral-500" aria-hidden="true" />
                    {SUPPORT_EMAIL}
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-2 border-t border-neutral-200 pt-6 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Procurepaddy.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
