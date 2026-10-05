import { useEffect, useState } from 'react'
import { buttonClassName } from '@/components/Button'
import { Logo } from '@/components/Logo'
import { ContourLines } from '@/components/brand/ContourLines'
import { MARKETPLACE_BASE } from '@/routes/marketplacePaths'

/** The refresh token the workspace keeps (`authStorage`); its presence means someone signed in here. */
const SESSION_KEY = 'sb.refreshToken'

/**
 * Whether this browser has a Procurepaddy session. Read after hydration, so the prerendered HTML
 * (which can't know) and the first client render agree.
 */
function useHasSession(): boolean {
  const [hasSession, setHasSession] = useState(false)
  useEffect(() => {
    try {
      setHasSession(localStorage.getItem(SESSION_KEY) != null)
    } catch {
      // Storage blocked: show the signed-out page.
    }
  }, [])
  return hasSession
}

/**
 * The Procurepaddy home page while the founding offer is off (LANDING_PAGE_PLAN.md, step 2): it says
 * only what is true today, with no offer to answer. `FoundingLanding` replaces it when
 * VITE_FOUNDING_OFFER is on.
 */
export function EarlyAccessLanding() {
  const hasSession = useHasSession()

  return (
    <div className="flex min-h-screen flex-col bg-white text-neutral-900">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-10 focus:rounded-md focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <a href="/" aria-label="Procurepaddy home">
          <Logo size={26} />
        </a>
        <nav className="flex items-center gap-2 text-sm">
          {hasSession ? (
            <a href="/app" className={buttonClassName('action', 'px-3 py-2 whitespace-nowrap')}>
              Open your workspace
            </a>
          ) : (
            <>
              <a href="/login" className="rounded-md px-3 py-2 font-medium whitespace-nowrap text-neutral-700 hover:bg-neutral-100">
                Log in
              </a>
              {/* On a phone the hero's own button is right below; two buttons would crowd the bar. */}
              <a href="/signup" className={buttonClassName('action', 'hidden px-3 py-2 whitespace-nowrap sm:inline-flex')}>
                Create your free account
              </a>
            </>
          )}
        </nav>
      </header>

      <main id="main" className="flex-1">
        <section className="mx-auto grid max-w-6xl gap-10 px-4 pt-10 pb-20 sm:px-6 lg:grid-cols-12 lg:pt-16">
          <div className="flex flex-col gap-5 lg:col-span-7">
            <p className="text-sm font-medium text-primary-700">The inventory app for Nigerian shops and warehouses</p>
            <h1 className="text-4xl leading-[1.05] font-bold tracking-tight text-balance [font-stretch:85%] sm:text-6xl">
              Know exactly what&apos;s in your shop, even when there&apos;s no network.
            </h1>
            <p className="max-w-[60ch] text-lg leading-relaxed text-neutral-700">
              Procurepaddy records every bag, carton and piece your staff receive and sell, on their own phones, and shows you
              who recorded what. Count a shelf and see what&apos;s missing. Free while we&apos;re in early access.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {hasSession ? (
                <a href="/app" className={buttonClassName('action', 'px-5 py-3 text-base')}>
                  Open your workspace
                </a>
              ) : (
                <a href="/signup" className={buttonClassName('action', 'px-5 py-3 text-base')}>
                  Create your free account
                </a>
              )}
              <a href="/login" className="px-2 py-3 text-base font-medium text-primary-600 hover:underline">
                {hasSession ? 'Log in as someone else' : 'I already have an account'}
              </a>
            </div>
            <p className="text-sm text-neutral-600">Works offline · Your staff on their own phones · No card needed</p>
          </div>
        </section>

        <section className="relative overflow-hidden bg-primary-900 text-white">
          <ContourLines className="absolute inset-0 h-full w-full text-white/[0.07]" />
          <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-3">
            <div>
              <h2 className="text-xl font-semibold">No network? Keep recording.</h2>
              <p className="mt-2 text-primary-100">
                Stock in, stock out and counts are kept on the phone and sent the moment it reconnects, each one once.
              </p>
            </div>
            <div>
              <h2 className="text-xl font-semibold">Know who recorded what.</h2>
              <p className="mt-2 text-primary-100">
                Every change carries the name and time of whoever made it, and staff can only do what you allow.
              </p>
            </div>
            <div>
              <h2 className="text-xl font-semibold">Bags and kilos, done right.</h2>
              <p className="mt-2 text-primary-100">Set the pack once and record in whichever is easier. 2 bags is 100 kg.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-neutral-600 sm:px-6">
        <p>© {new Date().getFullYear()} Procurepaddy</p>
        <a href={MARKETPLACE_BASE} className="hover:text-neutral-900 hover:underline">
          Buy stock through ProcurePal
        </a>
      </footer>
    </div>
  )
}
