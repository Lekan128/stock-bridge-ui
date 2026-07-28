import { MapPinPlus } from 'lucide-react'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'

export interface EmptyAddressesStateProps {
  canManage: boolean
  onAdd: () => void
}

/**
 * An empty address book is not a neutral state — it is a blocked checkout. The copy says what the
 * consequence is rather than just "no addresses found", which tells nobody why it matters.
 */
export function EmptyAddressesState({ canManage, onAdd }: EmptyAddressesStateProps) {
  return (
    <EmptyState
      icon={MapPinPlus}
      title="No delivery addresses yet"
      description={
        canManage
          ? 'ProcurePal needs somewhere to deliver, so you will need at least one address before you can check out. Add your warehouse, store or office.'
          : 'ProcurePal needs somewhere to deliver, so your company needs at least one address before anyone can check out. Ask a colleague who manages delivery addresses to add one.'
      }
      action={canManage ? <Button onClick={onAdd}>Add your first address</Button> : undefined}
    />
  )
}
