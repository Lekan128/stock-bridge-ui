import { RoleBadge } from '@/features/users/components/RoleBadge'
import { UserActionsMenu } from '@/features/users/components/UserActionsMenu'
import { UserStatusBadge } from '@/features/users/components/UserStatusBadge'
import { formatDate } from '@/features/users/formatters'
import type { TenantUserSummary } from '@/features/users/types'

export interface UserCardProps {
  user: TenantUserSummary
  currentUserId?: string
  onEdit: (user: TenantUserSummary) => void
  onResetPassword: (user: TenantUserSummary) => void
  onDeactivate: (user: TenantUserSummary) => void
}

export function UserCard({ user, currentUserId, onEdit, onResetPassword, onDeactivate }: UserCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-neutral-900">{user.username}</p>
          <UserStatusBadge active={user.active} />
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <RoleBadge role={user.role} />
          <span className="text-xs text-neutral-500">Created {formatDate(user.createdAt)}</span>
        </div>
      </div>
      <UserActionsMenu
        user={user}
        isSelf={user.id === currentUserId}
        onEdit={() => onEdit(user)}
        onResetPassword={() => onResetPassword(user)}
        onDeactivate={() => onDeactivate(user)}
      />
    </div>
  )
}
