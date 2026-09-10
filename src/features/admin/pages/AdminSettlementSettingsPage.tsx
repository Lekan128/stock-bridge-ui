import { useEffect, useState } from 'react'
import { History, Hourglass, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/Skeleton'
import { TextField } from '@/components/TextField'
import { useToast } from '@/components/useToast'
import { superAdminApiClient } from '@/features/admin/api/superAdminApi'
import { ChangeEscrowHoldDialog } from '@/features/admin/components/ChangeEscrowHoldDialog'
import { describeHold } from '@/features/admin/formatters'
import { useEscrowHoldSettings } from '@/features/admin/hooks/useEscrowHoldSettings'
import { formatDateTime } from '@/features/marketplace/formatters'
import { isAppError } from '@/types/api'

/**
 * Settlement settings — route `/admin/settlement-settings`.
 *
 * <h2>What this screen changes</h2>
 * Exactly one number: how many days after a buyer confirms receipt a vendor's money becomes
 * payout-eligible. It is the most consequential setting in the product — it decides when real
 * money leaves the business — and it is the only one anywhere that demands a password to change.
 *
 * <h2>The consequence is legible before submission, not after</h2>
 * The page states the rule and the dialog states it again with the actual numbers filled in,
 * because the two facts an operator most often gets wrong are both invisible in the input box:
 * that the change is <em>not</em> retroactive, and that a hold longer than the payout cycle
 * pushes every vendor a whole cycle later. Neither is discoverable from typing a number, so
 * neither is left to be discovered.
 *
 * <h2>Not retroactive, and this screen says so twice</h2>
 * Each sale is stamped with the hold in force when its buyer confirmed it, on a ledger row that
 * cannot be rewritten. So changing this moves nothing that has already accrued, and no payment
 * date a vendor has already been shown will move. That is the first question anyone asks, and it
 * is answered above the button rather than in a help article.
 *
 * <h2>Why the history is on the same screen</h2>
 * Because the audit trail's whole value is being read at the moment somebody is about to add to
 * it. An operator who can see that the hold was already changed twice this month is an operator
 * who asks a colleague before changing it a third time.
 *
 * <h2>Who sees it</h2>
 * Super admins only, behind `RequireSuperAdmin` like every `/admin` route. There is deliberately
 * no tenant-facing view of this setting: a vendor learns the hold on THEIR money from their own
 * statement, which shows the real maturity dates rather than the policy.
 */
export function AdminSettlementSettingsPage() {
  const { showToast } = useToast()
  const { data, loading, error, refetch, setData } = useEscrowHoldSettings()

  const [draft, setDraft] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // The input mirrors the server's value until an operator edits it. Keyed on the VALUE rather
  // than on the response object, so a successful change leaves the box showing what is now in
  // force instead of the number the operator typed a moment ago — which look identical right up
  // until a request fails, at which point the difference is the whole story.
  const serverHoldDays = data?.escrowHoldDays
  useEffect(() => {
    if (serverHoldDays !== undefined) setDraft(String(serverHoldDays))
  }, [serverHoldDays])

  if (loading && !data) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-56 rounded-lg" />
      </div>
    )
  }

  if (error && !data) {
    return <ErrorState message={error} onRetry={refetch} />
  }

  if (!data) return null

  const parsed = Number(draft)
  const isNumber = draft.trim() !== '' && Number.isInteger(parsed)
  const inRange = isNumber && parsed >= data.minHoldDays && parsed <= data.maxHoldDays
  const changed = inRange && parsed !== data.escrowHoldDays

  const validationMessage = !isNumber
    ? 'Enter a whole number of days.'
    : !inRange
      ? `The hold must be between ${data.minHoldDays} and ${data.maxHoldDays} days.`
      : undefined

  async function handleConfirm(password: string, reason: string) {
    if (!data) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const updated = await superAdminApiClient.updateEscrowHold({
        holdDays: parsed,
        password,
        acknowledged: true,
        reason: reason === '' ? undefined : reason,
      })
      // The response IS the new state, audit row included, so there is nothing to refetch.
      setData(updated)
      setConfirming(false)
      showToast(`Escrow hold is now ${describeHold(updated.escrowHoldDays)}.`, 'success')
    } catch (err: unknown) {
      // Shown inside the dialog rather than as a toast, and the dialog stays open. A 403 here
      // means the password did not match, and the one thing an operator wants next is the field
      // they got wrong — not a banner behind a modal they have to dismiss to reach it.
      setSubmitError(
        isAppError(err) ? err.message : 'The hold could not be changed. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Settlement settings</h1>
        <p className="text-sm text-neutral-500">
          How long a vendor&rsquo;s money is held after a buyer confirms receipt, before it can be
          paid out.
        </p>
      </div>

      {/* ------------------------------------------------------------------
          The setting itself, with the consequence stated beside it.
         ------------------------------------------------------------------ */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <div className="flex items-start gap-3">
          <Hourglass size={18} className="mt-0.5 shrink-0 text-neutral-400" aria-hidden />
          <div className="flex-1">
            <h2 className="text-base font-semibold text-neutral-900">Escrow hold</h2>
            <p className="mt-1 text-sm text-neutral-600">
              A vendor&rsquo;s money is credited when the buyer confirms they received the goods,
              and becomes payable{' '}
              <span className="font-medium text-neutral-900">
                {describeHold(data.escrowHoldDays)}
              </span>{' '}
              later. The hold is what gives us — and the buyer — a window to catch a refund or a
              fraudulent order before the money is gone.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-start gap-3">
          <div className="w-40">
            <TextField
              label="Hold (days)"
              name="escrow-hold-days"
              type="number"
              inputMode="numeric"
              min={data.minHoldDays}
              max={data.maxHoldDays}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              error={draft !== '' ? validationMessage : undefined}
            />
          </div>
          <div className="pt-7">
            <Button onClick={() => setConfirming(true)} disabled={!changed}>
              Change the hold
            </Button>
          </div>
        </div>

        <dl className="mt-5 divide-y divide-neutral-100 border-t border-neutral-100 pt-1 text-sm">
          <Note
            term="Changing this is not retroactive"
            detail="Each sale is stamped with the hold in force when its buyer confirmed it, on a ledger row that cannot be rewritten. Money already confirmed keeps its own date — no payment a vendor has already been shown will move."
          />
          <Note
            term="Payout days do not move"
            detail={`Payouts run every ${data.payoutPeriodDays} days on a fixed cycle, and nothing on this screen changes that. The hold decides whether money is eligible; the cycle decides when the run happens. Money that matures on day 8 of a cycle still waits for that cycle's run.`}
          />
          <Note
            term={`Allowed range: ${data.minHoldDays} to ${data.maxHoldDays} days`}
            detail={`${data.minHoldDays} means a vendor's money is payable the moment the buyer confirms, with no window to catch anything — that is how the platform worked before the hold existed. Above ${data.payoutPeriodDays} days, money confirmed in one payout cycle can no longer be paid by the run that closes it.`}
          />
          <Note
            term="Changing it requires your password"
            detail="Every change is written to an audit log that cannot be edited or deleted, and emailed to every super admin with the old value, the new value, who made it and when."
          />
        </dl>
      </section>

      {/* ------------------------------------------------------------------
          The audit trail, on the same screen as the thing that adds to it.
         ------------------------------------------------------------------ */}
      <section className="rounded-lg border border-neutral-200 bg-white">
        <div className="flex items-center gap-2 border-b border-neutral-100 px-5 py-4">
          <History size={16} className="text-neutral-400" aria-hidden />
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Change history</h2>
            <p className="text-sm text-neutral-500">
              Every change to the hold, newest first. This record cannot be edited or deleted.
            </p>
          </div>
        </div>

        {data.recentChanges.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="Never changed"
            description={`The hold has been ${describeHold(data.escrowHoldDays)} since the platform was set up. Anything that changes it will appear here.`}
            className="border-0"
          />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {data.recentChanges.map((change) => (
              <li key={change.id} className="px-5 py-4">
                <p className="text-sm font-medium text-neutral-900">
                  {describeHold(change.previousHoldDays)} &rarr;{' '}
                  {describeHold(change.newHoldDays)}
                </p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {change.changedByUsername} &middot; {formatDateTime(change.changedAt)}
                </p>
                {change.reason && (
                  <p className="mt-1.5 text-sm text-neutral-600">&ldquo;{change.reason}&rdquo;</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {inRange && (
        <ChangeEscrowHoldDialog
          open={confirming}
          settings={data}
          nextHoldDays={parsed}
          submitting={submitting}
          error={submitError}
          onCancel={() => {
            setConfirming(false)
            setSubmitError(null)
          }}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  )
}

function Note({ term, detail }: { term: string; detail: string }) {
  return (
    <div className="py-2.5">
      <dt className="font-medium text-neutral-900">{term}</dt>
      <dd className="mt-0.5 leading-relaxed text-neutral-600">{detail}</dd>
    </div>
  )
}
