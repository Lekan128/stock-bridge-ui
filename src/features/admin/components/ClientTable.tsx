import { ClientStatusBadge } from '@/features/admin/components/ClientStatusBadge'
import { formatDate } from '@/features/admin/formatters'
import type { SuperAdminClientSummary } from '@/features/admin/types'

export interface ClientTableProps {
  clients: SuperAdminClientSummary[]
  onRowClick: (client: SuperAdminClientSummary) => void
  onRequestSuspend: (client: SuperAdminClientSummary) => void
  onActivate: (client: SuperAdminClientSummary) => void
  activatingId?: string | null
}

const columns = ['Client', 'Identifier', 'Status', 'Users', 'Products', 'Created']

export function ClientTable({ clients, onRowClick, onRequestSuspend, onActivate, activatingId }: ClientTableProps) {
  return (
    <table className="w-full border-separate border-spacing-0 text-sm">
      <thead>
        <tr>
          {columns.map((label) => (
            <th
              key={label}
              scope="col"
              className="border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 text-left text-xs font-medium text-neutral-500"
            >
              {label}
            </th>
          ))}
          <th scope="col" className="border-b border-neutral-200 bg-neutral-50 px-4 py-2.5" />
        </tr>
      </thead>
      <tbody>
        {clients.map((client) => (
          <tr
            key={client.id}
            onClick={() => onRowClick(client)}
            className="cursor-pointer hover:bg-neutral-50"
          >
            <td className="border-b border-neutral-100 px-4 py-2.5 font-medium text-neutral-900">{client.name}</td>
            <td className="border-b border-neutral-100 px-4 py-2.5 text-neutral-600">{client.slug}</td>
            <td className="border-b border-neutral-100 px-4 py-2.5">
              <ClientStatusBadge active={client.active} />
            </td>
            <td className="border-b border-neutral-100 px-4 py-2.5 text-neutral-600">{client.userCount}</td>
            <td className="border-b border-neutral-100 px-4 py-2.5 text-neutral-600">{client.productCount}</td>
            <td className="border-b border-neutral-100 px-4 py-2.5 text-neutral-600">{formatDate(client.createdAt)}</td>
            <td className="border-b border-neutral-100 px-4 py-2.5 text-right">
              <button
                type="button"
                disabled={activatingId === client.id}
                onClick={(e) => {
                  e.stopPropagation()
                  if (client.active) onRequestSuspend(client)
                  else onActivate(client)
                }}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
                  client.active
                    ? 'border-danger-200 text-danger-600 hover:bg-danger-50'
                    : 'border-accent-200 text-accent-700 hover:bg-accent-50'
                }`}
              >
                {client.active ? 'Suspend' : activatingId === client.id ? 'Activating…' : 'Activate'}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
