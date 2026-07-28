import { BarChart3, Building2, UserCog, type LucideIcon } from 'lucide-react'

export interface AdminNavItem {
  path: string
  label: string
  icon: LucideIcon
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { path: '/admin/tenants', label: 'Tenants', icon: Building2 },
  // ProcurePal's own staff accounts. Not gated on anything: super admin is a single flat role,
  // and the screen handles the "ProcurePal was never bootstrapped" case itself rather than
  // vanishing from the nav, which would leave nowhere to find out why.
  { path: '/admin/procurepal-users', label: 'ProcurePal Users', icon: UserCog },
  { path: '/admin/analytics', label: 'Aggregate Analytics', icon: BarChart3 },
]
