import { useEffect, type ReactNode } from 'react'
import { useAuth } from '@/auth/useAuth'
import { startOutbox, stopOutbox } from '@/features/outbox/outboxStore'

/**
 * Opens the signed-in user's outbox (A4). Unlike the caches it is NOT deleted when the session
 * ends: the writes in it are work nobody has been paid for yet. Only the logout guard deletes
 * them, after the person has been told and agreed (`UserMenu`).
 */
export function OutboxProvider({ children }: { children: ReactNode }) {
  const { user, client } = useAuth()
  const databaseName = user ? `procurepaddy-outbox:${client?.id ?? 'unknown'}:${user.id}` : null

  useEffect(() => {
    if (databaseName != null) void startOutbox(databaseName)
    else void stopOutbox({ deleteData: false })
  }, [databaseName])

  return children
}
