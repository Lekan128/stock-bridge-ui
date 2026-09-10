import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'

/**
 * Gates the screens that belong to whoever SELLS — a vendor, or ProcurePal.
 *
 * <h2>Why this exists alongside RequirePlatformOwner rather than replacing it</h2>
 * They are not interchangeable, and the difference is the whole of this module's route
 * work. Some marketplace-admin screens are genuinely the OPERATOR's — the platform-wide
 * category taxonomy and the commercial settings (delivery fee, minimum order value,
 * pay-on-delivery rules) govern every seller's checkout, and a vendor editing those is
 * ProcurePal losing control of its own marketplace. Those keep `RequirePlatformOwner`.
 *
 * The fulfilment queue is not one of them. `/api/marketplace/admin/orders/**` was re-gated
 * server-side to `MANAGE_MARKETPLACE_ORDERS` + `VendorGuard.requireSeller()` + a
 * `seller_client_id` predicate, so a vendor already sees and advances exactly its own
 * orders there and nobody else's. Leaving `RequirePlatformOwner` on those routes would
 * lock vendors out of the one screen the whole feature exists for, while the API happily
 * answered — a UI-only refusal, which is the worst kind because nothing in the network tab
 * explains it.
 *
 * <h2>Why there is no RequireVendor beside it</h2>
 * Because nothing needs one. The vendor-only screen in this app is the dashboard, and that is
 * not a route — `/app` renders the seller's home in place of the buyer's for a vendor account
 * (see `DashboardPage`, which uses `isVendor` and explains why that one place goes the other
 * way). Every other seller surface — the catalogue, the order queue, sales figures, pickup
 * addresses — belongs to ProcurePal as well, so a vendor-only guard on any of them would be
 * the exact mistake `VendorGuard`'s Javadoc names as the most likely in this feature. If a
 * genuinely vendor-only route ever appears, `useAuth().isVendor` is already there for it.
 *
 * <h2>Not a substitute for the server's check</h2>
 * UI hygiene only, exactly like every other guard here. `isSeller` is read from a JWT claim
 * so the sidebar can be drawn before the first request; the server re-reads the clients row
 * on every call and is what actually enforces this.
 *
 * <p>Wrap it OUTSIDE `RequirePermission` so a buying company is bounced without the route
 * ever hinting at which permission it wanted.
 */
export function RequireSeller({ children }: { children: ReactNode }) {
  const { isSeller } = useAuth()

  if (!isSeller) {
    return <Navigate to="/app" replace />
  }

  return <>{children}</>
}
