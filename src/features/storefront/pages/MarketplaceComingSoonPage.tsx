import { useEffect } from 'react'
import { ArrowRight, MessageCircle, PackageCheck, Truck, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { ContourLines } from '@/components/brand/ContourLines'
import { HeroPointList, type HeroPoint } from '@/features/storefront/components/StorefrontHero'
import { WHATSAPP_URL } from '@/marketing/site'

/**
 * What every `/marketplace/…` address shows while the marketplace is closed (MARKETPLACE_OPEN).
 *
 * The marketplace is one of the main reasons to choose Procurepaddy, so this page still sells it,
 * on the same navy band and with the same three promises as the open marketplace's hero. It is
 * never a dead end: a visitor can create a company account (or, signed in, go back to their
 * workspace), ask a person on WhatsApp, or apply to sell. Left-aligned like every empty state
 * (DESIGN.md), with no countdown and no launch date, since none has been set.
 *
 * The promises carry no fees or thresholds on purpose: those are marketplace settings that may
 * change before launch, and a page that promises a price nobody has agreed is worse than one that
 * says less.
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

const PAGE_TITLE = 'ProcurePal wholesale marketplace - opening soon'
const PAGE_DESCRIPTION =
  'A wholesale marketplace for Nigerian businesses, opening soon: buy the stock you run on at wholesale prices, and every order lands straight in your Procurepaddy inventory.'

const onNavyFocus =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-900'

export function MarketplaceComingSoonPage() {
  const { isAuthenticated } = useAuth()

  // The app shell's <head> only says "Procurepaddy". Search engines read the page after it runs, so
  // this is what they index for /marketplace until launch - the same address the catalogue keeps.
  useEffect(() => {
    const previousTitle = document.title
    document.title = PAGE_TITLE
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const created = !meta
    const previousDescription = meta?.content
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'description'
      document.head.appendChild(meta)
    }
    meta.content = PAGE_DESCRIPTION
    return () => {
      document.title = previousTitle
      if (created) meta.remove()
      else meta.content = previousDescription ?? ''
    }
  }, [])

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
              {isAuthenticated
                ? 'It will open inside the account you already have, with your products and stock in place.'
                : 'Keep your stock in Procurepaddy now, and your records will be ready the day it opens.'}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to={isAuthenticated ? '/app' : '/signup'}
                className={`rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-primary-700 transition-colors hover:bg-primary-50 ${onNavyFocus}`}
              >
                {isAuthenticated ? 'Go to my workspace' : 'Create a company account'}
              </Link>
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
          <Link
            to="/vendor-application"
            className="inline-flex items-center gap-1 font-medium text-primary-600 hover:text-primary-700 hover:underline"
          >
            Apply to be a supplier
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </p>
      </div>
    </>
  )
}
