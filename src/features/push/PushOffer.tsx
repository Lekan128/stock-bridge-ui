import { useState } from 'react'
import { Bell, X } from 'lucide-react'
import { useToast } from '@/components/useToast'
import { thisDevice, turnPushOn, usePushState } from '@/features/push/pushDevice'
import { pushOfferStorage } from '@/utils/storage'

/**
 * Under "The Kitchen asked for 2 items · Move them", while notifications are off on this device: the moment they
 * make sense, said once. "Turn on" asks the browser; ✕ hides it here for good (Profile keeps the switch).
 *
 * @param bar quick mode's full-width bar; otherwise a box like the line above it.
 */
export function PushOffer({ bar = false }: { bar?: boolean }) {
  const state = usePushState()
  const { showToast } = useToast()
  const [dismissed, setDismissed] = useState(() => pushOfferStorage.isDismissed())
  const [busy, setBusy] = useState(false)
  if (state !== 'off' || dismissed) return null

  async function turnOn() {
    setBusy(true)
    try {
      const now = await turnPushOn()
      if (now === 'on') showToast(`Notifications on. This ${thisDevice()} will tell you when someone asks.`, 'success')
      else if (now === 'blocked') showToast('Notifications are blocked for this site. Allow them in the browser’s site settings.', 'info')
    } catch {
      showToast('Couldn’t turn notifications on. Please try again.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      data-push-offer
      className={`flex min-h-11 w-full items-center gap-2 text-sm text-neutral-700 ${
        bar ? 'border-b border-neutral-200 bg-white pl-4 pr-1' : 'rounded-lg border border-neutral-200 bg-white pl-4 pr-1'
      }`}
    >
      <Bell className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden="true" />
      <span className="min-w-0 flex-1">Get a notification on this {thisDevice()} when someone asks</span>
      <button
        type="button"
        onClick={() => void turnOn()}
        disabled={busy}
        className="min-h-11 shrink-0 px-2 font-semibold text-primary-700 hover:underline disabled:opacity-60"
      >
        Turn on
      </button>
      <button
        type="button"
        onClick={() => {
          pushOfferStorage.dismiss()
          setDismissed(true)
        }}
        aria-label="Not now"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}
