import { useApiQuery } from '@/data/useApiQuery'
import { useOutboxState } from '@/features/outbox/useOutbox'
import type { OutboxOp } from '@/features/outbox/types'
import { transfersApi } from '@/features/transfers/transfersApi'
import type { Transfer } from '@/features/transfers/types'

export const transferKeys = {
  all: ['transfers'] as const,
  list: (params: unknown) => ['transfers', 'list', params] as const,
  detail: (id: string | undefined) => ['transfers', 'detail', id] as const,
}

/**
 * Transfers touching the branches the person sees, newest first. Kept on the device like every
 * inventory read, so what was on the way when the connection dropped can still be received
 * (MULTI_BRANCH_BUILD_PLAN.md §7.3).
 */
export function useTransfers(params: { branchId?: string; openOnly?: boolean }, enabled = true) {
  return useApiQuery({
    queryKey: transferKeys.list(params),
    queryFn: () => transfersApi.list({ ...params, size: 50 }),
    fallbackError: "Couldn't load transfers.",
    enabled,
  })
}

export function useTransfer(id: string | undefined) {
  return useApiQuery<Transfer>({
    queryKey: transferKeys.detail(id),
    queryFn: () => transfersApi.get(id!),
    fallbackError: "Couldn't load this transfer.",
    enabled: id != null,
  })
}

export type TransferOp = Extract<OutboxOp, { kind: 'TRANSFER_SEND' | 'TRANSFER_RECEIVE' }>

/** Waybills and receipts made on this phone and not yet sent (RECORDED, Pattern C). */
export function usePendingTransfers(): TransferOp[] {
  const { ops } = useOutboxState()
  return ops.filter((op): op is TransferOp => op.kind === 'TRANSFER_SEND' || op.kind === 'TRANSFER_RECEIVE')
}
