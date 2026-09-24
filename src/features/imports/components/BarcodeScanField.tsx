import { useRef, useState } from 'react'
import { ScanLine } from 'lucide-react'
import { importsApi } from '@/features/imports/api/importsApi'
import { copy } from '@/features/imports/copy'
import type { DeliveryLine } from '@/features/imports/types'
import { isAppError } from '@/types/api'

export interface BarcodeScanFieldProps {
  /** Called with every line the scanned product is bought in — the picker's own rows. */
  onFound: (lines: DeliveryLine[]) => void
  disabled?: boolean
}

/**
 * Scan a box, and its row appears (BULK_IMPORT_CX_PLAN.md task 3.3).
 *
 * <h2>Why this is an input and not a camera</h2>
 * The scanner in a Nigerian warehouse is almost always a USB or Bluetooth laser gun, and to a
 * browser that is a keyboard: it types the digits and presses Enter. So a focused text field IS
 * the scanner integration, it needs no permissions, it works on the cheapest Android tablet, and
 * it doubles as the way to type a code off a box whose barcode is scuffed. A camera scanner is
 * worth adding on top of this later; it is not worth having instead of it.
 *
 * <p>The field keeps focus and clears itself after every scan, because a storekeeper scans a
 * whole pallet in a row and must never have to tap back into it between boxes.
 */
export function BarcodeScanField({ onFound, disabled }: BarcodeScanFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [code, setCode] = useState('')
  const [looking, setLooking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function lookUp() {
    const scanned = code.trim()
    if (scanned === '' || looking) return
    setLooking(true)
    setMessage(null)
    try {
      const lines = await importsApi.deliveryLinesByBarcode(scanned)
      onFound(lines)
      setCode('')
      setMessage(lines.length > 0 ? copy.delivery.scanAdded(lines[0].productName) : null)
    } catch (err: unknown) {
      // A 404 is the ordinary answer for a box we have never seen, not a failure.
      setMessage(isAppError(err) ? err.message : copy.delivery.scanFailed)
      setCode('')
    } finally {
      setLooking(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="delivery-scan" className="sr-only">
        {copy.delivery.scanLabel}
      </label>
      <div className="relative">
        <ScanLine
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          id="delivery-scan"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={code}
          disabled={disabled || looking}
          placeholder={copy.delivery.scanPlaceholder}
          onChange={(event) => setCode(event.target.value)}
          // A laser scanner ends its burst with Enter, so this is the whole integration.
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void lookUp()
            }
          }}
          className="w-full rounded-md border border-neutral-200 bg-white py-2 pr-3 pl-9 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none disabled:bg-neutral-50 sm:text-sm"
        />
      </div>
      {message != null && (
        <p className="text-xs text-neutral-600" aria-live="polite">
          {message}
        </p>
      )}
    </div>
  )
}
