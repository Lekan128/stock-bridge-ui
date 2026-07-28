import { ServerCog } from 'lucide-react'
import { Button } from '@/components/Button'

export interface PlatformOwnerNotBootstrappedStateProps {
  /** The backend's own sentence — it names the configuration to set, so it is shown verbatim. */
  message: string | null
  onRetry: () => void
}

/**
 * What this screen shows when no client has `is_platform_owner = TRUE`.
 *
 * This is a configuration step nobody has taken yet, not a failure: the ProcurePal tenant is
 * created from `app.platform-owner.*` at startup, so a production database that has never had
 * those variables set genuinely has no platform owner, and a super admin's first visit to this
 * page on a fresh deployment lands here. Rendering it as an error — a red banner, a stack trace,
 * a "something went wrong" — would send somebody looking for a bug in a system behaving exactly
 * as designed, so it is an empty/setup state with the remedy in it instead.
 *
 * Shaped like the shared EmptyState (dashed border, tinted icon, centred) rather than built from
 * it, because it has three paragraphs of explanation to carry and EmptyState caps its description
 * at `max-w-sm` — right for "no results", too narrow for a runbook.
 *
 * There is deliberately no "provision it now" button: the tenant is bootstrapped from environment
 * variables at deploy time and cannot be created over the API from here.
 */
export function PlatformOwnerNotBootstrappedState({ message, onRetry }: PlatformOwnerNotBootstrappedStateProps) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-14 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
        <ServerCog className="h-6 w-6" aria-hidden="true" />
      </div>

      <h2 className="mt-4 text-base font-semibold text-neutral-900">ProcurePal has not been set up yet</h2>

      <div className="mt-2 flex max-w-xl flex-col gap-3 text-left text-sm text-neutral-500">
        <p>
          No company on this deployment is marked as the platform owner, so there is no ProcurePal
          tenant to manage users for. Nothing is broken — the rest of the super admin panel works
          normally, and every tenant that does exist is still listed under Tenants.
        </p>
        {message && (
          <p className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
            {message}
          </p>
        )}
        <p>
          ProcurePal is bootstrapped at deploy time from the{' '}
          <span className="font-mono text-neutral-700">app.platform-owner.*</span> environment
          variables, not from this screen. Once the service has been restarted with them, its first
          user can be created here — and that first account becomes ProcurePal&apos;s account owner.
        </p>
      </div>

      <div className="mt-5">
        <Button variant="secondary" onClick={onRetry}>
          Check again
        </Button>
      </div>
    </div>
  )
}
