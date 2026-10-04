import { CloudUpload } from 'lucide-react'

/**
 * The receipt for a stock write the server couldn't be reached for (A4): it is safe on this phone
 * and will be sent — and the stock figures will change — once there is a connection. Stated
 * plainly, so nobody records it a second time thinking the first didn't take.
 */
export function QueuedReceipt({ sentence }: { sentence: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-primary-100 bg-primary-50 p-4">
      <CloudUpload className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold text-primary-900">Saved on this phone</p>
        <p className="mt-1 text-sm text-primary-800">{sentence}</p>
        <p className="mt-1 text-sm text-primary-800">
          It will be sent as soon as the server can be reached; the stock figures change then. You don't need to
          record it again.
        </p>
      </div>
    </div>
  )
}
