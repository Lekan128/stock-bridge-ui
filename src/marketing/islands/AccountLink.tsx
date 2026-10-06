import { useEffect, useState } from 'react'

/** The workspace's refresh token (`authStorage`): someone has signed in on this browser. */
const SESSION_KEY = 'sb.refreshToken'

/** "Log in", or "Open your workspace" for someone already signed in here. Decided after hydration. */
export function AccountLink() {
  const [hasSession, setHasSession] = useState(false)
  useEffect(() => {
    try {
      setHasSession(localStorage.getItem(SESSION_KEY) != null)
    } catch {
      // Storage blocked: keep "Log in".
    }
  }, [])
  return hasSession ? (
    <a href="/app" className="rounded-md px-3 py-2 text-sm font-semibold whitespace-nowrap text-primary-700 hover:bg-primary-50">
      Open your workspace
    </a>
  ) : (
    <a href="/login" className="rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap text-neutral-700 hover:bg-neutral-100">
      Log in
    </a>
  )
}
