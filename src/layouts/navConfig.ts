import {
  Building2,
  ChartLine,
  Contact,
  ClipboardList,
  History,
  LayoutDashboard,
  MapPin,
  PackageSearch,
  ReceiptText,
  Store,
  Tags,
  Truck,
  Users,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { PERMISSIONS, type Permission } from '@/auth/permissions'

export interface NavItem {
  path: string
  label: string
  icon: LucideIcon
  requiredPermission?: Permission
  /** Match `path` exactly instead of as a prefix — needed for the `/app` index route. */
  exact?: boolean
  /**
   * Marks a link out of the authenticated workspace and into the public storefront. Rendered
   * without active styling, since the sidebar isn't on screen once you follow it.
   */
  leavesWorkspace?: boolean
  /**
   * Drops this item for ProcurePal, inside a group ProcurePal otherwise belongs in.
   *
   * Needed exactly once, and the case is worth stating rather than generalising: the Selling
   * group is `sellerOnly`, which is correct — ProcurePal sells — but its "My Catalogue" entry
   * points at the seller-generic catalogue screen, and ProcurePal already has a richer one of
   * its own (Marketplace Catalog, with categories, settings and bulk listing). Two nav items
   * for the same job, one of them strictly weaker, is worse than one.
   *
   * The ROUTE stays open to ProcurePal — it is a seller and the API answers — so this hides a
   * duplicate, it does not withhold a capability.
   */
  hideFromPlatformOwner?: boolean
}

export interface NavGroup {
  /** Section heading. Omitted for the first group so the sidebar doesn't open with a label. */
  label?: string
  /**
   * Renders only for the ProcurePal tenant (`clients.is_platform_owner`). A permission check
   * would not be enough — every tenant's OWNER holds the MANAGE_MARKETPLACE* codes, so without
   * this flag every customer's owner would see ProcurePal's ops nav (contract §4.11 / §6).
   */
  platformOwnerOnly?: boolean
  /**
   * Renders only for accounts that SELL — a vendor, or ProcurePal (`AuthContext.isSeller`).
   *
   * Same reasoning as `platformOwnerOnly` and needed for the same reason: the VENDOR role
   * holds MANAGE_MARKETPLACE, MANAGE_MARKETPLACE_ORDERS and MANAGE_DELIVERY_ADDRESSES, but so
   * does every buying company's OWNER, so a permission check alone would show the selling nav
   * to customers. `client_type` is the fact that separates them, and it is a property of the
   * COMPANY rather than of the user — which is exactly why it cannot be a permission.
   *
   * Seller, not vendor: ProcurePal sells too, and gating these on `isVendor` would hide the
   * platform owner's own marketplace from it.
   */
  sellerOnly?: boolean
  /**
   * Hides the group from VENDOR accounts, whatever permissions the user holds.
   *
   * The inverse flag exists because the vendor problem is not only "they cannot see the
   * selling nav" — it is that a vendor lands in a BUYER'S app. The VENDOR role deliberately
   * lacks PLACE_ORDERS, VIEW_ORDERS and BROWSE_MARKETPLACE, so most buyer items already
   * filter themselves out by permission; MANAGE_DELIVERY_ADDRESSES is the exception, because
   * a vendor genuinely needs it — for PICKUP addresses, which is a different screen. Without
   * this flag a vendor's sidebar would offer "Delivery Addresses" pointing at an address book
   * for deliveries they never receive.
   *
   * Set on the whole Procurement group rather than on that one item, so a buyer-side item
   * added later inherits the exclusion instead of having to remember it.
   */
  hideFromVendors?: boolean
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { path: '/app', label: 'Dashboard', icon: LayoutDashboard, exact: true },
      // VIEW_PRODUCTS, not MANAGE_PRODUCTS — read-only roles can browse the catalog.
      { path: '/app/products', label: 'Inventory', icon: Warehouse, requiredPermission: PERMISSIONS.VIEW_PRODUCTS },
      { path: '/app/users', label: 'Users', icon: Users, requiredPermission: PERMISSIONS.MANAGE_USERS },
      // No permission gate, matching GET /api/company: everyone can read their own company, and
      // the Company ID shown there is what a colleague has to be told before they can log in.
      // Only the edit form inside is gated, on MANAGE_COMPANY_PROFILE.
      { path: '/app/company', label: 'Company', icon: Building2 },
    ],
  },
  {
    label: 'Procurement',
    // A vendor sells; it does not buy. See NavGroup.hideFromVendors.
    hideFromVendors: true,
    items: [
      // No permission gate: the storefront is public, so hiding the way to it would only
      // strand a user who is allowed to look at it anyway.
      { path: '/', label: 'Marketplace', icon: Store, leavesWorkspace: true },
      { path: '/app/orders', label: 'My Orders', icon: ReceiptText, requiredPermission: PERMISSIONS.VIEW_ORDERS },
      {
        path: '/app/addresses',
        label: 'Delivery Addresses',
        icon: MapPin,
        requiredPermission: PERMISSIONS.MANAGE_DELIVERY_ADDRESSES,
      },
      // VIEW_VENDORS, not MANAGE_VENDORS — reading the supplier list is deliberately wider than
      // maintaining it (finance and inventory both need it), and the page hides its own add/edit
      // controls behind MANAGE_VENDORS. A STOREKEEPER holds neither code, so this entry does not
      // render for them at all, which is the intent: prices and spend are not their business.
      { path: '/app/vendors', label: 'Suppliers', icon: Contact, requiredPermission: PERMISSIONS.VIEW_VENDORS },
      // The company-wide feed above the per-supplier screen reached from a Suppliers card —
      // same VIEW_VENDORS gate, since reading what was bought and from whom is one authority.
      {
        path: '/app/purchases',
        label: 'Purchase History',
        icon: History,
        requiredPermission: PERMISSIONS.VIEW_VENDORS,
      },
    ],
  },
  {
    // Everything a seller does with its own goods. Vendors AND ProcurePal, because both
    // sell — see NavGroup.sellerOnly.
    label: 'Selling',
    sellerOnly: true,
    items: [
      {
        path: '/app/selling/catalogue',
        label: 'My Catalogue',
        icon: PackageSearch,
        requiredPermission: PERMISSIONS.MANAGE_MARKETPLACE,
        // ProcurePal has Marketplace Catalog instead — see NavItem.hideFromPlatformOwner.
        hideFromPlatformOwner: true,
      },
      // The SAME route ProcurePal has always used. The server scopes it by
      // seller_client_id, so a vendor sees its own orders and ProcurePal sees its own —
      // one screen, two audiences, no second order UI to keep in step.
      {
        path: '/app/marketplace/orders',
        label: 'Order Queue',
        icon: ClipboardList,
        requiredPermission: PERMISSIONS.MANAGE_MARKETPLACE_ORDERS,
      },
      // Deliberately NO requiredPermission. The API accepts either
      // VIEW_OWN_SALES_ANALYTICS (which vendors hold) or VIEW_MARKETPLACE_ANALYTICS (which
      // ProcurePal's staff hold), and NavItem can express only one code — so gating on
      // either one here would hide the screen from half its audience. sellerOnly is the
      // check that matters, and the server refuses anyone holding neither.
      {
        path: '/app/selling/analytics',
        label: 'My Sales',
        icon: ChartLine,
      },
      // Deliberately NO requiredPermission, for the same reason "My Sales" above has none:
      // the API accepts either VIEW_OWN_SALES_ANALYTICS or VIEW_MARKETPLACE_ANALYTICS and
      // NavItem can express only one code. sellerOnly is the check that matters.
      {
        path: '/app/selling/statement',
        label: 'Statement',
        icon: ReceiptText,
      },
      {
        path: '/app/selling/pickup-addresses',
        label: 'Pickup Addresses',
        icon: Truck,
        requiredPermission: PERMISSIONS.MANAGE_DELIVERY_ADDRESSES,
      },
      // The public storefront, kept for sellers who cannot reach it through the Procurement
      // group — which is every vendor, since that whole group is hidden from them. The
      // storefront IS public and a seller has good reason to open it (checking how their own
      // listings render, most obviously), so hiding the buyer nav must not take the shop
      // itself with it. ProcurePal already has this link under Procurement and does not need
      // a second one.
      { path: '/', label: 'Storefront', icon: Store, leavesWorkspace: true, hideFromPlatformOwner: true },
    ],
  },
  {
    // What is left here is genuinely the OPERATOR's, not every seller's: the category
    // taxonomy and the commercial settings are platform-wide, and marketplace analytics
    // means every seller's revenue. The order queue moved to the Selling group above,
    // where ProcurePal still reaches it.
    label: 'ProcurePal',
    platformOwnerOnly: true,
    items: [
      {
        path: '/app/marketplace/products',
        label: 'Marketplace Catalog',
        icon: Tags,
        requiredPermission: PERMISSIONS.MANAGE_MARKETPLACE,
      },
      {
        path: '/app/marketplace/analytics',
        label: 'Marketplace Analytics',
        icon: ChartLine,
        requiredPermission: PERMISSIONS.VIEW_MARKETPLACE_ANALYTICS,
      },
    ],
  },
]

/** Flattened view — used for the Topbar's page-title lookup. */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items)

/**
 * Resolves the page title for a workspace path. Longest match wins, so `/app/products/:id`
 * resolves to "Inventory" rather than to "Dashboard" via the `/app` prefix.
 */
export function findNavItemForPath(pathname: string): NavItem | undefined {
  return NAV_ITEMS.filter((item) => !item.leavesWorkspace)
    .filter((item) => (item.exact ? item.path === pathname : pathname === item.path || pathname.startsWith(`${item.path}/`)))
    .sort((a, b) => b.path.length - a.path.length)[0]
}
