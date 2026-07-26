import { formatDate, formatPermissionName } from '@/features/users/formatters'
import type { Profile } from '@/features/profile/types'

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium break-words text-neutral-900">{value}</dd>
    </div>
  )
}

/** Read-only account facts — none of this is editable from the profile page. */
export function ProfileAccountFacts({ profile }: { profile: Profile }) {
  return (
    <div className="flex flex-col gap-5 rounded-lg border border-neutral-200 bg-white p-5">
      <div>
        <h2 className="text-base font-semibold text-neutral-900">Account</h2>
        <p className="mt-0.5 text-sm text-neutral-500">
          Managed by your organisation — ask an account owner to change any of this.
        </p>
      </div>

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Fact label="Username" value={profile.username} />
        <Fact label="Company" value={profile.clientName || '—'} />
        <Fact label="Company ID" value={profile.clientIdentifier || '—'} />
        <Fact label="Member since" value={formatDate(profile.createdAt)} />
      </dl>

      <div>
        <p className="text-xs text-neutral-500">What you can do</p>
        {profile.permissions.length === 0 ? (
          <p className="mt-1.5 text-sm text-neutral-600">No permissions have been granted to your role.</p>
        ) : (
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {profile.permissions.map((permission) => (
              <li
                key={permission}
                className="inline-flex items-center rounded-sm border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-700"
              >
                {formatPermissionName(permission)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
