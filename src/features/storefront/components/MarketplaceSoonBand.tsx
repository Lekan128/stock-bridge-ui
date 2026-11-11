import { ArrowRight, MessageCircle, PackageCheck, Truck, Wallet } from 'lucide-react'
import { ContourLines } from '@/components/brand/ContourLines'
import { HeroPointList, type HeroPoint } from '@/features/storefront/components/StorefrontHero'
import type { SoonLink } from '@/features/storefront/components/marketplaceSoonLinks'
import { WHATSAPP_URL } from '@/marketing/site'

/**
 * The body of the "opens soon" page, shared by its two renderings so they can't drift apart:
 * - the app's `/marketplace` route (MarketplaceComingSoonPage), reached from inside the app;
 * - the prerendered `/marketplace` page (src/marketing/pages/MarketplacePage.tsx), what a search
 *   engine and anyone arriving from a link reads, as real HTML.
 * So it uses no router and no session: links come in through `link` (marketplaceSoonLinks.tsx).
 */

/**
 * No fees or thresholds on purpose: those are marketplace settings that may change before launch,
 * and a page that promises a price nobody has agreed is worse than one that says less.
 */
const POINTS: HeroPoint[] = [
  {
    icon: PackageCheck,
    title: 'Straight into your inventory',
    body: 'Every order appears in your stock as incoming, then becomes usable stock the moment you confirm you received it.',
  },
  {
    icon: Truck,
    title: 'Delivered to your business',
    body: 'The staples, packaging and equipment your business runs on, at wholesale prices, brought to your door.',
  },
  {
    icon: Wallet,
    title: 'Pay securely online',
    body: 'Card, bank transfer and USSD at checkout.',
  },
]

const onNavyFocus =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-900'

export function MarketplaceSoonBand({ signedIn, link }: { signedIn: boolean; link: SoonLink }) {
  return (
    <>
      {/* Navy with the brand's contour lines, as on the open marketplace's hero (DESIGN.md: large
          surfaces are navy, never the bright blues). */}
      <section className="relative overflow-hidden bg-primary-900 text-white">
        <ContourLines className="absolute inset-0 h-full w-full text-white/[0.07]" />
        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-200">
              ProcurePal wholesale marketplace
            </p>
            <h1 className="mt-2 text-2xl font-bold leading-tight sm:text-4xl">The marketplace opens soon</h1>
            <p className="mt-3 text-sm leading-relaxed text-primary-100 sm:text-base">
              Buy the stock your business runs on at wholesale prices. Every order is booked straight into your
              Procurepaddy inventory, so your stock levels stay right without anyone keying them in twice.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-primary-100 sm:text-base">
              {signedIn
                ? 'It will open inside the account you already have, with your products and stock in place.'
                : 'Keep your stock in Procurepaddy now, and your records will be ready the day it opens.'}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {link({
                to: signedIn ? '/app' : '/signup',
                className: `rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-primary-700 transition-colors hover:bg-primary-50 ${onNavyFocus}`,
                children: signedIn ? 'Go to my workspace' : 'Create a company account',
              })}
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex items-center gap-2 rounded-md border border-primary-300 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-800 ${onNavyFocus}`}
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Ask on WhatsApp
              </a>
            </div>
          </div>

          <HeroPointList points={POINTS} />
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        <p className="text-sm text-neutral-600">
          Want to sell here?{' '}
          {link({
            to: '/vendor-application',
            className: 'inline-flex items-center gap-1 font-medium text-primary-600 hover:text-primary-700 hover:underline',
            children: (
              <>
                Apply to be a supplier
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </>
            ),
          })}
        </p>
      </div>
    </>
  )
}
