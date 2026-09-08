/** One entry of GET /api/permissions — the full privilege catalogue, not just what some role holds. */
export interface PermissionCatalogEntry {
  code: string
  description: string
}

export interface CreateRolePayload {
  name: string
  description?: string | null
  permissionCodes: string[]
}

export interface UpdateRolePayload {
  name: string
  description?: string | null
  permissionCodes: string[]
}
