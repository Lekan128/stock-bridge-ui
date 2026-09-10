import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * React Router doesn't reset scroll position on navigation the way a full page load does, so
 * without this a page can open scrolled to wherever the previous page left off — most jarringly
 * after checkout/receipt actions that replace a long page with a short confirmation, which then
 * opens scrolled to its own bottom.
 *
 * Two targets, not one: StorefrontLayout and AdminLayout scroll the window itself, but AppLayout
 * (`layouts/AppLayout.tsx`) is a fixed-height shell whose own `<main data-scroll-container>` is
 * the thing that actually scrolls — `window.scrollTo` alone never touches it.
 */
export function ScrollToTop() {
  const { pathname } = useLocation()

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
    document.querySelector('[data-scroll-container]')?.scrollTo(0, 0)
  }, [pathname])

  return null
}
