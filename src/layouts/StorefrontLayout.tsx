import { Outlet } from 'react-router-dom'
import { StorefrontFooter } from '@/layouts/StorefrontFooter'
import { StorefrontHeader } from '@/layouts/StorefrontHeader'

/**
 * Chrome for the public ProcurePal storefront: catalog, product detail, cart, checkout and the
 * post-purchase pages.
 *
 * Unlike AppLayout — a fixed-height shell with its own internal scroll region, right for a
 * dashboard — this scrolls the document normally. A storefront needs a long scrolling catalog,
 * a sticky header, and a footer at the bottom of the content rather than pinned to the viewport.
 */
export function StorefrontLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <StorefrontHeader />
      {/* max-w-7xl and the horizontal padding live on each page, not here: a catalog hero or a
          full-bleed banner needs to reach the edges, while a cart wants a narrower column. */}
      <main className="flex-1">
        <Outlet />
      </main>
      <StorefrontFooter />
    </div>
  )
}
