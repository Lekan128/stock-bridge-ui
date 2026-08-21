import { ChangePasswordForm } from '@/features/profile/components/ChangePasswordForm'
import { EmailSettingsPanel } from '@/features/profile/components/EmailSettingsPanel'
import { ProfileAccountFacts } from '@/features/profile/components/ProfileAccountFacts'
import { ProfileIdentityHeader } from '@/features/profile/components/ProfileIdentityHeader'
import { ProfileSkeleton } from '@/features/profile/components/ProfileSkeleton'
import { ProfileDetailsForm } from '@/features/profile/components/ProfileDetailsForm'
import { useProfile } from '@/features/profile/hooks/useProfile'

/** Open to every authenticated tenant user — root and sub-users alike. */
export function ProfilePage() {
  const { profile, setProfile, loading, error } = useProfile()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Your profile</h1>
        <p className="text-sm text-neutral-500">Your details, your access, and your password.</p>
      </div>

      {loading && <ProfileSkeleton />}

      {!loading && error && (
        <div className="rounded-md border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
      )}

      {!loading && !error && profile && (
        <>
          <ProfileIdentityHeader profile={profile} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="flex flex-col gap-6 lg:col-span-2">
              <ProfileDetailsForm profile={profile} onUpdated={setProfile} />
              {/*
                Directly beneath the details form, because the two are causally linked: editing
                the address in the form above un-confirms it, and this panel is where that
                becomes visible and fixable. Shares setProfile with the form so a resend or a
                preference change updates the same profile object the form is rendering.
              */}
              <EmailSettingsPanel profile={profile} onUpdated={setProfile} />
              <ChangePasswordForm />
            </div>
            <ProfileAccountFacts profile={profile} />
          </div>
        </>
      )}
    </div>
  )
}
