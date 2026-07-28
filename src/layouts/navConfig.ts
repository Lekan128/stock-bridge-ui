import {
  ChartLine,
  ClipboardList,
  LayoutDashboard,
  MapPin,
  ReceiptText,
  Store,
  Tags,
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
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { path: '/app', label: 'Dashboard', icon: LayoutDashboard, exact: true },
      // VIEW_PRODUCTS, not MANAGE_PRODUCTS — read-only roles can browse the catalog.
      { path: '/app/products', label: 'Inventory', icon: Warehouse, requiredPermission: PERMISSIONS.VIEW_PRODUCTS },
      { path: '/app/users', label: 'Users', icon: Users, requiredPermission: PERMISSIONS.MANAGE_USERS },
    ],
  },
  {
    label: 'Procurement',
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
    ],
  },
  {
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
        path: '/app/marketplace/orders',
        label: 'Order Queue',
        icon: ClipboardList,
        requiredPermission: PERMISSIONS.MANAGE_MARKETPLACE_ORDERS,
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
