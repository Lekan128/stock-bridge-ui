import { BarChart3, LayoutDashboard, Package, Users, Warehouse, type LucideIcon } from 'lucide-react'
import { PERMISSIONS, type Permission } from '@/auth/permissions'

export interface NavItem {
  path: string
  label: string
  icon: LucideIcon
  requiredPermission?: Permission
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/products', label: 'Products', icon: Package, requiredPermission: PERMISSIONS.MANAGE_PRODUCTS },
  { path: '/inventory', label: 'Inventory', icon: Warehouse, requiredPermission: PERMISSIONS.MANAGE_INVENTORY },
  { path: '/analytics', label: 'Analytics', icon: BarChart3, requiredPermission: PERMISSIONS.VIEW_ANALYTICS },
  { path: '/users', label: 'Users', icon: Users, requiredPermission: PERMISSIONS.MANAGE_USERS },
]
