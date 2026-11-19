import { useState } from 'react'
import { Button } from '@/components/Button'
import { useToast } from '@/components/useToast'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { hasAreas } from '@/features/branches/areas'
import { useOptionalWorkingBranch } from '@/features/branches/useWorkingBranch'
import { thisDevice, turnPushOff, turnPushOn, usePushState } from '@/features/push/pushDevice'
import { useApiQuery } from '@/data/useApiQuery'
import { pushApi, type PushPrefs } from '@/features/push/pushApi'

/**
 * "Notifications on this phone" (STOCK_AREAS_PART_5.md): for the people who move stock between areas - they're
 * the ones asked - and, where kitchen and bar tickets are on (V104), for new tickets and Ready, each person's own
 * choice. Per device, so it says which; when the device can't, it says why in plain words.
 */
export function NotificationsPanel() {
  const { user } = useAuth()
  const branch = useOptionalWorkingBranch()
  const state = usePushState()
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)
  const movesStock =
    user?.type === 'tenant' &&
    user.permissions.includes(PERMISSIONS.STOCK_OUT) &&
    (branch?.branches ?? []).some((candidate) => hasAreas(candidate))
  const ticketsHere = (branch?.branches ?? []).some((candidate) => candidate.ticketsOn)
  if ((!movesStock && !ticketsHere) || state === 'checking') return null
  const device = thisDevice()

  async function change(on: boolean) {
    setBusy(true)
    try {
      if (on) {
        const now = await turnPushOn()
        if (now === 'on') showToast('Notifications on', 'success')
      } else {
        await turnPushOff()
        showToast('Notifications off on this ' + device, 'success')
      }
    } catch {
      showToast('Something went wrong. Please try again.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const words: Record<Exclude<typeof state, 'checking'>, string> = {
    on: movesStock
      ? `On for this ${device}. You get one when someone asks you for stock, and it goes once it's moved.`
      : `On for this ${device}, even with the app closed.`,
    off: movesStock
      ? `Get a notification on this ${device} when someone asks you for stock, even with the app closed.`
      : `Get notifications on this ${device}, even with the app closed.`,
    blocked: `Notifications are blocked for this site in this browser. Allow them in the browser's site settings, then come back here.`,
    'home-screen': `On an iPhone or iPad, add Procurepaddy to your Home Screen first (Share, then Add to Home Screen), then turn this on from there.`,
    unsupported: `This browser can't show notifications. Chrome, Edge, Firefox and Safari can.`,
  }

  return (
    <section aria-labelledby="notifications-heading" className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-5" data-notifications-panel>
      <div>
        <h2 id="notifications-heading" className="text-base font-semibold text-neutral-900">
          Notifications on this {device}
        </h2>
        <p className="mt-0.5 text-sm text-neutral-500">{words[state]}</p>
      </div>
      {(state === 'on' || state === 'off') && (
        <div>
          <Button variant={state === 'on' ? 'secondary' : 'primary'} onClick={() => void change(state === 'off')} disabled={busy}>
            {state === 'on' ? 'Turn off' : 'Turn on'}
          </Button>
        </div>
      )}
      {ticketsHere && <TicketChoices />}
    </section>
  )
}

/** Your own choices (V104): new tickets for your areas, and Ready for the tables you sent to. Yours on every device. */
function TicketChoices() {
  const { showToast } = useToast()
  const prefs = useApiQuery<PushPrefs>({ queryKey: ['push-prefs'], queryFn: pushApi.prefs, fallbackError: "Couldn't load your notifications." })
  const [busy, setBusy] = useState<keyof PushPrefs | null>(null)
  if (!prefs.data) return null
  const rows: { kind: keyof PushPrefs; title: string; help: string }[] = [
    { kind: 'TICKETS_NEW', title: 'New tickets', help: 'For the Kitchen, Bar or other areas you work in.' },
    { kind: 'TICKETS_READY', title: 'Ready for my tables', help: 'When food or drinks you sent are ready.' },
  ]
  async function flip(kind: keyof PushPrefs) {
    setBusy(kind)
    try {
      prefs.setData(await pushApi.setPref(kind, !prefs.data![kind]))
    } catch {
      showToast("Couldn't change that. Try again.", 'error')
    } finally {
      setBusy(null)
    }
  }
  return (
    <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
      {rows.map((row) => (
        <li key={row.kind} className="flex items-center justify-between gap-3 px-3 py-2.5">
          <span className="min-w-0">
            <span id={`push-${row.kind}`} className="block text-sm font-semibold text-neutral-900">
              {row.title}
            </span>
            <span className="block text-sm text-neutral-500">{row.help}</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={prefs.data![row.kind]}
            aria-labelledby={`push-${row.kind}`}
            disabled={busy != null}
            onClick={() => void flip(row.kind)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${prefs.data![row.kind] ? 'bg-accent-600' : 'bg-neutral-300'}`}
          >
            <span
              aria-hidden="true"
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${prefs.data![row.kind] ? 'translate-x-6' : 'translate-x-1'}`}
            />
          </button>
        </li>
      ))}
    </ul>
  )
}
