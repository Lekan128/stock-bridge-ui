import { BadgeCheck, Store } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { MarketplaceSeller } from '@/features/storefront/types'

/** Where a seller's storefront lives. Slugs are the shareable form; the id is the fallback. */
export function sellerPath(seller: Pick<MarketplaceSeller, 'id' | 'slug'>): string {
  return `/seller/${seller.slug || seller.id}`
}

export interface SellerBadgeProps {
  seller: MarketplaceSeller | null
  /** `sm` for grid tiles, `md` for the detail page and the cart's group headers. */
  size?: 'sm' | 'md'
  /** Off inside another link — nesting an anchor in an anchor is invalid HTML and breaks clicks. */
  linked?: boolean
  className?: string
}

/**
 * "Sold by X" — the one thing a buyer must know about a listing they did not expect to be
 * third-party.
 *
 * <h2>Why ProcurePal is labelled differently</h2>
 * The operator is not one vendor among the rest, and rendering it as though it were makes the
 * marketplace feel like it has no first party at all. ProcurePal's own stock gets a check mark and
 * no link — there is no separate ProcurePal storefront to visit, because the whole catalog is
 * theirs by default.
 *
 * <h2>Null is a real case</h2>
 * The API leaves `seller` null when the seller row vanished between the catalog query and the
 * projection. A missing attribution renders as nothing rather than as "Sold by null" or a thrown
 * render — a shopper's cart must not become unopenable because a vendor was suspended this
 * morning.
 */
export function SellerBadge({ seller, size = 'sm', linked = true, className = '' }: SellerBadgeProps) {
  if (!seller) return null

  const text = size === 'sm' ? 'text-xs' : 'text-sm'
  const logo = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'

  const body = (
    <>
      {seller.logoUrl ? (
        <img
          src={seller.logoUrl}
          alt=""
          className={`${logo} shrink-0 rounded-full object-cover`}
          /* Decorative: the seller's name is right beside it, so announcing the logo too would
             make a screen reader say the name twice. */
          aria-hidden="true"
        />
      ) : seller.platformOwner ? (
        <BadgeCheck className={`${logo} shrink-0 text-primary-600`} aria-hidden="true" />
      ) : (
        <Store className={`${logo} shrink-0 text-neutral-400`} aria-hidden="true" />
      )}
      <span className="truncate">{seller.name}</span>
    </>
  )

  const shared = `inline-flex min-w-0 items-center gap-1.5 ${text} text-neutral-500 ${className}`

  // The platform owner has no storefront page of its own — see the class comment.
  if (!linked || seller.platformOwner) {
    return (
      <span className={shared}>
        <span className="sr-only">Sold by </span>
        {body}
      </span>
    )
  }

  return (
    <Link
      to={sellerPath(seller)}
      className={`${shared} rounded hover:text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500`}
    >
      <span className="sr-only">Sold by </span>
      {body}
    </Link>
  )
}
