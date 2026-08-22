import { useState } from 'react'
import { ArrowUpRight, Mail, Menu, Phone, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { Logo } from '@/components/Logo'
import { useCart } from '@/features/cart/hooks/useCart'
import { useMarketplaceSettings } from '@/features/storefront/hooks/useMarketplaceSettings'
import { StorefrontCartButton } from '@/layouts/StorefrontCartButton'
import { StorefrontCategoryMenu } from '@/layouts/StorefrontCategoryMenu'
import { StorefrontMobileDrawer } from '@/layouts/StorefrontMobileDrawer'
import { StorefrontSearchInput } from '@/layouts/StorefrontSearchInput'
import { UserMenu } from '@/layouts/UserMenu'
import { formatNairaWhole } from '@/utils/money'

/**
 * Public storefront header.
 *
 * Three bands, which is the wholesale-marketplace convention rather than a consumer-retail one:
 * a navy utility strip carrying the trade proposition and support contact, the main bar with
 * brand + search + cart + account, and a category rail. Search is prominent and never collapses
 * into an icon — on a supply catalog it is the primary navigation, not a secondary affordance.
 */
export function StorefrontHeader() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { isAuthenticated, client, user } = useAuth()
  const { canShop } = useCart()
  const { settings } = useMarketplaceSettings()

  const companyLabel = client?.name ?? client?.identifier ?? user?.username ?? ''

  return (
    <>
      {/* Utility strip — desktop only. It is reassurance and contact detail, not navigation, so
          on a phone it would just push the catalog below the fold. */}
      <div className="hidden bg-primary-900 text-primary-100 md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-1.5 text-xs sm:px-6 lg:px-8">
          <p className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-accent-400" aria-hidden="true" />
            Wholesale supply for Nigerian businesses — invoiced, delivered, tracked.
          </p>
          <div className="flex items-center gap-4">
            {settings.supportPhone && (
              <a href={`tel:${settings.supportPhone}`} className="flex items-center gap-1.5 hover:text-white">
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                {settings.supportPhone}
              </a>
            )}
            {settings.supportEmail && (
              <a href={`mailto:${settings.supportEmail}`} className="flex items-center gap-1.5 hover:text-white">
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                {settings.supportEmail}
              </a>
            )}
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              aria-expanded={drawerOpen}
              className="-ml-2 rounded-md p-2 text-neutral-600 hover:bg-neutral-100 md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <Link to="/" className="shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
              <Logo brand="procurePal" size={28} />
            </Link>

            {/* Desktop search: given the whole middle of the bar, the widest element in the header. */}
            <div className="hidden min-w-0 flex-1 px-4 md:block">
              <StorefrontSearchInput />
            </div>

            <div className="ml-auto flex items-center gap-1 md:ml-0">
              {/* Hidden for a signed-in vendor: they sell here and cannot buy, so a cart badge
                  would count a basket that has no checkout behind it. See CartContext.canShop. */}
              {canShop && <StorefrontCartButton />}

              {isAuthenticated ? (
                <div className="flex items-center gap-1">
                  {/* The company name, not the username: in B2B procurement, *which company you
                      are buying for* is the fact that matters on a shared account. */}
                  <Link
                    to="/app"
                    className="hidden max-w-[12rem] items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 lg:flex"
                  >
                    <span className="truncate">{companyLabel}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
                  </Link>
                  <UserMenu />
                </div>
              ) : (
                <div className="flex items-center gap-1 sm:gap-2">
                  <Link
                    to="/login"
                    className="whitespace-nowrap rounded-md px-2.5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
                  >
                    Log in
                  </Link>
                  {/* Hand-rolled rather than buttonClassName(): that helper hard-codes
                      `inline-flex`, which beats a `hidden` utility on specificity ties and would
                      keep this visible at 375px, where it wraps and doubles the header height. */}
                  <Link
                    to="/signup"
                    className="hidden whitespace-nowrap rounded-md bg-primary-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 sm:inline-flex"
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Mobile search row — the accessibility/UX bar requires search to work at 375px. */}
          <div className="pb-3 md:hidden">
            <StorefrontSearchInput />
          </div>
        </div>

        {/* Category rail — desktop only; the drawer carries the same links on mobile. */}
        <div className="hidden border-t border-neutral-100 bg-neutral-50 md:block">
          <div className="mx-auto flex max-w-7xl items-center gap-1 px-4 sm:px-6 lg:px-8">
            <StorefrontCategoryMenu />
            <Link
              to="/"
              className="rounded-md px-2.5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            >
              All products
            </Link>
            {isAuthenticated && (
              <Link
                to="/app/orders"
                className="rounded-md px-2.5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
              >
                My orders
              </Link>
            )}
            <span className="ml-auto py-2 text-xs text-neutral-500">
              Free delivery on orders over{' '}
              <strong className="font-semibold text-neutral-700">
                {formatNairaWhole(settings.freeDeliveryThreshold)}
              </strong>
            </span>
          </div>
        </div>
      </header>

      <StorefrontMobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  )
}
