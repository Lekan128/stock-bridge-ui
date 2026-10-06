import { useState } from 'react'
import { Share, X } from 'lucide-react'
import { isIos, isStandalone } from '@/pwa/serviceWorker'
import { installHintStorage } from '@/utils/storage'

/**
 * The iPhone / iPad nudge to add the app to the Home Screen.
 *
 * iOS has no install prompt to trigger, so this is the only way to tell an iPhone user the
 * option exists. And on iOS it matters more than anywhere else: Safari clears the storage of a
 * site that is not on the Home Screen after seven days without a visit, which would take the
 * offline catalog and any unsent stock entries with it once those live on the device.
 *
 * Shown inside the workspace only, never on the storefront, and dismissible for a month.
 */
export function IosInstallHint() {
  const [visible, setVisible] = useState(() => isIos() && !isStandalone() && !installHintStorage.isDismissed())

  if (!visible) return null

  function dismiss() {
    installHintStorage.dismiss()
    setVisible(false)
  }

  return (
    <div className="flex shrink-0 items-start gap-3 border-b border-primary-100 bg-primary-50 px-4 py-2.5 text-sm text-primary-900 sm:px-6">
      <Share className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
      <p className="flex-1">
        Add Procurepaddy to your Home Screen so it opens even without a connection. Tap{' '}
        <span className="font-medium">Share</span>, then <span className="font-medium">Add to Home Screen</span>.
      </p>
      <button
        type="button"
        onClick={dismiss}
        // Named for what it closes: the email-verification banner above it also has a close
        // button, and two buttons both announced as "Dismiss" are indistinguishable to a screen
        // reader.
        aria-label="Dismiss the Home Screen tip"
        className="rounded-md p-1 text-primary-700 hover:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
