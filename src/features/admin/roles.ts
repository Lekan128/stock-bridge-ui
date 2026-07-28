/**
 * The tenant role catalogue, hardcoded — the one place in this app that does not fetch it.
 *
 * features/users deliberately reads GET /api/roles instead, and that is still right there. It is
 * not an option here: /api/roles sits under /api/** , which SecurityConfig gates on the *tenant*
 * token audience, and it additionally requires MANAGE_USERS — a permission that only exists
 * inside a tenant. A super-admin token has neither, so the call is a 403 by construction, not by
 * oversight. The super-admin surface therefore carries its own copy.
 *
 * Names and descriptions are copied from Flyway V5, which is what /api/roles serves. If a role
 * is ever added there, add it here too — an unknown role code typed into a create request comes
 * back as a 400 (InvalidRoleException), so the cost of drift is visible rather than silent.
 */
export interface AdminRoleOption {
  name: string
  description: string
}

export const ADMIN_ROLE_OPTIONS: AdminRoleOption[] = [
  { name: 'OWNER', description: 'The account holder. Full access to every tenant feature and setting.' },
  { name: 'PROCUREMENT_MANAGER', description: 'Owns the product catalog, moves stock, and views analytics.' },
  { name: 'INVENTORY_OFFICER', description: 'Runs stock levels and reporting. Cannot edit the catalog.' },
  { name: 'FINANCE_OFFICER', description: 'Read-only. Sees the catalog and analytics, changes nothing.' },
  { name: 'STOREKEEPER', description: 'Records stock movements on the floor and views the catalog.' },
]
