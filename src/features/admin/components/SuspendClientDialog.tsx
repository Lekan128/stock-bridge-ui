import { ConfirmDialog } from '@/components/ConfirmDialog'

export interface SuspendClientDialogProps {
  open: boolean
  clientName: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Shared between the tenant list and tenant detail pages so the suspend confirmation
 * copy — and its explicit callout of the login-blocking consequence — stays in one place. */
export function SuspendClientDialog({ open, clientName, loading, onConfirm, onCancel }: SuspendClientDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      title="Suspend client"
      message={`Suspend ${clientName}? Every user at this client will be immediately signed out and unable to log in until this client is reactivated.`}
      confirmLabel="Suspend"
      confirmVariant="danger"
      loading={loading}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
