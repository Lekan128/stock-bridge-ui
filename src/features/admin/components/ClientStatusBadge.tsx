import { Badge } from '@/components/Badge'

export function ClientStatusBadge({ active }: { active: boolean }) {
  return <Badge variant={active ? 'success' : 'danger'}>{active ? 'Active' : 'Suspended'}</Badge>
}
