import { Badge } from '@/components/Badge'
import { formatRoleName } from '@/features/users/formatters'

/**
 * A system role's name is a backend code (humanised here); a custom role's name is whatever the
 * tenant typed when they created it, so it renders as-is — see Role.isSystem.
 */
export function RoleBadge({ roleName, isSystem }: { roleName: string; isSystem: boolean }) {
  return <Badge variant="neutral">{isSystem ? formatRoleName(roleName) : roleName}</Badge>
}
