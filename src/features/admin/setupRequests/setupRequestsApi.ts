import { superAdminApi } from '@/api/superAdminClient'
import type { PageResponse } from '@/features/products/types'
import type { TenantLoginResponse } from '@/types/auth'
import { whatsAppLink } from '@/utils/whatsappNumber'

/** Where a setup has got to (setup_requests.status). NOT_A_FIT frees the founding place it took. */
export type SetupRequestStatus = 'NEW' | 'CONTACTED' | 'LIST_RECEIVED' | 'LOADED' | 'RUNNING' | 'NOT_A_FIT'

/** The queue's tabs. IN_PROGRESS is CONTACTED, LIST_RECEIVED and LOADED together. */
export type SetupRequestTab = 'NEW' | 'IN_PROGRESS' | 'RUNNING' | 'NOT_A_FIT'

export interface SetupRequest {
  id: string
  businessName: string
  /** +234 form. */
  whatsapp: string
  source: 'landing' | 'founding' | 'pricing' | 'app' | string
  status: SetupRequestStatus
  founding: boolean
  /** The account the shop created, once it has. Absent until then (the API omits nulls). */
  clientId?: string
  clientName?: string
  clientSlug?: string
  createdAt: string
  /** When somebody first moved it out of NEW: the speed-to-lead clock stops here. */
  contactedAt?: string
  note?: string
  /** Files the shop sent with "Send us your list" in the app (step 5). */
  listFiles: number
}

export interface ProductListFile {
  id: string
  fileName: string
  contentType: string
  sizeBytes: number
  uploadedAt: string
}

export interface SetupRequestCounts {
  waiting: number
  inProgress: number
  running: number
  notAFit: number
  all: number
  /** Over the last 30 days. Absent until something has been contacted. */
  medianMinutesToContact?: number
}

export const STATUS_LABELS: Record<SetupRequestStatus, string> = {
  NEW: 'Waiting for a reply',
  CONTACTED: 'Contacted',
  LIST_RECEIVED: 'List received',
  LOADED: 'Products loaded',
  RUNNING: 'Running',
  NOT_A_FIT: 'Not a fit',
}

export const setupRequestsApi = {
  list: (params: { tab?: SetupRequestTab; page?: number; size?: number }) =>
    superAdminApi.get<PageResponse<SetupRequest>>('/api/superadmin/setup-requests', { params }).then((r) => r.data),

  counts: () => superAdminApi.get<SetupRequestCounts>('/api/superadmin/setup-requests/counts').then((r) => r.data),

  /**
   * Every field optional. `contacted: true` records the first reply without changing the status
   * (a shop that sent its list before anybody answered). `note` replaces the note when given.
   */
  update: (id: string, payload: { status?: SetupRequestStatus; contacted?: boolean; note?: string }) =>
    superAdminApi.patch<SetupRequest>(`/api/superadmin/setup-requests/${id}`, payload).then((r) => r.data),

  listFiles: (clientId: string) =>
    superAdminApi.get<ProductListFile[]>(`/api/superadmin/clients/${clientId}/product-list`).then((r) => r.data),

  /** Downloads one file to this computer, under the name the shop sent it with. */
  downloadFile: async (clientId: string, file: ProductListFile) => {
    const response = await superAdminApi.get<Blob>(`/api/superadmin/clients/${clientId}/product-list/${file.id}`, {
      responseType: 'blob',
    })
    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url
    link.download = file.fileName
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  },

  /** A session inside the shop as its Procurepaddy support account (API SupportAccessService). */
  supportSession: (clientId: string) =>
    superAdminApi.post<TenantLoginResponse>(`/api/superadmin/clients/${clientId}/support-session`).then((r) => r.data),
}

/** Nobody has replied yet, whatever the status: the reply is still owed. */
export function awaitingReply(request: Pick<SetupRequest, 'contactedAt' | 'status'>): boolean {
  return request.contactedAt == null && request.status !== 'RUNNING' && request.status !== 'NOT_A_FIT'
}

/**
 * The first WhatsApp message, already typed (LAUNCH_MATERIALS.md §3). The alert email's
 * "Reply on WhatsApp" builds the same one (stock-bridge-api, SetupRequestAlerts.replyUrl).
 */
export function replyLink(request: Pick<SetupRequest, 'whatsapp' | 'businessName'>): string {
  return whatsAppLink(
    request.whatsapp,
    `Hello ${request.businessName}, this is Procurepaddy. Thank you for booking your setup. To load your products, send your product list here: an Excel file, a CSV, or clear photos of your stock book. We will have it in within 24 hours.`,
  )
}

/** 8am to 6pm, Monday to Saturday, Lagos time: when the 5-minute reply promise applies (plan rule 5). */
export function inStaffedHours(at: Date): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    weekday: 'short',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(at)
  const weekday = parts.find((part) => part.type === 'weekday')?.value
  const hour = Number(parts.find((part) => part.type === 'hour')?.value)
  return weekday !== 'Sun' && hour >= 8 && hour < 18
}

/** "4 min", "2 h 10 min", "3 days": how long something has waited. */
export function formatWait(minutes: number): string {
  if (minutes < 1) return 'under a minute'
  if (minutes < 60) return `${Math.floor(minutes)} min`
  if (minutes < 60 * 24) {
    const hours = Math.floor(minutes / 60)
    const rest = Math.floor(minutes % 60)
    return rest ? `${hours} h ${rest} min` : `${hours} h`
  }
  const days = Math.floor(minutes / (60 * 24))
  return `${days} day${days === 1 ? '' : 's'}`
}
