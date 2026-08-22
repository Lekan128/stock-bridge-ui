/**
 * Mirror of the backend permission codes (Flyway V1, V5 and V6). Adding a code here does not
 * grant anything — the server is the sole authority — it only lets the UI hide what a call
 * would be rejected for anyway.
 */
export const PERMISSIONS = {
  MANAGE_USERS: 'MANAGE_USERS',
  MANAGE_ROLES: 'MANAGE_ROLES',
  MANAGE_PRODUCTS: 'MANAGE_PRODUCTS',
  VIEW_PRODUCTS: 'VIEW_PRODUCTS',
  MANAGE_INVENTORY: 'MANAGE_INVENTORY',
  VIEW_ANALYTICS: 'VIEW_ANALYTICS',

  /**
   * Edit the caller's own company record — PUT /api/company. Granted to OWNER alone (V7).
   * Reading the company (GET /api/company) is deliberately ungated on the backend, so this
   * code gates the *edit affordance* on the company settings page, never the page itself.
   */
  MANAGE_COMPANY_PROFILE: 'MANAGE_COMPANY_PROFILE',

  // Marketplace — buyer side (contract §4.11).
  BROWSE_MARKETPLACE: 'BROWSE_MARKETPLACE',
  PLACE_ORDERS: 'PLACE_ORDERS',
  VIEW_ORDERS: 'VIEW_ORDERS',
  MANAGE_DELIVERY_ADDRESSES: 'MANAGE_DELIVERY_ADDRESSES',
  RECEIVE_DELIVERIES: 'RECEIVE_DELIVERIES',
  // Scaffold only — no branch-scoped queries exist yet (contract §4.2).
  VIEW_ALL_BRANCHES: 'VIEW_ALL_BRANCHES',

  /**
   * The buying company's own vendor directory — `/api/company-vendors` (V11).
   *
   * Two codes because reading is wider than writing, mirroring the backend seeding exactly:
   * VIEW_VENDORS goes to OWNER, PROCUREMENT_MANAGER, FINANCE_OFFICER and INVENTORY_OFFICER —
   * finance reconciles against what was paid, inventory needs to know where stock came from.
   * MANAGE_VENDORS is OWNER and PROCUREMENT_MANAGER only: maintaining the supplier list is a
   * procurement decision. STOREKEEPER holds neither, so the nav entry does not render for them.
   *
   * Note what MANAGE_VENDORS does *not* buy: a VERIFIED entry (one created automatically when the
   * company bought from a ProcurePaddy seller) is still not editable by anybody, whatever their
   * role — the server answers 409. The UI hides the edit affordance on those rows from the
   * `editable` flag the server sends, not from this permission.
   */
  VIEW_VENDORS: 'VIEW_VENDORS',
  MANAGE_VENDORS: 'MANAGE_VENDORS',

  // Marketplace — ProcurePal side. Every tenant's OWNER holds these, so they are NEVER
  // sufficient on their own: the route must also be behind RequirePlatformOwner, mirroring
  // the second, independent platform-owner guard on the backend (contract §6).
  MANAGE_MARKETPLACE: 'MANAGE_MARKETPLACE',
  MANAGE_MARKETPLACE_ORDERS: 'MANAGE_MARKETPLACE_ORDERS',
  VIEW_MARKETPLACE_ANALYTICS: 'VIEW_MARKETPLACE_ANALYTICS',

  /**
   * A seller's OWN sales figures — `/api/vendor/analytics/*` (V11 seeded the code, and the
   * vendor workspace is what finally serves it).
   *
   * The asymmetry to know about: the VENDOR role holds this and NOT
   * VIEW_MARKETPLACE_ANALYTICS (which means the whole marketplace, every seller's revenue).
   * ProcurePal's staff hold the opposite pair — the old code, not this one — even though
   * ProcurePal has own-sales numbers like any seller. The API therefore accepts EITHER code
   * and relies on its seller guard, and any UI check here must do the same: gating a sales
   * screen on this code alone hides it from the platform owner.
   */
  VIEW_OWN_SALES_ANALYTICS: 'VIEW_OWN_SALES_ANALYTICS',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]
