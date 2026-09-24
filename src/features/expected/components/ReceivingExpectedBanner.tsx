import { Link } from 'react-router-dom'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/Skeleton'
import { expectedCopy } from '@/features/expected/copy'
import type { ExpectedDelivery } from '@/features/expected/types'

export interface ReceivingExpectedBannerProps {
  /** Null until it loads, and for good when it cannot be loaded. */
  expected: ExpectedDelivery | null
  loading: boolean
  error: string | null
}

/**
 * What the delivery screen says about itself when it was opened from an expected delivery.
 *
 * It exists because of the quantities: a form that fills itself in with numbers nobody typed has
 * to say where they came from, or the storekeeper either trusts figures they have not checked or
 * clears the lot and types them again. One sentence naming the order, one saying the numbers are
 * what is still owed and can be changed.
 *
 * A failure is shown here rather than thrown, because the delivery underneath is still recordable
 * by hand and there is a lorry at the gate.
 */
export function ReceivingExpectedBanner({ expected, loading, error }: ReceivingExpectedBannerProps) {
  if (loading) {
    return (
      <div aria-busy="true" aria-label={expectedCopy.receive.loading}>
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }
  if (error) return <ErrorState variant="inline" message={error} />
  if (!expected) return null

  return (
    <div className="rounded-lg border border-primary-200 bg-primary-50 px-4 py-3">
      <p className="text-sm font-semibold text-primary-900">{expectedCopy.receive.heading(expected.title)}</p>
      <p className="mt-0.5 text-sm text-primary-800">{expectedCopy.receive.body}</p>
      {expected.reference != null && (
        <p className="mt-0.5 truncate text-xs text-primary-700">
          {expectedCopy.receive.reference(expected.reference)}
        </p>
      )}
      <Link
        to="/app/products/expected"
        className="mt-1.5 inline-block rounded-sm text-sm font-medium text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        {expectedCopy.receive.seeAll}
      </Link>
    </div>
  )
}
