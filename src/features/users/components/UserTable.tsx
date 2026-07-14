import { RoleBadge } from '@/features/users/components/RoleBadge'
import { UserActionsMenu } from '@/features/users/components/UserActionsMenu'
import { UserStatusBadge } from '@/features/users/components/UserStatusBadge'
import { formatDate } from '@/features/users/formatters'
import type { TenantUserSummary } from '@/features/users/types'

export interface UserTableProps {
  users: TenantUserSummary[]
  currentUserId?: string
  onEdit: (user: TenantUserSummary) => void
  onResetPassword: (user: TenantUserSummary) => void
  onDeactivate: (user: TenantUserSummary) => void
}

const columns = ['Username', 'Role', 'Status', 'Created']

export function UserTable({ users, currentUserId, onEdit, onResetPassword, onDeactivate }: UserTableProps) {
  return (
    <table className="w-full border-separate border-spacing-0 text-sm">
      <thead>
        <tr>
          {columns.map((label) => (
            <th
              key={label}
              scope="col"
              className="border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 text-left text-xs font-medium text-neutral-500"
            >
              {label}
            </th>
          ))}
          <th scope="col" className="border-b border-neutral-200 bg-neutral-50 px-4 py-2.5" />
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <tr key={user.id}>
            <td className="border-b border-neutral-100 px-4 py-2.5 font-medium text-neutral-900">{user.username}</td>
            <td className="border-b border-neutral-100 px-4 py-2.5">
              <RoleBadge role={user.role} />
            </td>
            <td className="border-b border-neutral-100 px-4 py-2.5">
              <UserStatusBadge active={user.active} />
            </td>
            <td className="border-b border-neutral-100 px-4 py-2.5 text-neutral-600">{formatDate(user.createdAt)}</td>
            <td className="border-b border-neutral-100 px-4 py-2.5 text-right">
              <UserActionsMenu
                user={user}
                isSelf={user.id === currentUserId}
                onEdit={() => onEdit(user)}
                onResetPassword={() => onResetPassword(user)}
                onDeactivate={() => onDeactivate(user)}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
