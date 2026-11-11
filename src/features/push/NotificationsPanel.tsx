import { useState } from 'react'
import { Button } from '@/components/Button'
import { useToast } from '@/components/useToast'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { hasAreas } from '@/features/branches/areas'
import { useOptionalWorkingBranch } from '@/features/branches/useWorkingBranch'
import { thisDevice, turnPushOff, turnPushOn, usePushState } from '@/features/push/pushDevice'

/**
 * "Notifications on this phone" (STOCK_AREAS_PART_5.md): for the people who move stock between areas - they're
 * the ones asked. Per device, so it says which; when the device can't, it says why in plain words.
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
  if (!movesStock || state === 'checking') return null
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
    on: `On for this ${device}. You get one when someone asks you for stock, and it goes once it's moved.`,
    off: `Get a notification on this ${device} when someone asks you for stock, even with the app closed.`,
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
    </section>
  )
}
