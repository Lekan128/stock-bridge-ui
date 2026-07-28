import { useCallback, useEffect, useRef, useState } from 'react'
import { checkoutApi } from '@/features/checkout/api/checkoutApi'
import type { PaymentVerification } from '@/features/checkout/types'
import { isAppError } from '@/types/api'

/**
 * How long to keep asking before giving the buyer a manual way out. Monnify's webhook and the
 * browser redirect race each other, so PENDING on the first read is normal — but an unbounded
 * spinner is not an answer, and after ~30 seconds the honest thing is to say "still confirming"
 * and offer the order page.
 */
const MAX_ATTEMPTS = 10
const POLL_INTERVAL_MS = 3000

function isFinalStatus(status: PaymentVerification['status']): boolean {
  return status !== 'PENDING'
}

export interface PaymentVerificationState {
  verification: PaymentVerification | null
  /** True while any attempt is in flight or another is scheduled. */
  verifying: boolean
  /** True once the attempt budget ran out with the payment still PENDING. */
  timedOut: boolean
  attempt: number
  error: string | null
  /** 404: no such payment, or it belongs to another company. Not retryable. */
  notFound: boolean
  retry: () => void
}

/**
 * Polls `GET /api/payments/{ref}/verify` until the server reaches a final answer.
 *
 * The browser is never trusted for the outcome (contract §9.3): whatever Monnify put in the query
 * string is ignored, and every rendered state on the return page comes from this call. Polling is
 * bounded — see MAX_ATTEMPTS — because "we are still checking" is a legitimate final state that
 * the buyer can act on, while an endless spinner is not.
 */
export function usePaymentVerification(paymentReference: string | null): PaymentVerificationState {
  const [verification, setVerification] = useState<PaymentVerification | null>(null)
  const [verifying, setVerifying] = useState(!!paymentReference)
  const [timedOut, setTimedOut] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [retryToken, setRetryToken] = useState(0)
  const cancelledRef = useRef(false)

  useEffect(() => {
    cancelledRef.current = false
    if (!paymentReference) {
      setVerifying(false)
      return
    }

    setVerifying(true)
    setTimedOut(false)
    setError(null)
    setNotFound(false)
    setAttempt(0)

    let timer: ReturnType<typeof setTimeout> | undefined

    async function poll(attemptNumber: number) {
      if (cancelledRef.current || !paymentReference) return
      setAttempt(attemptNumber)

      try {
        const result = await checkoutApi.verifyPayment(paymentReference)
        if (cancelledRef.current) return
        setVerification(result)
        setError(null)

        if (isFinalStatus(result.status)) {
          setVerifying(false)
          return
        }
      } catch (err) {
        if (cancelledRef.current) return
        if (isAppError(err) && err.status === 404) {
          setNotFound(true)
          setVerifying(false)
          return
        }
        // A transient failure is not a verdict — keep the previous reading and try again. Only
        // the last attempt's message is surfaced, so a blip mid-poll never flashes an error.
        setError(isAppError(err) ? err.message : 'We could not reach the payment service.')
      }

      if (attemptNumber >= MAX_ATTEMPTS) {
        setVerifying(false)
        setTimedOut(true)
        return
      }
      timer = setTimeout(() => void poll(attemptNumber + 1), POLL_INTERVAL_MS)
    }

    void poll(1)

    return () => {
      cancelledRef.current = true
      if (timer) clearTimeout(timer)
    }
  }, [paymentReference, retryToken])

  const retry = useCallback(() => setRetryToken((token) => token + 1), [])

  return { verification, verifying, timedOut, attempt, error, notFound, retry }
}
