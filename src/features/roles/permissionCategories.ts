import { PERMISSIONS } from '@/auth/permissions'

/**
 * Groups the permission codes a TENANT may hand out through a custom role, for the Roles &
 * Privileges matrix. Hand-maintained, same convention as auth/permissions.ts: the server is the
 * sole authority on what a code actually grants, this only decides how the matrix presents them.
 *
 * Deliberately not every code GET /api/permissions returns. Left out on purpose:
 *   - MANAGE_MARKETPLACE, MANAGE_MARKETPLACE_ORDERS, VIEW_MARKETPLACE_ANALYTICS,
 *     VIEW_OWN_SALES_ANALYTICS — ProcurePal-staff/vendor privileges, meaningless (and
 *     potentially misleading) on an ordinary buying company's own custom role; every screen they
 *     actually gate sits behind a platform-owner/vendor guard as well as the permission itself.
 *   - VIEW_ALL_BRANCHES — permissions.ts calls this "scaffold only, no branch-scoped queries
 *     exist yet"; offering a checkbox for a capability nothing reads would be worse than not
 *     offering it.
 *
 * A code the API returns that isn't listed here simply doesn't render as a checkbox - see
 * RoleFormModal - rather than needing a second allow-list kept in sync with this one.
 */
export const PERMISSION_CATEGORIES: { label: string; codes: string[] }[] = [
  {
    label: 'Users & roles',
    codes: [PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_ROLES],
  },
  {
    label: 'Products',
    codes: [PERMISSIONS.VIEW_PRODUCTS, PERMISSIONS.MANAGE_PRODUCTS, PERMISSIONS.PRODUCT_SKU_OVERRIDE],
  },
  {
    label: 'Inventory',
    codes: [PERMISSIONS.MANAGE_INVENTORY, PERMISSIONS.STOCK_IN, PERMISSIONS.STOCK_OUT],
  },
  {
    label: 'Vendors',
    codes: [PERMISSIONS.VIEW_VENDORS, PERMISSIONS.MANAGE_VENDORS, PERMISSIONS.RECEIVE_DELIVERIES],
  },
  {
    label: 'Purchasing',
    codes: [PERMISSIONS.BROWSE_MARKETPLACE, PERMISSIONS.PLACE_ORDERS, PERMISSIONS.VIEW_ORDERS, PERMISSIONS.MANAGE_DELIVERY_ADDRESSES],
  },
  {
    label: 'Company & analytics',
    codes: [PERMISSIONS.MANAGE_COMPANY_PROFILE, PERMISSIONS.VIEW_ANALYTICS],
  },
]

export const ASSIGNABLE_PERMISSION_CODES = new Set(PERMISSION_CATEGORIES.flatMap((category) => category.codes))
