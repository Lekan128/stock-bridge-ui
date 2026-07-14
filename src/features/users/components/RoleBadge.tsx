import type { UserRole } from '@/features/users/types'

const roleStyles: Record<UserRole, string> = {
  ADMIN: 'bg-primary-100 text-primary-700 border-primary-200',
  MANAGER: 'bg-neutral-200 text-neutral-700 border-neutral-300',
  STAFF: 'bg-neutral-100 text-neutral-500 border-neutral-200',
}

const roleLabels: Record<UserRole, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  STAFF: 'Staff',
}

export function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-xs font-medium ${roleStyles[role]}`}
    >
      {roleLabels[role]}
    </span>
  )
}
