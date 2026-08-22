import { BarChart3, Building2, ClipboardList, Coins, Hourglass, Store, UserCog, type LucideIcon } from 'lucide-react'

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
  // Vendor onboarding (M2). The waitlist sits directly above Vendors because that is the order
  // the work happens in: an application becomes a vendor account, and a reviewer who has just
  // approved one very often wants to see it land.
  { path: '/admin/vendor-waitlist', label: 'Vendor Waitlist', icon: ClipboardList },
  { path: '/admin/vendors', label: 'Vendors', icon: Store },
  // Cross-seller revenue (M6). Sits directly above Aggregate Analytics because the two are
  // easy to confuse and the ordering is the cheapest place to draw the distinction: this one
  // is SALES across every seller — the figure ProcurePal's own screen deliberately no longer
  // shows — while the one below is STOCK MOVEMENT value per tenant, from a different table
  // and answering a different question.
  { path: '/admin/revenue', label: 'Marketplace Revenue', icon: Coins },
  { path: '/admin/analytics', label: 'Aggregate Analytics', icon: BarChart3 },
  // Settlement policy (M9). Last, and deliberately so: it is a settings screen visited a
  // handful of times a year, not a queue anybody works from, and putting it above the daily
  // surfaces would give a money-policy switch the prominence of a task list. It sits directly
  // below Marketplace Revenue because that is the screen an operator is usually looking at
  // when they start wondering about payout timing.
  { path: '/admin/settlement-settings', label: 'Settlement Settings', icon: Hourglass },
]
