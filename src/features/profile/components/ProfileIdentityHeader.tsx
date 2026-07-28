import { AccountOwnerBadge } from '@/features/users/components/AccountOwnerBadge'
import { RoleBadge } from '@/features/users/components/RoleBadge'
import { UserStatusBadge } from '@/features/users/components/UserStatusBadge'
import { formatFullName } from '@/features/users/formatters'
import type { Profile } from '@/features/profile/types'

/** Same two-character idiom as the topbar avatar, but prefers real name initials when we have them. */
function getInitials(profile: Profile): string {
  const first = profile.firstName?.trim() ?? ''
  const last = profile.lastName?.trim() ?? ''
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase()
  const single = first || last
  if (single) return single.slice(0, 2).toUpperCase()
  return profile.username.slice(0, 2).toUpperCase()
}

export function ProfileIdentityHeader({ profile }: { profile: Profile }) {
  const displayName = formatFullName(profile.firstName, profile.lastName) ?? profile.username

  return (
    <div className="flex items-start gap-4 rounded-lg border border-neutral-200 bg-white p-5">
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-600 text-base font-semibold text-white">
        {getInitials(profile)}
      </span>
      <div className="min-w-0">
        <h2 className="truncate text-lg font-semibold text-neutral-900">{displayName}</h2>
        {profile.jobTitle && <p className="mt-0.5 text-sm text-neutral-500">{profile.jobTitle}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <RoleBadge role={profile.role} />
          {profile.root && <AccountOwnerBadge />}
          <UserStatusBadge active={profile.active} />
        </div>
      </div>
    </div>
  )
}
