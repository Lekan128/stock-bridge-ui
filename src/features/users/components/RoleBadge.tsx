import { Badge } from '@/components/Badge'
import { formatRoleName } from '@/features/users/formatters'
import type { UserRole } from '@/features/users/types'

/** Role codes are backend-defined, so the badge styles generically and humanises whatever it gets. */
export function RoleBadge({ role }: { role: UserRole }) {
  return <Badge variant="neutral">{formatRoleName(role)}</Badge>
}
