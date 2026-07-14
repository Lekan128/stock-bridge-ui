import { BarChart3, Building2, type LucideIcon } from 'lucide-react'

export interface AdminNavItem {
  path: string
  label: string
  icon: LucideIcon
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { path: '/admin/tenants', label: 'Tenants', icon: Building2 },
  { path: '/admin/analytics', label: 'Aggregate Analytics', icon: BarChart3 },
]
