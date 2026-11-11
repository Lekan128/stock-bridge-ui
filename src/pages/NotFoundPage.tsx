import { Compass } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { buttonClassName } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { MARKETPLACE_OPEN } from '@/features/storefront/marketplaceLaunch'
import { marketplacePaths } from '@/routes/marketplacePaths'

/**
 * Rendered inside whichever layout the bad path fell through to — storefront chrome for public
 * paths, the workspace shell for `/app/*` — so it is a panel rather than a full-screen takeover.
 * Both exits are offered, because the app now has two front doors.
 */
export function NotFoundPage() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="px-4 py-16 sm:px-6 lg:px-8">
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="That link doesn't lead anywhere — it may have moved, or the address may be mistyped."
        action={
          <>
            {/* Before launch the marketplace is an "opens soon" page, not somewhere to recover to. */}
            <Link to={MARKETPLACE_OPEN ? marketplacePaths.home : '/'} className={buttonClassName('primary')}>
              {MARKETPLACE_OPEN ? 'Go to the marketplace' : 'Go to the home page'}
            </Link>
            {isAuthenticated && (
              <Link to="/app" className={buttonClassName('secondary')}>
                My workspace
              </Link>
            )}
          </>
        }
      />
    </div>
  )
}
