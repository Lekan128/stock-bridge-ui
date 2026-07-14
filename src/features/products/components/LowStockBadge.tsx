import { AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/Badge'

export function LowStockBadge({ className = '' }: { className?: string }) {
  return (
    <Badge variant="warning" className={className}>
      <AlertTriangle className="h-3 w-3" />
      Low stock
    </Badge>
  )
}
