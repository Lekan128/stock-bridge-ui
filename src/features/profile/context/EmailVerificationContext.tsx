import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '@/auth/useAuth'
import { profileApi } from '@/features/profile/api/profileApi'
import { verifiableEmailAddress } from '@/features/profile/types'
import { emailVerificationStorage } from '@/utils/storage'

export interface EmailVerificationContextValue {
  /** The address a confirmation link would go to, or null when this account has none. */
  address: string | null
  emailVerified: boolean
  /** False until the first GET /api/me answers — nothing about verification is rendered before. */
  hasLoaded: boolean
  /** The single question the banner asks: should it be on screen right now? */
  showPrompt: boolean
  /** Hide the banner for a day (see emailVerificationStorage for why a day). */
  dismiss: () => void
  /** Re-read GET /api/me — called after a successful verify so the banner clears itself. */
  refresh: () => void
}

export const EmailVerificationContext = createContext<EmailVerificationContextValue | null>(null)

/**
 * Shell-level "is this user's email confirmed?", so the banner can live in the layout rather than
 * on one page.
 *
 * It is a provider rather than a hook called inside AppLayout for one reason: `/verify-email` is
 * a public route *outside* the workspace shell, and after it succeeds the banner must disappear
 * without a manual reload. A provider mounted above the router gives that page a `refresh()` to
 * call; a hook inside the layout would leave the layout's copy stale.
 *
 * One extra GET /api/me per session. It is not shared with `useProfile()` on the profile page on
 * purpose — that hook owns an editable draft of the whole profile, and coupling the shell's
 * read-only status flag to it would make every profile edit a shell concern.
 */
export function EmailVerificationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [address, setAddress] = useState<string | null>(null)
  const [emailVerified, setEmailVerified] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!isAuthenticated) {
      // Default to "verified" while signed out so a logout can never flash the banner at an
      // anonymous visitor on the storefront.
      setEmailVerified(true)
      setAddress(null)
      setUserId(null)
      setHasLoaded(false)
      return
    }

    let cancelled = false

    profileApi
      .get()
      .then((profile) => {
        if (cancelled) return
        setAddress(verifiableEmailAddress(profile))
        setEmailVerified(profile.emailVerified)
        setUserId(profile.id)
        setDismissed(emailVerificationStorage.isBannerDismissed(profile.id))
      })
      .catch(() => {
        // Silent. This is an advisory banner; failing to load it must never put an error in
        // front of someone who came here to do something else. The next mount tries again.
      })
      .finally(() => {
        if (!cancelled) setHasLoaded(true)
      })

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, reloadToken])

  const dismiss = useCallback(() => {
    setDismissed(true)
    if (userId) emailVerificationStorage.dismissBanner(userId)
  }, [userId])

  const refresh = useCallback(() => setReloadToken((token) => token + 1), [])

  const value: EmailVerificationContextValue = {
    address,
    emailVerified,
    hasLoaded,
    // An account with nothing verifiable — a sub-user with no address — is not nagged: there is
    // no action they could take from the banner, and the profile page says it better.
    showPrompt: isAuthenticated && hasLoaded && !emailVerified && !dismissed && address !== null,
    dismiss,
    refresh,
  }

  return <EmailVerificationContext.Provider value={value}>{children}</EmailVerificationContext.Provider>
}
