import { useState } from 'react'
import { Wrench } from 'lucide-react'
import { Link } from 'react-router-dom'
import { buttonClassName } from '@/components/Button'
import type { ProductDataIssueCode } from '@/features/products/quality/api'
import { useProductDataIssues } from '@/features/products/quality/useProductDataIssues'

/** `sessionStorage`: "Not now" should hold for this visit, and ask again next time. */
const DISMISSED_KEY = 'productDataIssues.dismissed'

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

function writeDismissed() {
  try {
    sessionStorage.setItem(DISMISSED_KEY, '1')
  } catch {
    // Storage blocked — the banner still hides until the page is reloaded.
  }
}

const PHRASES: Record<ProductDataIssueCode, string> = {
  DAMAGED_CODE: 'codes that were damaged',
  NO_STOCK_UNIT: 'no unit set',
  UNIT_LOOKS_WRONG: 'a unit that looks wrong',
  PACK_LOOKS_TOO_SMALL: 'a pack size that looks too small',
}

/** `["a", "b", "c"]` → `"a, b, or c"`. */
function joinWithOr(parts: string[]): string {
  if (parts.length <= 2) return parts.join(' or ')
  return `${parts.slice(0, -1).join(', ')}, or ${parts[parts.length - 1]}`
}

/**
 * The product list's pointer to the fix screen. Silent while loading, on failure (the list
 * itself matters more than this nudge) and when nothing needs fixing. Remounts — and so
 * refetches — each time the owner comes back to the list.
 */
export function DataIssuesBanner() {
  const { issues, loading, error } = useProductDataIssues()
  const [dismissed, setDismissed] = useState(readDismissed)

  if (loading || error || dismissed || issues.length === 0) return null

  // In a fixed order, so the sentence reads the same however the products happen to be sorted.
  const present = new Set(issues.flatMap((product) => product.issues.map((issue) => issue.code)))
  const kinds = (Object.keys(PHRASES) as ProductDataIssueCode[]).filter((code) => present.has(code))
  const count = issues.length

  function handleDismiss() {
    writeDismissed()
    setDismissed(true)
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-warning-200 bg-warning-50 p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Wrench className="mt-0.5 h-4.5 w-4.5 shrink-0 text-warning-700" aria-hidden="true" />
        <p className="text-sm text-warning-900">
          <strong className="font-semibold">
            {count} {count === 1 ? 'product needs' : 'products need'} a quick fix
          </strong>
          {kinds.length > 0 && ` — ${joinWithOr(kinds.map((code) => PHRASES[code]))}.`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link to="/app/products/fix" className={buttonClassName('primary', 'py-2')}>
          Fix them
        </Link>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-md px-3 py-2 text-sm font-medium text-warning-900 hover:bg-warning-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning-500"
        >
          Not now
        </button>
      </div>
    </div>
  )
}
