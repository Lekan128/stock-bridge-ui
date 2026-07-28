import type { ReactNode } from 'react'
import type { SuperAdminUserSummary } from '@/features/admin/types'
import { AccountOwnerBadge } from '@/features/users/components/AccountOwnerBadge'
import { RoleBadge } from '@/features/users/components/RoleBadge'
import { UserStatusBadge } from '@/features/users/components/UserStatusBadge'
import { formatDate, formatFullName } from '@/features/users/formatters'

export interface AdminUserTableProps {
  users: SuperAdminUserSummary[]
  /**
   * Omitted for the cross-tenant view, which has no write API at all — there is nothing to
   * render there, not merely nothing we chose to render.
   */
  renderActions?: (user: SuperAdminUserSummary) => ReactNode
  onRowClick?: (user: SuperAdminUserSummary) => void
}

const columns = ['Name', 'Job title', 'Email', 'Phone', 'Role', 'Status', 'Created']

/**
 * One table for both super-admin user listings. Mirrors features/users' UserTable — same
 * columns, same badges, same formatters — so a super admin reads a tenant's users exactly the
 * way that tenant's own owner does. It reuses the badges rather than restyling them, which is
 * what keeps `root` reading as "account owner" in both places.
 *
 * Horizontal scroll is contained here (min-width + overflow-x-auto), matching ClientTable, so
 * the admin page body never scrolls sideways.
 */
export function AdminUserTable({ users, renderActions, onRowClick }: AdminUserTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[58rem] border-separate border-spacing-0 text-sm">
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
            {renderActions && <th scope="col" className="border-b border-neutral-200 bg-neutral-50 px-4 py-2.5" />}
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const fullName = formatFullName(user.firstName, user.lastName)
            return (
              <tr
                key={user.id}
                onClick={onRowClick ? () => onRowClick(user) : undefined}
                className={onRowClick ? 'cursor-pointer hover:bg-neutral-50' : undefined}
              >
                <td className="border-b border-neutral-100 px-4 py-2.5">
                  <span className="block font-medium text-neutral-900">{fullName ?? user.username}</span>
                  {fullName && <span className="block text-xs text-neutral-500">{user.username}</span>}
                </td>
                <td className="border-b border-neutral-100 px-4 py-2.5 text-neutral-600">{user.jobTitle || '—'}</td>
                <td className="border-b border-neutral-100 px-4 py-2.5 text-neutral-600">{user.email || '—'}</td>
                <td className="border-b border-neutral-100 px-4 py-2.5 text-neutral-600">{user.phone || '—'}</td>
                <td className="border-b border-neutral-100 px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <RoleBadge role={user.role} />
                    {user.root && <AccountOwnerBadge title="The first user created in this company — its account owner" />}
                  </div>
                </td>
                <td className="border-b border-neutral-100 px-4 py-2.5">
                  <UserStatusBadge active={user.active} />
                </td>
                <td className="border-b border-neutral-100 px-4 py-2.5 text-neutral-600">{formatDate(user.createdAt)}</td>
                {renderActions && (
                  <td
                    className="border-b border-neutral-100 px-4 py-2.5 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {renderActions(user)}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
