import { LayoutDashboard, Users, Warehouse, type LucideIcon } from 'lucide-react'
import { PERMISSIONS, type Permission } from '@/auth/permissions'

export interface NavItem {
  path: string
  label: string
  icon: LucideIcon
  requiredPermission?: Permission
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  // VIEW_PRODUCTS, not MANAGE_PRODUCTS — read-only roles can browse the catalog.
  { path: '/products', label: 'Inventory', icon: Warehouse, requiredPermission: PERMISSIONS.VIEW_PRODUCTS },
  { path: '/users', label: 'Users', icon: Users, requiredPermission: PERMISSIONS.MANAGE_USERS },
]
