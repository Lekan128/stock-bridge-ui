import { Headset, Mail, Phone, Truck, Warehouse } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { Logo } from '@/components/Logo'
import { useMarketplaceSettings } from '@/features/storefront/hooks/useMarketplaceSettings'
import { formatNairaWhole } from '@/utils/money'

const CURRENT_YEAR = new Date().getFullYear()

/**
 * Storefront footer. Deliberately does three jobs and no more: prove a human can be reached,
 * explain what buying here gets a business, and offer the way in. A B2B buyer decides whether a
 * supplier is real before they decide whether to order, and a footer with no contact detail is the
 * fastest way to fail that check.
 */
export function StorefrontFooter() {
  const { isAuthenticated } = useAuth()
  const { settings } = useMarketplaceSettings()

  return (
    <footer className="mt-16 border-t border-neutral-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <Logo brand="procurePal" size={28} />
            <p className="mt-3 max-w-md text-sm text-neutral-600">
              ProcurePal supplies Nigerian businesses — kitchens, retailers, pharmacies and site
              teams — with the stock they run on. Order at wholesale prices, pay on delivery or up
              front, and watch every delivery land straight in your own inventory.
            </p>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-neutral-900">For businesses</h2>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-neutral-600">
              <li className="flex items-start gap-2">
                <Warehouse className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" aria-hidden="true" />
                Deliveries post into your inventory as incoming stock, then become on-hand stock the
                moment you confirm receipt.
              </li>
              <li className="flex items-start gap-2">
                <Truck className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" aria-hidden="true" />
                Free delivery on orders over {formatNairaWhole(settings.freeDeliveryThreshold)}.
              </li>
              {settings.payOnDeliveryEnabled && (
                <li className="flex items-start gap-2">
                  <Headset className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" aria-hidden="true" />
                  Pay on delivery available on approved accounts.
                </li>
              )}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Get started</h2>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              <li>
                <Link to="/" className="text-neutral-600 hover:text-primary-600 hover:underline">
                  Browse the catalog
                </Link>
              </li>
              {isAuthenticated ? (
                <>
                  <li>
                    <Link to="/app" className="text-neutral-600 hover:text-primary-600 hover:underline">
                      My workspace
                    </Link>
                  </li>
                  <li>
                    <Link to="/app/orders" className="text-neutral-600 hover:text-primary-600 hover:underline">
                      My orders
                    </Link>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <Link to="/signup" className="text-neutral-600 hover:text-primary-600 hover:underline">
                      Create a business account
                    </Link>
                  </li>
                  <li>
                    <Link to="/login" className="text-neutral-600 hover:text-primary-600 hover:underline">
                      Log in
                    </Link>
                  </li>
                </>
              )}
            </ul>

            <h2 className="mt-6 text-sm font-semibold text-neutral-900">Support</h2>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {settings.supportPhone && (
                <li>
                  <a
                    href={`tel:${settings.supportPhone}`}
                    className="flex items-center gap-2 text-neutral-600 hover:text-primary-600 hover:underline"
                  >
                    <Phone className="h-4 w-4 text-neutral-400" aria-hidden="true" />
                    {settings.supportPhone}
                  </a>
                </li>
              )}
              {settings.supportEmail && (
                <li>
                  <a
                    href={`mailto:${settings.supportEmail}`}
                    className="flex items-center gap-2 text-neutral-600 hover:text-primary-600 hover:underline"
                  >
                    <Mail className="h-4 w-4 text-neutral-400" aria-hidden="true" />
                    {settings.supportEmail}
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-neutral-200 pt-6 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {CURRENT_YEAR} ProcurePal. All prices in Nigerian naira (₦). Delivery within Nigeria only.</p>
          <p>
            Powered by <span className="font-medium text-neutral-600">Procure Paddy</span>
          </p>
        </div>
      </div>
    </footer>
  )
}
