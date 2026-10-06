import { useState } from 'react'
import type { ProductDataIssue } from '@/features/products/quality/api'
import { useProductDataIssues } from '@/features/products/quality/useProductDataIssues'

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

export interface DataIssuesNotice {
  /** Products with something to fix — empty while loading, after an error, or once dismissed. */
  issues: ProductDataIssue[]
  /** "Not now": hidden for the rest of this session. */
  dismiss: () => void
}

/** The data-issues notice's facts, fetched once for both the "need a look" line and the banner. */
export function useDataIssuesNotice(): DataIssuesNotice {
  const { issues, loading, error } = useProductDataIssues()
  const [dismissed, setDismissed] = useState(readDismissed)
  return {
    issues: loading || error || dismissed ? [] : issues,
    dismiss: () => {
      writeDismissed()
      setDismissed(true)
    },
  }
}
