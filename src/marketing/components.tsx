import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { ContourLines } from '@/components/brand/ContourLines'
import { FOUNDING_OFFER } from '@/marketing/config'
import { AccountLink } from '@/marketing/islands/AccountLink'
import { Island } from '@/marketing/islands/Island'
import { SetupDialog } from '@/marketing/islands/SetupDialog'
import { StickyCta } from '@/marketing/islands/StickyCta'
import { WHATSAPP_NUMBER, WHATSAPP_URL } from '@/marketing/site'
import { MarketingFooter } from '@/marketing/footer'

export { MarketingFooter }

/**
 * The parts every marketing page shares (LANDING_PAGE_PLAN.md, step 7): the header, the footer that
 * links every page to every other (how search engines find them, and how a reader moves on), the one
 * action, and the page and article layouts. Static HTML; only the islands come alive.
 */

export const h2 = 'font-narrow text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl'

/** The page's one action. With the founding offer on it opens the two-field setup form. */
export function PrimaryCta({ place, onNavy = false, className = '' }: { place: string; onNavy?: boolean; className?: string }) {
  const style = `inline-flex min-h-12 items-center justify-center rounded-md px-6 text-base font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${
    onNavy
      ? 'bg-white text-primary-900 hover:bg-primary-50 focus-visible:ring-white focus-visible:ring-offset-primary-900'
      : 'bg-action text-white hover:bg-action-hover focus-visible:ring-primary-500'
  } ${className}`
  return FOUNDING_OFFER ? (
    <a href="/signup" data-cta={place} className={style}>
      Get my free setup
    </a>
  ) : (
    <a href="/signup" className={style}>
      Create your free account
    </a>
  )
}

/** One line under a button: the offer in a sentence, true in either mode. */
export function OfferLine({ className = '' }: { className?: string }) {
  return (
    <p className={`text-sm text-neutral-700 ${className}`}>
      {FOUNDING_OFFER
        ? 'Free for 12 months for the first 100 shops. We load your products for you within 24 hours.'
        : "Free while we're in early access. No card needed."}
    </p>
  )
}

export function MarketingHeader({ focused = false }: { focused?: boolean }) {
  return (
    <header className="px-4 sm:px-6">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 py-5">
        {focused ? (
          <Logo size={26} />
        ) : (
          <a href="/" aria-label="Procurepaddy home">
            <Logo size={26} />
          </a>
        )}
        <nav aria-label="Main" className="flex items-center gap-1 text-sm">
          {!focused && (
            <>
              <a href="/pricing" className="hidden rounded-md px-3 py-2 font-medium text-neutral-700 hover:bg-neutral-100 md:inline">
                Pricing
              </a>
              <a href="/guides" className="hidden rounded-md px-3 py-2 font-medium text-neutral-700 hover:bg-neutral-100 md:inline">
                Guides
              </a>
            </>
          )}
          <Island name="account">
            <AccountLink />
          </Island>
          {FOUNDING_OFFER ? (
            <a
              href="/signup"
              data-cta="header"
              className="hidden min-h-10 items-center rounded-md bg-action px-4 font-semibold whitespace-nowrap text-white hover:bg-action-hover sm:inline-flex"
            >
              Get my free setup
            </a>
          ) : (
            <a
              href="/signup"
              className="hidden min-h-10 items-center rounded-md bg-action px-4 font-semibold whitespace-nowrap text-white hover:bg-action-hover sm:inline-flex"
            >
              Create your free account
            </a>
          )}
        </nav>
      </div>
    </header>
  )
}

export interface Crumb {
  name: string
  path: string
}

function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-neutral-600">
      <ol className="flex flex-wrap items-center gap-1">
        <li>
          <a href="/" className="hover:text-neutral-900 hover:underline">
            Home
          </a>
        </li>
        {crumbs.map((crumb, index) => (
          <li key={crumb.path} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            {index === crumbs.length - 1 ? (
              <span aria-current="page" className="text-neutral-800">
                {crumb.name}
              </span>
            ) : (
              <a href={crumb.path} className="hover:text-neutral-900 hover:underline">
                {crumb.name}
              </a>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

/**
 * Every page but the home page: header, breadcrumb, a hero with the one action, the page, a closing
 * call, the footer. The setup form and the phone's sticky button come along when the offer is on.
 */
export function PageShell({
  crumbs,
  eyebrow,
  title,
  lead,
  source,
  children,
  hero,
  closing = 'Your stock, counted and on your phone, this week.',
  meta,
  heroCta = true,
}: {
  crumbs: Crumb[]
  eyebrow?: string
  title: string
  lead: ReactNode
  /** Which page a setup request came from (the queue shows it). */
  source: string
  children: ReactNode
  /** Something beside the hero text on wide screens. */
  hero?: ReactNode
  closing?: string
  /** A small line under the title: "Updated 6 October 2026 · 6 minute read". */
  meta?: string
  /** Guides teach first and ask at the end: they leave the button out of the hero. */
  heroCta?: boolean
}) {
  return (
    <div className="bg-white text-neutral-900">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-40 focus:rounded-md focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <MarketingHeader />
      <main id="main">
        <section className="px-4 pt-4 pb-12 sm:px-6 sm:pt-8 sm:pb-16">
          <div className={`mx-auto grid max-w-6xl items-center gap-10 ${hero ? 'lg:grid-cols-12' : ''}`}>
            <div className={`flex flex-col gap-5 ${hero ? 'lg:col-span-7' : 'max-w-3xl'}`}>
              <Breadcrumbs crumbs={crumbs} />
              {eyebrow && <p className="text-sm font-semibold tracking-wide text-primary-700">{eyebrow}</p>}
              <h1 className="font-narrow text-4xl leading-[1.05] font-bold tracking-tight text-balance sm:text-5xl">{title}</h1>
              {meta && <p className="text-sm text-neutral-600">{meta}</p>}
              <div className="max-w-[62ch] text-lg leading-relaxed text-neutral-700">{lead}</div>
              {heroCta && (
                <div className="flex flex-col gap-2">
                  <div>
                    <PrimaryCta place="hero" />
                  </div>
                  <OfferLine />
                </div>
              )}
            </div>
            {hero && <div className="lg:col-span-5">{hero}</div>}
          </div>
        </section>
        {children}
        <section aria-label="Get started" className="relative overflow-hidden bg-primary-900 px-4 py-16 text-white sm:px-6">
          <ContourLines className="absolute inset-0 h-full w-full text-white/[0.07]" />
          <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-5">
            <h2 className={`${h2} max-w-3xl`}>{closing}</h2>
            <PrimaryCta place="final" onNavy />
            <p className="text-primary-100">
              Questions first? WhatsApp us on{' '}
              <a href={WHATSAPP_URL} className="font-semibold text-white underline" target="_blank" rel="noreferrer">
                {WHATSAPP_NUMBER}
              </a>
              , 8am to 6pm, Monday to Saturday.
            </p>
          </div>
        </section>
      </main>
      <MarketingFooter />
      {FOUNDING_OFFER && (
        <>
          <Island name="sticky">
            <StickyCta />
          </Island>
          <Island name="setup" props={{ source }}>
            <SetupDialog source={source} />
          </Island>
        </>
      )}
    </div>
  )
}

/** A plain content section with an optional heading. */
export function Block({
  id,
  title,
  children,
  tint = false,
}: {
  id?: string
  title?: string
  children: ReactNode
  tint?: boolean
}) {
  return (
    <section id={id} aria-label={title} className={`px-4 py-14 sm:px-6 ${tint ? 'bg-neutral-50' : ''}`}>
      <div className="mx-auto max-w-6xl">
        {title && <h2 className={`${h2} max-w-3xl`}>{title}</h2>}
        <div className={title ? 'mt-8' : ''}>{children}</div>
      </div>
    </section>
  )
}

/**
 * Long-form reading (guides, comparisons): a 65-character measure and the typography for the
 * elements articles use, without a typography plugin.
 */
export const prose =
  'max-w-[68ch] text-lg leading-relaxed text-neutral-800 [&_code]:rounded [&_code]:bg-neutral-100 [&_code]:px-1 [&_code]:text-base [&_code]:break-all [&_a]:font-medium [&_a]:text-primary-700 [&_a:hover]:underline [&_h2]:mt-12 [&_h2]:font-narrow [&_h2]:text-3xl [&_h2]:leading-tight [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-neutral-900 [&_h3]:mt-8 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-neutral-900 [&_li]:mt-2 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mt-4 [&_strong]:text-neutral-900 [&_table]:mt-6 [&_table]:w-full [&_table]:text-base [&_td]:border-b [&_td]:border-neutral-200 [&_td]:py-2 [&_td]:pr-4 [&_td]:align-top [&_th]:border-b-2 [&_th]:border-neutral-300 [&_th]:py-2 [&_th]:pr-4 [&_th]:text-left [&_th]:font-semibold [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6'

/** "In Procurepaddy": how the app does the thing an article just taught by hand. */
export function InTheApp({ children }: { children: ReactNode }) {
  return (
    <aside className="mt-8 rounded-lg border border-primary-100 bg-primary-50 p-5 text-base text-primary-900">
      <p className="text-sm font-semibold tracking-wide text-primary-700">In Procurepaddy</p>
      <div className="mt-2 [&_p+p]:mt-3">{children}</div>
    </aside>
  )
}

/** Further reading at the end of a page: internal links that matter to the reader. */
export function Related({ links, title = 'Read next' }: { links: [string, string][]; title?: string }) {
  return (
    <nav aria-label={title} className="mt-12 border-t border-neutral-200 pt-6">
      <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
      <ul className="mt-3 flex flex-col gap-2 text-base">
        {links.map(([label, href]) => (
          <li key={href}>
            <a href={href} className="font-medium text-primary-700 hover:underline">
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
