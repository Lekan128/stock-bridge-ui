import { useEffect, type ReactNode } from 'react'
import { useAuth } from '@/auth/useAuth'
import { closeDrafts, openDrafts } from '@/features/drafts/draftStore'

/** Opens the signed-in user's drafts (A5). Closed, not deleted, when the session simply ends. */
export function DraftsProvider({ children }: { children: ReactNode }) {
  const { user, client } = useAuth()
  const databaseName = user ? `procurepaddy-drafts:${client?.id ?? 'unknown'}:${user.id}` : null

  useEffect(() => {
    if (databaseName != null) void openDrafts(databaseName)
    else closeDrafts()
  }, [databaseName])

  return children
}
