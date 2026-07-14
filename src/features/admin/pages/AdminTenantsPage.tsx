import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pagination } from '@/components/Pagination'
import { useToast } from '@/components/useToast'
import { superAdminApiClient } from '@/features/admin/api/superAdminApi'
import { ClientTable } from '@/features/admin/components/ClientTable'
import { ClientsToolbar } from '@/features/admin/components/ClientsToolbar'
import { SuspendClientDialog } from '@/features/admin/components/SuspendClientDialog'
import { useClients } from '@/features/admin/hooks/useClients'
import type { ClientStatusFilter, SuperAdminClientSummary } from '@/features/admin/types'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { isAppError } from '@/types/api'

const PAGE_SIZE = 20

export function AdminTenantsPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ClientStatusFilter>('all')
  const [page, setPage] = useState(0)
  const [suspendTarget, setSuspendTarget] = useState<SuperAdminClientSummary | null>(null)
  const [suspending, setSuspending] = useState(false)
  const [activatingId, setActivatingId] = useState<string | null>(null)

  const debouncedSearch = useDebouncedValue(search, 350)

  const { data, loading, error, refetch } = useClients({
    search: debouncedSearch || undefined,
    active: statusFilter === 'all' ? undefined : statusFilter === 'active',
    page,
    size: PAGE_SIZE,
  })

  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(0)
  }

  function handleStatusFilterChange(value: ClientStatusFilter) {
    setStatusFilter(value)
    setPage(0)
  }

  async function handleConfirmSuspend() {
    if (!suspendTarget) return
    setSuspending(true)
    try {
      await superAdminApiClient.updateClientStatus(suspendTarget.id, false)
      setSuspendTarget(null)
      showToast(`${suspendTarget.name} suspended.`, 'success')
      refetch()
    } catch (err) {
      showToast(isAppError(err) ? err.message : 'Could not suspend this client.', 'error')
    } finally {
      setSuspending(false)
    }
  }

  async function handleActivate(client: SuperAdminClientSummary) {
    setActivatingId(client.id)
    try {
      await superAdminApiClient.updateClientStatus(client.id, true)
      showToast(`${client.name} reactivated.`, 'success')
      refetch()
    } catch (err) {
      showToast(isAppError(err) ? err.message : 'Could not reactivate this client.', 'error')
    } finally {
      setActivatingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-neutral-900">Tenants</h1>

      <ClientsToolbar
        search={search}
        onSearchChange={handleSearchChange}
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
      />

      {loading && (
        <div className="rounded-lg border border-neutral-200 bg-white p-10 text-center text-sm text-neutral-500">
          Loading…
        </div>
      )}

      {!loading && error && (
        <div className="rounded-md border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
      )}

      {!loading && !error && data && (
        <>
          {data.content.length === 0 ? (
            <p className="rounded-lg border border-neutral-200 bg-white px-4 py-10 text-center text-sm text-neutral-500">
              No clients match your search.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
              <ClientTable
                clients={data.content}
                onRowClick={(client) => navigate(`/admin/tenants/${client.id}`)}
                onRequestSuspend={setSuspendTarget}
                onActivate={(client) => void handleActivate(client)}
                activatingId={activatingId}
              />
            </div>
          )}
          <Pagination page={data.number} totalPages={data.totalPages} onPageChange={setPage} />
        </>
      )}

      <SuspendClientDialog
        open={suspendTarget !== null}
        clientName={suspendTarget?.name ?? ''}
        loading={suspending}
        onConfirm={() => void handleConfirmSuspend()}
        onCancel={() => setSuspendTarget(null)}
      />
    </div>
  )
}
