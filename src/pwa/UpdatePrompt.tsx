import { useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/Button'
import { useToast } from '@/components/useToast'
import {
  acknowledgeOfflineReady,
  applyUpdate,
  dismissUpdate,
  useServiceWorkerState,
} from '@/pwa/serviceWorker'

/**
 * "A new version is ready" — and the one-time "this now works offline" note.
 *
 * Bottom-left and quiet, not a modal: a new version is never urgent enough to interrupt a stock
 * entry, and the user chooses the moment by tapping Reload. "Later" hides it until the next load;
 * the new version keeps waiting and is offered again.
 *
 * Rendered from both layouts, so someone who signed in once and now only browses the storefront
 * is still offered the update rather than running an old version indefinitely.
 */
export function UpdatePrompt() {
  const { updateReady, offlineReady } = useServiceWorkerState()
  const { showToast } = useToast()

  useEffect(() => {
    if (!offlineReady) return
    showToast('Procurepaddy will now open on this device, even without a connection.', 'success')
    acknowledgeOfflineReady()
  }, [offlineReady, showToast])

  if (!updateReady) return null

  return (
    <div
      role="status"
      className="animate-fade-slide-up fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 flex flex-col gap-3 rounded-md border border-neutral-200 bg-white p-4 shadow-lg sm:right-auto sm:left-4 sm:w-full sm:max-w-sm"
    >
      <div className="flex items-start gap-3">
        <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-neutral-900">A new version of Procurepaddy is ready</p>
          <p className="mt-0.5 text-sm text-neutral-500">Reload when you've finished what you're doing.</p>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={dismissUpdate}>
          Later
        </Button>
        <Button onClick={applyUpdate}>Reload</Button>
      </div>
    </div>
  )
}
