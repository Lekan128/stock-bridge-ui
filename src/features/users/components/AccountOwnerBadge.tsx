import { ShieldCheck } from 'lucide-react'

/**
 * Marks the tenant's root user. Deliberately styled apart from RoleBadge/UserStatusBadge —
 * it explains why the role, status and password controls are locked for that row.
 */
export function AccountOwnerBadge({ title }: { title?: string }) {
  return (
    <span
      title={title ?? "The account owner's role and status are protected"}
      className="inline-flex items-center gap-1 rounded-sm border border-primary-200 bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700"
    >
      <ShieldCheck className="h-3 w-3" />
      Account owner
    </span>
  )
}
