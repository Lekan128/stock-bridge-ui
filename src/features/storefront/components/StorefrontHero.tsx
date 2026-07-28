import { PackageCheck, Truck, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { MarketplaceSettings } from '@/features/storefront/types'
import { formatNairaWhole } from '@/utils/money'

export interface StorefrontHeroProps {
  settings: MarketplaceSettings
}

/**
 * What a first-time visitor sees above the grid.
 *
 * ProcurePal is not a shop — it is a wholesale supplier wired into the buyer's own stock system,
 * and that is the part nobody guesses from a product grid. The three points below are therefore
 * the actual value proposition (buy wholesale → it lands in your inventory as incoming stock →
 * pay how you like), not decoration, and the incoming-stock line is repeated verbatim on the
 * order confirmation page so the promise and the payoff use the same words.
 */
export function StorefrontHero({ settings }: StorefrontHeroProps) {
  const points = [
    {
      icon: PackageCheck,
      title: 'Straight into your inventory',
      body: 'Every order appears in your stock as incoming, then becomes usable stock the moment you confirm you received it.',
    },
    {
      icon: Truck,
      title: 'Delivered nationwide',
      body:
        settings.freeDeliveryThreshold > 0
          ? `Flat ${formatNairaWhole(settings.deliveryFee)} delivery, free over ${formatNairaWhole(settings.freeDeliveryThreshold)}.`
          : `Flat ${formatNairaWhole(settings.deliveryFee)} delivery on every order.`,
    },
    {
      icon: Wallet,
      title: settings.payOnDeliveryEnabled ? 'Pay now or on delivery' : 'Pay securely online',
      body: settings.payOnDeliveryEnabled
        ? 'Card, bank transfer and USSD at checkout — or settle when the goods arrive.'
        : 'Card, bank transfer and USSD at checkout, secured by Monnify.',
    },
  ]

  return (
    <section className="bg-primary-600 text-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary-200">
            ProcurePal wholesale marketplace
          </p>
          <h1 className="mt-2 text-2xl font-bold leading-tight sm:text-4xl">
            Restock your business — and your stock records — in one go.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-primary-100 sm:text-base">
            Buy the staples, packaging and equipment your business runs on at wholesale prices. What you order
            is booked straight into your ProcurePal inventory, so your stock levels stay right without anyone
            keying them in twice.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="#catalog"
              className="rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-primary-700 transition-colors hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-600"
            >
              Browse the catalog
            </a>
            <Link
              to="/signup"
              className="rounded-md border border-primary-300 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-600"
            >
              Create a company account
            </Link>
          </div>
        </div>

        <ul className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-3">
          {points.map((point) => (
            <li key={point.title} className="flex gap-3 rounded-lg bg-primary-700/50 p-3.5">
              <point.icon className="mt-0.5 h-5 w-5 shrink-0 text-accent-300" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">{point.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-primary-100">{point.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
