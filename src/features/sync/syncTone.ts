import type { SyncTone } from '@/features/sync/useSyncStatus'

/** The pill's colours, shared with the sync centre's headline so the two always match (A6). */
export const TONE_CLASS: Record<SyncTone, string> = {
  quiet: 'border-transparent bg-transparent text-neutral-500 hover:bg-neutral-100',
  info: 'border-primary-100 bg-primary-50 text-primary-800',
  good: 'border-accent-200 bg-accent-50 text-accent-800',
  warning: 'border-warning-200 bg-warning-50 text-warning-800',
  danger: 'border-danger-200 bg-danger-50 text-danger-800',
}
