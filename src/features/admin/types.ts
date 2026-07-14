export interface SuperAdminClientSummary {
  id: string
  name: string
  slug: string
  active: boolean
  adminEmail: string
  userCount: number
  productCount: number
  createdAt: string
}

export interface SuperAdminClientDetail extends SuperAdminClientSummary {
  updatedAt: string
  activeUserCount: number
  activeProductCount: number
  lowStockProductCount: number
}

export interface TenantBreakdownEntry {
  clientId: string
  clientName: string
  active: boolean
  activeUserCount: number
  activeProductCount: number
  stockInValue: number
  stockOutValue: number
}

export interface PlatformAggregateResponse {
  totalActiveClients: number
  totalActiveUsers: number
  totalActiveProducts: number
  totalStockInValue: number
  totalStockOutValue: number
  tenantBreakdown: TenantBreakdownEntry[]
}

export type ClientStatusFilter = 'all' | 'active' | 'suspended'

export interface ClientListParams {
  search?: string
  active?: boolean
  page?: number
  size?: number
}
