import { AccountOwnerBadge } from '@/features/users/components/AccountOwnerBadge'
import { RoleBadge } from '@/features/users/components/RoleBadge'
import { UserActionsMenu } from '@/features/users/components/UserActionsMenu'
import { UserStatusBadge } from '@/features/users/components/UserStatusBadge'
import { formatDate, formatFullName } from '@/features/users/formatters'
import type { TenantUserSummary } from '@/features/users/types'

export interface UserCardProps {
  user: TenantUserSummary
  currentUserId?: string
  onEdit: (user: TenantUserSummary) => void
  onResetPassword: (user: TenantUserSummary) => void
  onDeactivate: (user: TenantUserSummary) => void
}

export function UserCard({ user, currentUserId, onEdit, onResetPassword, onDeactivate }: UserCardProps) {
  const fullName = formatFullName(user.firstName, user.lastName)
  const secondary = [user.jobTitle, user.email].filter(Boolean).join(' · ')

  return (
    <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-neutral-900">{fullName ?? user.username}</p>
          <UserStatusBadge active={user.active} />
        </div>
        {fullName && <p className="mt-0.5 truncate text-xs text-neutral-500">{user.username}</p>}
        {secondary && <p className="mt-0.5 truncate text-xs text-neutral-500">{secondary}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <RoleBadge role={user.role} />
          {user.root && <AccountOwnerBadge />}
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
