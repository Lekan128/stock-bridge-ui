import { Link } from 'react-router-dom'
import { ArrowRight, Package, Truck } from 'lucide-react'
import { PERMISSIONS, type Permission } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { RecentImportsList } from '@/features/imports/components/RecentImportsList'
import { copy } from '@/features/imports/copy'
import type { ImportKind } from '@/features/imports/types'

/**
 * The authority each card's pipeline actually needs (bulk-import contract §3), not the one the
 * route needs. The route lets anybody with either code in, because the two imports live behind
 * one URL; the cards themselves are not interchangeable.
 */
const CARDS: { kind: ImportKind; Icon: typeof Package; permission: Permission }[] = [
  { kind: 'PRODUCT_CATALOG', Icon: Package, permission: PERMISSIONS.MANAGE_PRODUCTS },
  { kind: 'STOCK_IN', Icon: Truck, permission: PERMISSIONS.MANAGE_INVENTORY },
]

/**
 * The entry point, worded as intentions.
 *
 * "Product import" and "Stock import" name our tables. Nobody arrives wanting to import a
 * product table; they arrive wanting to get their catalog in, or to write down what the truck
 * dropped off this morning. Spec §6.7 is explicit that the user must not have to know which of
 * our two pipelines they want before they can start, and this is what makes that true.
 *
 * A card the signed-in user cannot use is not shown. A storekeeper holds `MANAGE_INVENTORY` and
 * not `MANAGE_PRODUCTS`, so "Add or update products" was an offer the server would refuse the
 * moment they picked a file — a dead end dressed as a choice, and the worst kind, because it
 * only reveals itself after the work of finding the spreadsheet. The route guard stays a
 * disjunction because the two imports share one URL; this is the narrower, per-kind check the
 * service performs.
 */
export function ImportChooserPage() {
  const { user } = useAuth()
  const permissions = user?.type === 'tenant' ? user.permissions : []
  const cards = CARDS.filter((card) => permissions.includes(card.permission))

  /**
   * Recent imports are filtered the same way when the user can only act on one kind. The list
   * endpoint is not kind-scoped, so an inventory officer was being offered "View" and "Undo" on
   * a product import the service would refuse them (contract §3 authorizes per kind) — the same
   * dead end as the card above, one panel further down.
   */
  const onlyKind = cards.length === 1 ? cards[0].kind : undefined

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">{copy.chooser.title}</h1>
        <p className="mt-1 text-sm text-neutral-600">{copy.chooser.subtitle}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map(({ kind, Icon }) => {
          const card = copy.chooser.cards[kind]
          return (
            <Link
              key={kind}
              to={`/app/products/import/new?kind=${kind}`}
              className="group flex flex-col rounded-lg border border-neutral-200 bg-white p-6 transition-colors hover:border-primary-300 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-50 text-primary-600 group-hover:bg-white">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="mt-4 text-base font-semibold text-neutral-900">{card.title}</span>
              <span className="mt-2 text-sm text-neutral-600">{card.body}</span>
              <span className="mt-2 text-sm text-neutral-500">{card.footnote}</span>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary-700">
                {copy.chooser.start}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Link>
          )
        })}
      </div>

      <RecentImportsList kind={onlyKind} />
    </div>
  )
}
