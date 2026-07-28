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

  // Marketplace — buyer side (contract §4.11).
  BROWSE_MARKETPLACE: 'BROWSE_MARKETPLACE',
  PLACE_ORDERS: 'PLACE_ORDERS',
  VIEW_ORDERS: 'VIEW_ORDERS',
  MANAGE_DELIVERY_ADDRESSES: 'MANAGE_DELIVERY_ADDRESSES',
  RECEIVE_DELIVERIES: 'RECEIVE_DELIVERIES',
  // Scaffold only — no branch-scoped queries exist yet (contract §4.2).
  VIEW_ALL_BRANCHES: 'VIEW_ALL_BRANCHES',

  // Marketplace — ProcurePal side. Every tenant's OWNER holds these, so they are NEVER
  // sufficient on their own: the route must also be behind RequirePlatformOwner, mirroring
  // the second, independent platform-owner guard on the backend (contract §6).
  MANAGE_MARKETPLACE: 'MANAGE_MARKETPLACE',
  MANAGE_MARKETPLACE_ORDERS: 'MANAGE_MARKETPLACE_ORDERS',
  VIEW_MARKETPLACE_ANALYTICS: 'VIEW_MARKETPLACE_ANALYTICS',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]
