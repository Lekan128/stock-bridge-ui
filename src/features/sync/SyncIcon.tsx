import { CloudCheck, CloudOff, CloudUpload, RefreshCw, TriangleAlert } from 'lucide-react'
import type { SyncStatus } from '@/features/sync/useSyncStatus'

export function SyncIcon({ status, className }: { status: SyncStatus; className: string }) {
  switch (status.kind) {
    case 'attention':
      return <TriangleAlert className={className} aria-hidden="true" />
    case 'offline':
      return <CloudOff className={className} aria-hidden="true" />
    case 'sending':
      return <RefreshCw className={`${className} motion-safe:animate-spin`} aria-hidden="true" />
    case 'waiting':
      return <CloudUpload className={className} aria-hidden="true" />
    default:
      return <CloudCheck className={className} aria-hidden="true" />
  }
}
