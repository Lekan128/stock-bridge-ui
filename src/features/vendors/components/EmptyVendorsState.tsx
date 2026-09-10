import { Contact } from 'lucide-react'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'

export interface EmptyVendorsStateProps {
  canManage: boolean
  /** True when a search or kind filter is active — "no matches" is a different fact from "none yet". */
  filtered: boolean
  onAdd: () => void
  onClearFilters: () => void
}

/**
 * An empty directory is not a failure, and the copy has to say which of two very different empty
 * states this is. "No suppliers match Ada" wants the filter cleared; "you have no suppliers yet"
 * wants to explain that half the list fills itself in — a company that does not know marketplace
 * purchases add themselves will assume the feature is broken when their first entry appears
 * unbidden.
 */
export function EmptyVendorsState({ canManage, filtered, onAdd, onClearFilters }: EmptyVendorsStateProps) {
  if (filtered) {
    return (
      <EmptyState
        icon={Contact}
        title="No suppliers match that"
        description="Try a different name, or show both kinds of supplier."
        action={
          <Button variant="secondary" onClick={onClearFilters}>
            Clear filters
          </Button>
        }
      />
    )
  }

  return (
    <EmptyState
      icon={Contact}
      title="No suppliers yet"
      description={
        canManage
          ? 'Sellers you buy from on the ProcurePaddy marketplace are added here automatically after your first order. Add the suppliers you deal with off-platform — the local miller, the diesel supplier — yourself.'
          : 'Sellers your company buys from on the ProcurePaddy marketplace are added here automatically after the first order. Ask a colleague in procurement to add the suppliers you deal with off-platform.'
      }
      action={canManage ? <Button onClick={onAdd}>Add your first supplier</Button> : undefined}
    />
  )
}
