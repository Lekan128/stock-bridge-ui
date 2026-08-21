import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { PERMISSIONS } from '@/auth/permissions'
import { RedirectIfAuthenticated } from '@/auth/RedirectIfAuthenticated'
import { RedirectIfSuperAdminAuthenticated } from '@/auth/RedirectIfSuperAdminAuthenticated'
import { RequireAuth } from '@/auth/RequireAuth'
import { RequirePermission } from '@/auth/RequirePermission'
import { RequirePlatformOwner } from '@/auth/RequirePlatformOwner'
import { RequireSuperAdmin } from '@/auth/RequireSuperAdmin'
import { BootstrappingScreen } from '@/components/BootstrappingScreen'
import { AdminLayout } from '@/layouts/AdminLayout'
import { AppLayout } from '@/layouts/AppLayout'
import { StorefrontLayout } from '@/layouts/StorefrontLayout'

// Eager: the public storefront and auth. These are the first paint for an anonymous visitor
// arriving at `/`, so they must not wait on a second network round trip.
import { CartPage } from '@/pages/CartPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { SignupPage } from '@/pages/SignupPage'
import { StorefrontHomePage } from '@/pages/StorefrontHomePage'
import { StorefrontProductDetailPage } from '@/pages/StorefrontProductDetailPage'
// Eager for the same reason as the storefront: `/verify-email` is an entry point clicked from an
// email, by someone with no warm cache and often no session, and making them wait on a second
// round trip for a chunk before anything appears is the wrong trade for a page this small.
import { VerifyEmailPage } from '@/pages/VerifyEmailPage'

/**
 * Everything past the storefront is code-split.
 *
 * The whole app was one 1.2MB chunk, which the storefront paid for on first load even though a
 * browsing visitor touches none of it. The workspace, the ProcurePal admin screens and the super
 * admin panel are all behind a login, and the analytics pages drag in recharts — by far the
 * heaviest dependency — so keeping them out of the entry chunk is most of the win.
 *
 * `lazy()` wants a default export and this codebase exports components by name throughout, hence
 * the `.then(m => ({ default: m.X }))` unwrapping rather than changing every page's export style.
 */
const CheckoutPage = lazy(() =>
  import('@/pages/CheckoutPage').then((m) => ({ default: m.CheckoutPage })),
)
const PaymentReturnPage = lazy(() =>
  import('@/pages/PaymentReturnPage').then((m) => ({
    default: m.PaymentReturnPage,
  })),
)
const OrderConfirmationPage = lazy(() =>
  import('@/pages/OrderConfirmationPage').then((m) => ({
    default: m.OrderConfirmationPage,
  })),
)

const DashboardPage = lazy(() =>
  import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const ProductsPage = lazy(() =>
  import('@/pages/ProductsPage').then((m) => ({ default: m.ProductsPage })),
)
const ProductDetailPage = lazy(() =>
  import('@/pages/ProductDetailPage').then((m) => ({
    default: m.ProductDetailPage,
  })),
)
const ProductFormPage = lazy(() =>
  import('@/pages/ProductFormPage').then((m) => ({
    default: m.ProductFormPage,
  })),
)
const LowStockProductsPage = lazy(() =>
  import('@/pages/LowStockProductsPage').then((m) => ({
    default: m.LowStockProductsPage,
  })),
)
const OrderListPage = lazy(() =>
  import('@/pages/OrderListPage').then((m) => ({ default: m.OrderListPage })),
)
const OrderDetailPage = lazy(() =>
  import('@/pages/OrderDetailPage').then((m) => ({
    default: m.OrderDetailPage,
  })),
)
const AddressListPage = lazy(() =>
  import('@/pages/AddressListPage').then((m) => ({
    default: m.AddressListPage,
  })),
)
const ProfilePage = lazy(() =>
  import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })),
)
const UsersPage = lazy(() => import('@/pages/UsersPage').then((m) => ({ default: m.UsersPage })))
const CompanySettingsPage = lazy(() =>
  import('@/pages/CompanySettingsPage').then((m) => ({
    default: m.CompanySettingsPage,
  })),
)

const MarketplaceProductsPage = lazy(() =>
  import('@/pages/MarketplaceProductsPage').then((m) => ({
    default: m.MarketplaceProductsPage,
  })),
)
const MarketplaceOrderQueuePage = lazy(() =>
  import('@/pages/MarketplaceOrderQueuePage').then((m) => ({
    default: m.MarketplaceOrderQueuePage,
  })),
)
const MarketplaceOrderDetailPage = lazy(() =>
  import('@/pages/MarketplaceOrderDetailPage').then((m) => ({
    default: m.MarketplaceOrderDetailPage,
  })),
)
const MarketplaceAnalyticsPage = lazy(() =>
  import('@/pages/MarketplaceAnalyticsPage').then((m) => ({
    default: m.MarketplaceAnalyticsPage,
  })),
)

const SuperAdminLoginPage = lazy(() =>
  import('@/pages/SuperAdminLoginPage').then((m) => ({
    default: m.SuperAdminLoginPage,
  })),
)
const AdminTenantsPage = lazy(() =>
  import('@/pages/AdminTenantsPage').then((m) => ({
    default: m.AdminTenantsPage,
  })),
)
const AdminTenantDetailPage = lazy(() =>
  import('@/pages/AdminTenantDetailPage').then((m) => ({
    default: m.AdminTenantDetailPage,
  })),
)
const AdminAggregateAnalyticsPage = lazy(() =>
  import('@/pages/AdminAggregateAnalyticsPage').then((m) => ({
    default: m.AdminAggregateAnalyticsPage,
  })),
)
const AdminPlatformOwnerUsersPage = lazy(() =>
  import('@/pages/AdminPlatformOwnerUsersPage').then((m) => ({
    default: m.AdminPlatformOwnerUsersPage,
  })),
)

/**
 * <Navigate> takes a literal path and cannot interpolate route params, so the legacy
 * `/products/:id` links need a component that reads them before redirecting.
 */
function LegacyProductRedirect({ suffix = '' }: { suffix?: string }) {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/app/products/${id}${suffix}`} replace />
}

/**
 * Every route in the app.
 *
 * Three trees, split by path:
 *   `/…`      the public ProcurePal storefront (catalog, cart, checkout) under StorefrontLayout
 *   `/app/…`  the authenticated tenant workspace (was `/`) under AppLayout
 *   `/admin/…` super admin, unchanged
 *
 * This file is owned exclusively by M2. Feature modules fill in the components it points at; they
 * never add routes here, which is what keeps nine parallel workstreams out of each other's way.
 */
export function AppRoutes() {
  return (
    // One boundary around the whole tree rather than per route: the fallback only ever shows
    // while a lazy chunk is in flight, which on a warm cache is imperceptible, and a single
    // boundary keeps route definitions readable.
    <Suspense fallback={<BootstrappingScreen />}>
      <Routes>
        {/* ---------------------------------------------------------------- Public storefront */}
        <Route element={<StorefrontLayout />}>
          <Route path="/" element={<StorefrontHomePage />} />
          <Route path="/product/:idOrSlug" element={<StorefrontProductDetailPage />} />
          {/* Anonymous carts are allowed — the cart lives in localStorage until login (contract §8). */}
          <Route path="/cart" element={<CartPage />} />
          <Route
            path="/checkout"
            element={
              <RequireAuth>
                <CheckoutPage />
              </RequireAuth>
            }
          />
          {/* Both Monnify landing paths render the same verify-and-route screen: `/checkout/return`
            is the configured redirect URL, `/checkout/processing` the in-app waiting state. */}
          <Route
            path="/checkout/processing"
            element={
              <RequireAuth>
                <PaymentReturnPage />
              </RequireAuth>
            }
          />
          <Route
            path="/checkout/return"
            element={
              <RequireAuth>
                <PaymentReturnPage />
              </RequireAuth>
            }
          />
          <Route
            path="/order-confirmation/:orderId"
            element={
              <RequireAuth>
                <OrderConfirmationPage />
              </RequireAuth>
            }
          />

          {/* The target of the link in every confirmation email. Deliberately public and
            deliberately inside the storefront chrome: the person clicking may have no session on
            this device (phone vs. the laptop they signed up on), and whatever the outcome they
            should land somewhere with navigation rather than on an orphaned card. */}
          <Route path="/verify-email" element={<VerifyEmailPage />} />

          {/* Unmatched paths keep the storefront chrome, so a bad link is never a dead end. */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* ---------------------------------------------------------------------- Company auth */}
        {/* Deliberately outside StorefrontLayout: AuthCard is a full-screen centred card, and both
          pages link back to the storefront themselves. */}
        <Route
          path="/login"
          element={
            <RedirectIfAuthenticated>
              <LoginPage />
            </RedirectIfAuthenticated>
          }
        />
        <Route
          path="/signup"
          element={
            <RedirectIfAuthenticated>
              <SignupPage />
            </RedirectIfAuthenticated>
          }
        />

        {/* ------------------------------------------------------- Legacy workspace paths → /app */}
        {/* The workspace moved from `/` to `/app` when `/` became the storefront. These keep every
          bookmark, emailed link and stale browser autocomplete working. */}
        <Route path="/products" element={<Navigate to="/app/products" replace />} />
        <Route path="/products/new" element={<Navigate to="/app/products/new" replace />} />
        <Route
          path="/products/low-stock"
          element={<Navigate to="/app/products/low-stock" replace />}
        />
        <Route path="/products/:id" element={<LegacyProductRedirect />} />
        <Route path="/products/:id/edit" element={<LegacyProductRedirect suffix="/edit" />} />
        <Route path="/users" element={<Navigate to="/app/users" replace />} />
        <Route path="/profile" element={<Navigate to="/app/profile" replace />} />
        {/* Analytics folded into the dashboard before this change; it now redirects one hop further. */}
        <Route path="/analytics" element={<Navigate to="/app" replace />} />

        {/* ------------------------------------------------------------- Authenticated workspace */}
        <Route
          path="/app"
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />

          {/* Reading the catalog needs VIEW_PRODUCTS (every role has it); writing needs MANAGE_PRODUCTS. */}
          <Route
            path="products"
            element={
              <RequirePermission permission={PERMISSIONS.VIEW_PRODUCTS}>
                <ProductsPage />
              </RequirePermission>
            }
          />
          <Route
            path="products/new"
            element={
              <RequirePermission permission={PERMISSIONS.MANAGE_PRODUCTS}>
                <ProductFormPage />
              </RequirePermission>
            }
          />
          <Route
            path="products/low-stock"
            element={
              <RequirePermission permission={PERMISSIONS.VIEW_PRODUCTS}>
                <LowStockProductsPage />
              </RequirePermission>
            }
          />
          <Route
            path="products/:id"
            element={
              <RequirePermission permission={PERMISSIONS.VIEW_PRODUCTS}>
                <ProductDetailPage />
              </RequirePermission>
            }
          />
          <Route
            path="products/:id/edit"
            element={
              <RequirePermission permission={PERMISSIONS.MANAGE_PRODUCTS}>
                <ProductFormPage />
              </RequirePermission>
            }
          />

          {/* Buyer side of the marketplace. */}
          <Route
            path="orders"
            element={
              <RequirePermission permission={PERMISSIONS.VIEW_ORDERS}>
                <OrderListPage />
              </RequirePermission>
            }
          />
          <Route
            path="orders/:id"
            element={
              <RequirePermission permission={PERMISSIONS.VIEW_ORDERS}>
                <OrderDetailPage />
              </RequirePermission>
            }
          />
          <Route
            path="addresses"
            element={
              <RequirePermission permission={PERMISSIONS.MANAGE_DELIVERY_ADDRESSES}>
                <AddressListPage />
              </RequirePermission>
            }
          />

          {/* ProcurePal-only. RequirePlatformOwner wraps RequirePermission, not the other way round:
            every tenant's OWNER holds MANAGE_MARKETPLACE, so the platform-owner check is the one
            that actually keeps other companies out (contract §6). */}
          <Route path="marketplace" element={<Navigate to="/app/marketplace/products" replace />} />
          <Route
            path="marketplace/products"
            element={
              <RequirePlatformOwner>
                <RequirePermission permission={PERMISSIONS.MANAGE_MARKETPLACE}>
                  <MarketplaceProductsPage />
                </RequirePermission>
              </RequirePlatformOwner>
            }
          />
          <Route
            path="marketplace/orders"
            element={
              <RequirePlatformOwner>
                <RequirePermission permission={PERMISSIONS.MANAGE_MARKETPLACE_ORDERS}>
                  <MarketplaceOrderQueuePage />
                </RequirePermission>
              </RequirePlatformOwner>
            }
          />
          <Route
            path="marketplace/orders/:id"
            element={
              <RequirePlatformOwner>
                <RequirePermission permission={PERMISSIONS.MANAGE_MARKETPLACE_ORDERS}>
                  <MarketplaceOrderDetailPage />
                </RequirePermission>
              </RequirePlatformOwner>
            }
          />
          <Route
            path="marketplace/analytics"
            element={
              <RequirePlatformOwner>
                <RequirePermission permission={PERMISSIONS.VIEW_MARKETPLACE_ANALYTICS}>
                  <MarketplaceAnalyticsPage />
                </RequirePermission>
              </RequirePlatformOwner>
            }
          />

          {/* Self-service — every authenticated tenant user, no permission required. */}
          <Route path="profile" element={<ProfilePage />} />
          {/* Deliberately ungated, mirroring the backend: GET /api/company carries no
            @PreAuthorize, so a storekeeper can read their company's details (including the
            Company ID they need to onboard a colleague) even though only an OWNER can change
            them. The page gates the edit form on MANAGE_COMPANY_PROFILE instead. */}
          <Route path="company" element={<CompanySettingsPage />} />
          <Route
            path="users"
            element={
              <RequirePermission permission={PERMISSIONS.MANAGE_USERS}>
                <UsersPage />
              </RequirePermission>
            }
          />
          {/* Analytics now lives on the dashboard — keep old in-workspace links working. */}
          <Route path="analytics" element={<Navigate to="/app" replace />} />

          {/* A bad `/app/...` path keeps the sidebar, so the user can navigate out of it. */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* ------------------------------------------------------------------------- Super admin */}
        <Route
          path="/admin/login"
          element={
            <RedirectIfSuperAdminAuthenticated>
              <SuperAdminLoginPage />
            </RedirectIfSuperAdminAuthenticated>
          }
        />

        <Route
          path="/admin"
          element={
            <RequireSuperAdmin>
              <AdminLayout />
            </RequireSuperAdmin>
          }
        >
          <Route index element={<Navigate to="tenants" replace />} />
          <Route path="tenants" element={<AdminTenantsPage />} />
          <Route path="tenants/:id" element={<AdminTenantDetailPage />} />
          {/* ProcurePal's own staff accounts — the one tenant a super admin may write. Every
            other tenant's users are read-only, on the Users section of the tenant detail page,
            because no API exists to write them. */}
          <Route path="procurepal-users" element={<AdminPlatformOwnerUsersPage />} />
          <Route path="analytics" element={<AdminAggregateAnalyticsPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
