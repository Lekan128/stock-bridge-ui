import { useEffect, useRef, useState } from 'react'
import { CircleCheck, Link2Off, MailWarning } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { Button, buttonClassName } from '@/components/Button'
import { Spinner } from '@/components/Spinner'
import { emailApi } from '@/features/profile/api/emailApi'
import { useEmailVerification } from '@/features/profile/hooks/useEmailVerification'
import { isAppError } from '@/types/api'

type Phase = 'missing-token' | 'verifying' | 'verified' | 'rejected' | 'unreachable'

/** The server's own copy is always preferred; these only cover the cases it never answers. */
const NO_TOKEN_MESSAGE =
  'This confirmation link is incomplete — it has no token in it, which usually means an email client cut the address short. Open the link from your email again, or sign in and ask for a new one.'
const UNREACHABLE_MESSAGE =
  'We could not reach ProcurePal to confirm your address. Your link has not been used up — check your connection and try again.'

/**
 * The landing page for the link in a confirmation email — `/verify-email?token=…`.
 *
 * Public by design. The person clicking is coming from an inbox, may have no session at all, and
 * is quite likely on a different device from the one they signed up on; requiring a login here
 * would mean the address can only be confirmed by someone who is already inside the product.
 *
 * The token is redeemed by POSTing it, never by the mere act of loading this page — link scanners
 * and mail-security products follow GETs, and a GET that consumed the token would burn it before
 * the human ever saw the email. That is also why the server answers a GET on its unsubscribe
 * sibling with a 405.
 */
export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const { isAuthenticated } = useAuth()
  const { refresh } = useEmailVerification()
  const token = searchParams.get('token')

  const [phase, setPhase] = useState<Phase>(token ? 'verifying' : 'missing-token')
  const [message, setMessage] = useState<string>(token ? '' : NO_TOKEN_MESSAGE)
  const [attempt, setAttempt] = useState(0)

  /**
   * Which token this component has already spent.
   *
   * Load-bearing, not defensive tidying. React 18's StrictMode deliberately mounts, tears down
   * and re-mounts every component in development, so a plain effect fires twice: the first call
   * consumes the token, the second gets the "not valid — it may have expired or already been
   * used" refusal, and the last render wins. The feature then looks broken in dev and works in
   * production, which is the worst possible way to find out. A ref set *synchronously before*
   * the request survives the remount (same instance) and is not reset by cleanup, so the second
   * effect returns immediately.
   */
  const spentTokenRef = useRef<string | null>(null)

  useEffect(() => {
    if (!token) return
    if (spentTokenRef.current === token) return
    spentTokenRef.current = token

    let cancelled = false
    setPhase('verifying')

    emailApi
      .verify(token)
      .then((response) => {
        if (cancelled) return
        setPhase(response.verified ? 'verified' : 'rejected')
        setMessage(response.message)
        // A signed-in user who verified on this same device would otherwise keep seeing the
        // shell banner until a manual reload. Re-reading /api/me clears it in place.
        if (response.verified && isAuthenticated) refresh()
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (isAppError(err) && err.status === 400) {
          // One message for unknown, expired, already-used, superseded and address-changed
          // tokens — byte-identical on purpose, so there is deliberately nothing to branch on.
          // Inventing more specific copy here would be guessing at the user.
          setPhase('rejected')
          setMessage(err.message)
          return
        }
        // Network or server trouble. The token was very likely NOT consumed, so this one is
        // worth retrying — unlike a 400.
        setPhase('unreachable')
        setMessage(isAppError(err) && err.status !== 0 ? err.message : UNREACHABLE_MESSAGE)
      })

    return () => {
      cancelled = true
    }
    // `attempt` re-runs this for the manual retry below; the ref is cleared there first.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, attempt])

  function retry() {
    spentTokenRef.current = null
    setAttempt((n) => n + 1)
  }

  const presentation = {
    'missing-token': { icon: Link2Off, title: 'This link is incomplete', wrap: 'border-neutral-200 bg-white', badge: 'bg-neutral-100 text-neutral-500' },
    verifying: { icon: CircleCheck, title: 'Confirming your email address…', wrap: 'border-primary-100 bg-primary-50', badge: 'bg-primary-100 text-primary-700' },
    verified: { icon: CircleCheck, title: 'Your email address is confirmed', wrap: 'border-accent-200 bg-accent-50', badge: 'bg-accent-100 text-accent-700' },
    rejected: { icon: Link2Off, title: 'This confirmation link did not work', wrap: 'border-warning-200 bg-warning-50', badge: 'bg-warning-100 text-warning-700' },
    unreachable: { icon: MailWarning, title: 'We could not confirm it just now', wrap: 'border-danger-200 bg-white', badge: 'bg-danger-100 text-danger-700' },
  }[phase]

  const Icon = presentation.icon

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <div className={`rounded-lg border p-6 text-center ${presentation.wrap}`}>
        <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${presentation.badge}`}>
          {phase === 'verifying' ? <Spinner size={22} /> : <Icon className="h-6 w-6" aria-hidden="true" />}
        </div>

        {/* The outcome replaces the in-flight state with no navigation, so it has to be
            announced. `polite` rather than `assertive`: the user is waiting for exactly this. */}
        <div aria-live="polite" aria-busy={phase === 'verifying'}>
          <h1 className="mt-4 text-lg font-semibold text-neutral-900">{presentation.title}</h1>
          <p className="mx-auto mt-1 max-w-md text-sm text-neutral-600">
            {phase === 'verifying'
              ? 'This only takes a second.'
              : message}
          </p>
        </div>

        {phase === 'rejected' && (
          <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">
            Confirmation links are single-use and expire. Signing in and asking for a fresh one always works — and
            if you already confirmed this address, you are done and nothing is wrong.
          </p>
        )}

        {phase !== 'verifying' && (
          /* Where to go next depends on whether this device has a session. Somebody who opened
             the link on their phone has none, and the only useful next step is signing in;
             somebody already inside the app should land back where they were. */
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {phase === 'unreachable' && <Button onClick={retry}>Try again</Button>}

            {isAuthenticated ? (
              <>
                <Link to="/app" className={buttonClassName('primary')}>
                  Go to your workspace
                </Link>
                {phase !== 'verified' && (
                  <Link to="/app/profile" className={buttonClassName('secondary')}>
                    Ask for a new link
                  </Link>
                )}
              </>
            ) : (
              <Link to="/login" className={buttonClassName('primary')}>
                Sign in
              </Link>
            )}

            <Link to="/" className={buttonClassName('secondary')}>
              Back to the marketplace
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
