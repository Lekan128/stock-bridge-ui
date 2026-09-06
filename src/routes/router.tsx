import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { PERMISSIONS } from '@/auth/permissions'
import { RedirectIfAuthenticated } from '@/auth/RedirectIfAuthenticated'
import { RedirectIfSuperAdminAuthenticated } from '@/auth/RedirectIfSuperAdminAuthenticated'
import { RequireAuth } from '@/auth/RequireAuth'
import { RequirePermission } from '@/auth/RequirePermission'
import { RequirePlatformOwner } from '@/auth/RequirePlatformOwner'
import { RequireSeller } from '@/auth/RequireSeller'
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
const ProductSkuSettingsPage = lazy(() =>
  import('@/pages/ProductSkuSettingsPage').then((m) => ({
    default: m.ProductSkuSettingsPage,
  })),
)
// The bulk import pipeline (chooser → upload → review → confirm → result). Five chunks of its
// own rather than one: the review screen carries the grid and is by far the heaviest, and the
// three screens either side of it are reached by users who may never open it.
const ImportChooserPage = lazy(() =>
  import('@/features/imports/pages/ImportChooserPage').then((m) => ({
    default: m.ImportChooserPage,
  })),
)
const ImportUploadPage = lazy(() =>
  import('@/features/imports/pages/ImportUploadPage').then((m) => ({
    default: m.ImportUploadPage,
  })),
)
const ImportReviewPage = lazy(() =>
  import('@/features/imports/pages/ImportReviewPage').then((m) => ({
    default: m.ImportReviewPage,
  })),
)
const ImportConfirmPage = lazy(() =>
  import('@/features/imports/pages/ImportConfirmPage').then((m) => ({
    default: m.ImportConfirmPage,
  })),
)
const ImportResultPage = lazy(() =>
  import('@/features/imports/pages/ImportResultPage').then((m) => ({
    default: m.ImportResultPage,
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
const VendorListPage = lazy(() =>
  import('@/pages/VendorListPage').then((m) => ({
    default: m.VendorListPage,
  })),
)
const VendorDetailPage = lazy(() =>
  import('@/pages/VendorDetailPage').then((m) => ({
    default: m.VendorDetailPage,
  })),
)
const VendorPurchaseHistoryPage = lazy(() =>
  import('@/pages/VendorPurchaseHistoryPage').then((m) => ({
    default: m.VendorPurchaseHistoryPage,
  })),
)
const PurchaseHistoryPage = lazy(() =>
  import('@/pages/PurchaseHistoryPage').then((m) => ({
    default: m.PurchaseHistoryPage,
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
const AdminMarketplaceRevenuePage = lazy(() =>
  import('@/pages/AdminMarketplaceRevenuePage').then((m) => ({
    default: m.AdminMarketplaceRevenuePage,
  })),
)
const AdminAggregateAnalyticsPage = lazy(() =>
  import('@/pages/AdminAggregateAnalyticsPage').then((m) => ({
    default: m.AdminAggregateAnalyticsPage,
  })),
)
const AdminListingModerationPage = lazy(() =>
  import('@/pages/AdminListingModerationPage').then((m) => ({
    default: m.AdminListingModerationPage,
  })),
)
// A vendor's public storefront. Lazy rather than eager like the rest of the storefront: it is
// reached by clicking a seller name, never as a cold first paint, so it does not need to be in
// the entry chunk the way `/` and `/product/:idOrSlug` do.
const SellerStorefrontPage = lazy(() =>
  import('@/pages/SellerStorefrontPage').then((m) => ({
    default: m.SellerStorefrontPage,
  })),
)
const AdminPlatformOwnerUsersPage = lazy(() =>
  import('@/pages/AdminPlatformOwnerUsersPage').then((m) => ({
    default: m.AdminPlatformOwnerUsersPage,
  })),
)
// The public vendor application. Lazy rather than eager like `/signup` and `/login`: it is
// reached by clicking a link on the signup card, never as a cold first paint, so it does not
// need to be in the entry chunk.
const VendorApplicationPage = lazy(() =>
  import('@/pages/VendorApplicationPage').then((m) => ({
    default: m.VendorApplicationPage,
  })),
)
const AdminVendorWaitlistPage = lazy(() =>
  import('@/pages/AdminVendorWaitlistPage').then((m) => ({
    default: m.AdminVendorWaitlistPage,
  })),
)
const AdminVendorsPage = lazy(() =>
  import('@/pages/AdminVendorsPage').then((m) => ({
    default: m.AdminVendorsPage,
  })),
)
// Settlement policy (M9): the escrow hold. Lazy like every other admin screen — it is reached
// deliberately, a handful of times a year, and never as a first paint.
const AdminSettlementSettingsPage = lazy(() =>
  import('@/pages/AdminSettlementSettingsPage').then((m) => ({
    default: m.AdminSettlementSettingsPage,
  })),
)

// The seller's own workspace. All four are behind a login and none is a first paint, so they
// are lazy like the rest of `/app`. The vendor DASHBOARD is deliberately absent from this
// list: it is not a route of its own — `/app` renders it in place of the buyer dashboard for
// a vendor account (see DashboardPage), so it rides in DashboardPage's chunk.
const VendorCataloguePage = lazy(() =>
  import('@/pages/VendorCataloguePage').then((m) => ({
    default: m.VendorCataloguePage,
  })),
)
const VendorSalesAnalyticsPage = lazy(() =>
  import('@/pages/VendorSalesAnalyticsPage').then((m) => ({
    default: m.VendorSalesAnalyticsPage,
  })),
)
const VendorPickupAddressesPage = lazy(() =>
  import('@/pages/VendorPickupAddressesPage').then((m) => ({
    default: m.VendorPickupAddressesPage,
  })),
)
const VendorStatementPage = lazy(() =>
  import('@/pages/VendorStatementPage').then((m) => ({
    default: m.VendorStatementPage,
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
          {/* One seller's storefront. Public, like the rest of the catalog — a buyer deciding
              whether to order from a third party should not have to sign in to see who they are. */}
          <Route path="/seller/:idOrSlug" element={<SellerStorefrontPage />} />
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
        {/* Applying to sell. Deliberately NOT wrapped in RedirectIfAuthenticated, unlike the two
          above: those create or resume a session, so bouncing a signed-in user away from them is
          right. This creates no account at all — it adds a business to a waitlist a super admin
          reviews by hand — so a signed-in buyer who wants to also sell must be able to reach it. */}
        <Route path="/vendor-application" element={<VendorApplicationPage />} />

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
          {/* Static segment, declared above products/:id for the same reason products/import is —
            see that route's comment. Gated on MANAGE_PRODUCTS: configuring how SKUs get
            generated is the same authority as creating/editing products, not a read concern. */}
          <Route
            path="products/sku-settings"
            element={
              <RequirePermission permission={PERMISSIONS.MANAGE_PRODUCTS}>
                <ProductSkuSettingsPage />
              </RequirePermission>
            }
          />
          {/* Bulk import (bulk-import contract §7). Declared above `products/:id` for the
            reader's sake — react-router 7 ranks a static segment above a dynamic one regardless
            of source order, so `products/import` cannot be swallowed by `products/:id`, but a
            route table where that is only true because of a ranking rule is a trap for whoever
            edits it next.

            `anyOf`, not `permission`: the API authorizes MANAGE_PRODUCTS *or* MANAGE_INVENTORY
            (contract §3) and re-checks the kind-specific authority server-side against the
            loaded record, because the kind is not knowable from the URL on `/:sessionId`. The
            guard here mirrors exactly that method-level check and no more. Naming
            MANAGE_PRODUCTS alone would bounce a storekeeper — who holds only MANAGE_INVENTORY —
            out of bulk stock-in, the one flow the feature exists to serve, with a UI-only
            refusal the network tab would never explain. */}
          <Route
            path="products/import"
            element={
              <RequirePermission anyOf={[PERMISSIONS.MANAGE_PRODUCTS, PERMISSIONS.MANAGE_INVENTORY]}>
                <ImportChooserPage />
              </RequirePermission>
            }
          />
          <Route
            path="products/import/new"
            element={
              <RequirePermission anyOf={[PERMISSIONS.MANAGE_PRODUCTS, PERMISSIONS.MANAGE_INVENTORY]}>
                <ImportUploadPage />
              </RequirePermission>
            }
          />
          <Route
            path="products/import/:sessionId"
            element={
              <RequirePermission anyOf={[PERMISSIONS.MANAGE_PRODUCTS, PERMISSIONS.MANAGE_INVENTORY]}>
                <ImportReviewPage />
              </RequirePermission>
            }
          />
          <Route
            path="products/import/:sessionId/confirm"
            element={
              <RequirePermission anyOf={[PERMISSIONS.MANAGE_PRODUCTS, PERMISSIONS.MANAGE_INVENTORY]}>
                <ImportConfirmPage />
              </RequirePermission>
            }
          />
          <Route
            path="products/import/:sessionId/result"
            element={
              <RequirePermission anyOf={[PERMISSIONS.MANAGE_PRODUCTS, PERMISSIONS.MANAGE_INVENTORY]}>
                <ImportResultPage />
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

          {/* The buying company's own vendor directory. Gated on VIEW_VENDORS, which is wider than
            MANAGE_VENDORS on purpose — a finance officer reconciles against what was paid without
            maintaining the list — so the add/edit/remove affordances are gated separately inside
            the pages rather than by blocking the route. A STOREKEEPER holds neither code and does
            not reach these at all.

            Purchase history is a route of its own rather than a tab on the detail page, on the
            stakeholder's explicit instruction — and because it is paginated, so folding it in would
            either truncate it silently or make the detail screen pay for a page nobody scrolled to. */}
          <Route
            path="vendors"
            element={
              <RequirePermission permission={PERMISSIONS.VIEW_VENDORS}>
                <VendorListPage />
              </RequirePermission>
            }
          />
          <Route
            path="vendors/:id"
            element={
              <RequirePermission permission={PERMISSIONS.VIEW_VENDORS}>
                <VendorDetailPage />
              </RequirePermission>
            }
          />
          <Route
            path="vendors/:id/purchases"
            element={
              <RequirePermission permission={PERMISSIONS.VIEW_VENDORS}>
                <VendorPurchaseHistoryPage />
              </RequirePermission>
            }
          />
          {/* The company-wide feed above the per-vendor screen just above — same permission,
            since reading what was bought and from whom is the same authority either way. */}
          <Route
            path="purchases"
            element={
              <RequirePermission permission={PERMISSIONS.VIEW_VENDORS}>
                <PurchaseHistoryPage />
              </RequirePermission>
            }
          />

          {/* The seller's own workspace — a vendor's, or ProcurePal's. RequireSeller wraps
            RequirePermission, not the other way round: the VENDOR role holds MANAGE_MARKETPLACE
            and MANAGE_DELIVERY_ADDRESSES, but so does every buying company's OWNER, so the
            company-kind check is the one that actually keeps customers out. Mirrors the API's
            VendorGuard.requireSeller() on the same routes.

            Sales analytics carries NO RequirePermission, and that is not an oversight: the API
            accepts either VIEW_OWN_SALES_ANALYTICS (which vendors hold) or
            VIEW_MARKETPLACE_ANALYTICS (which ProcurePal's staff hold), and RequirePermission
            takes exactly one code — so naming either would bounce half the audience from a
            screen the server would have answered. */}
          <Route
            path="selling/catalogue"
            element={
              <RequireSeller>
                <RequirePermission permission={PERMISSIONS.MANAGE_MARKETPLACE}>
                  <VendorCataloguePage />
                </RequirePermission>
              </RequireSeller>
            }
          />
          <Route
            path="selling/analytics"
            element={
              <RequireSeller>
                <VendorSalesAnalyticsPage />
              </RequireSeller>
            }
          />
          {/* The statement carries no RequirePermission for the same reason sales analytics
            does not: the API accepts either VIEW_OWN_SALES_ANALYTICS or
            VIEW_MARKETPLACE_ANALYTICS, and RequirePermission takes exactly one code, so
            naming either would bounce half the audience off a screen the server answers.
            RequireSeller is the check that matters, and it mirrors the API's
            VendorGuard.requireSeller() on the same route — including for ProcurePal, which
            reaches this screen and is told, rather than refused, that it has no ledger. */}
          <Route
            path="selling/statement"
            element={
              <RequireSeller>
                <VendorStatementPage />
              </RequireSeller>
            }
          />
          <Route
            path="selling/pickup-addresses"
            element={
              <RequireSeller>
                <RequirePermission permission={PERMISSIONS.MANAGE_DELIVERY_ADDRESSES}>
                  <VendorPickupAddressesPage />
                </RequirePermission>
              </RequireSeller>
            }
          />

          {/* The fulfilment queue: RequireSeller, NOT RequirePlatformOwner.

            These two routes were ProcurePal-only until vendors could sell. The API behind them
            has since been re-gated to MANAGE_MARKETPLACE_ORDERS + requireSeller() + a
            seller_client_id predicate, so a vendor already sees and advances exactly its own
            orders and ProcurePal still sees exactly its own — one screen, two audiences, and no
            second order UI to keep in step. Leaving RequirePlatformOwner here would have locked
            vendors out of the one screen this whole feature exists for, while the API answered
            perfectly well: a UI-only refusal, which is the worst kind because nothing in the
            network tab explains it.

            Being the platform owner is not a widening either — ProcurePal cannot see or advance
            a vendor's order through these routes, because the predicate is the same predicate. */}
          <Route
            path="marketplace/orders"
            element={
              <RequireSeller>
                <RequirePermission permission={PERMISSIONS.MANAGE_MARKETPLACE_ORDERS}>
                  <MarketplaceOrderQueuePage />
                </RequirePermission>
              </RequireSeller>
            }
          />
          <Route
            path="marketplace/orders/:id"
            element={
              <RequireSeller>
                <RequirePermission permission={PERMISSIONS.MANAGE_MARKETPLACE_ORDERS}>
                  <MarketplaceOrderDetailPage />
                </RequirePermission>
              </RequireSeller>
            }
          />

          {/* Genuinely ProcurePal-only, and staying that way. The catalog screen carries the
            platform-wide category taxonomy and the commercial settings (delivery fee, minimum
            order value, pay-on-delivery rules) that govern EVERY seller's checkout, and
            marketplace analytics means every seller's revenue. Widening either to RequireSeller
            would hand the operator's controls to the companies they govern.

            RequirePlatformOwner wraps RequirePermission, not the other way round: every tenant's
            OWNER holds MANAGE_MARKETPLACE, so the platform-owner check is the one that actually
            keeps other companies out (contract §6). */}
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
          {/* Vendor listings awaiting review. A super-admin surface, not a marketplace-admin one:
              moderating a listing is a platform-operator action, and putting it on ProcurePal's
              own screens would have one seller adjudicating its competitors' products. */}
          <Route path="listings" element={<AdminListingModerationPage />} />
          {/* Vendor onboarding. Approving here is one of only two paths in the product that create
              a VENDOR-role account — the other is the Add vendor button on the Vendors screen —
              which is what keeps a tenant OWNER from ever minting one. */}
          <Route path="vendor-waitlist" element={<AdminVendorWaitlistPage />} />
          <Route path="vendors" element={<AdminVendorsPage />} />
          {/* Cross-seller revenue. A super-admin surface and not a marketplace-admin one for the
              same reason listing moderation is: M6 narrowed ProcurePal's own analytics to its own
              sales, and "every seller's revenue" on a tenant screen is one seller reading its
              competitors' book. Kept distinct from /admin/analytics, which reports STOCK MOVEMENT
              value per tenant — a different question from a different table. */}
          <Route path="revenue" element={<AdminMarketplaceRevenuePage />} />
          {/* The escrow hold: how long a vendor's confirmed money waits before it can be paid
              out. A super-admin surface and emphatically not a marketplace-admin one — a
              platform-owner tenant admin can already edit delivery fees and pay-on-delivery
              caps with no re-authentication, and this setting decides when real money leaves
              the business. Changing it needs the caller's own password and an explicit
              acknowledgement, and every change is audited and emailed to all super admins. */}
          <Route path="settlement-settings" element={<AdminSettlementSettingsPage />} />
          <Route path="analytics" element={<AdminAggregateAnalyticsPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
