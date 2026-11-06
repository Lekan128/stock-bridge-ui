import { api } from '@/api/client'
import { recordingBranchId } from '@/features/outbox/outboxStore'

/**
 * Price requests (RFQ-0003): asking several suppliers for prices (PURCHASE_ORDER_PLAN.md section 11.3).
 * Nullable fields are left off the wire, so compare with `== null`.
 */

export interface PriceRequestLine {
  id: string
  productId: string
  productName: string
  unit: string
  comesIn: string
  quantity: number
}

export interface PriceQuote {
  lineId: string
  price?: number | null
  cannotSupply: boolean
  amount?: number | null
}

export type PriceSupplierStatus = 'NOT_SENT' | 'SENT' | 'OPENED' | 'REPLIED' | 'DECLINED'

export interface PriceRequestSupplier {
  id: string
  vendorId: string
  vendorName: string
  phone?: string | null
  email?: string | null
  status: PriceSupplierStatus
  sentVia?: 'WHATSAPP' | 'MESSAGE' | 'EMAIL' | null
  sentAt?: string | null
  openedAt?: string | null
  repliedAt?: string | null
  /** LINK: they typed it. TYPED: the buyer typed what they said. */
  replySource?: 'LINK' | 'TYPED' | null
  /** Replied more than once. */
  changed: boolean
  deliveryCharge?: number | null
  canDeliverOn?: string | null
  remark?: string | null
  quotes: PriceQuote[]
  total?: number | null
  complete: boolean
  orderId?: string | null
  orderNumber?: string | null
  url?: string | null
  message?: string | null
  whatsappUrl?: string | null
}

export interface PriceOption {
  kind: 'CHEAPEST' | 'SUPPLIER'
  supplierId?: string | null
  total: number
  orders: number
  suppliers: string[]
  linesCovered: number
}

export interface PriceRequest {
  id: string
  rfqNumber: string
  status: 'OPEN' | 'DONE' | 'CLOSED'
  neededBy?: string | null
  replyBy?: string | null
  branchId?: string | null
  note?: string | null
  createdByName?: string | null
  createdAt: string
  lines: PriceRequestLine[]
  suppliers: PriceRequestSupplier[]
  /** Line id → the supplier row with the lowest price for it. */
  lowestByLine: Record<string, string>
  options: PriceOption[]
}

export interface PriceRequestRow {
  id: string
  rfqNumber: string
  status: 'OPEN' | 'DONE' | 'CLOSED'
  createdAt: string
  products: string[]
  suppliers: number
  replied: number
  orderNumbers: string[]
}

export interface PriceReplyInput {
  lines: { lineId: string; price?: number | null; cannotSupply: boolean }[]
  deliveryCharge?: number | null
  canDeliverOn?: string | null
  remark?: string | null
  declined: boolean
}

export interface NewPriceRequest {
  lines: { productId: string; unit: string; quantity: number }[]
  vendorIds: string[]
  neededBy?: string
  replyBy?: string
  branchId?: string
  note?: string
}

/** What the supplier's own page shows (no login). */
export interface PublicPriceRequest {
  buyerName: string
  buyerPhone?: string | null
  buyerLogoUrl?: string | null
  rfqNumber: string
  supplierName: string
  neededBy?: string | null
  replyBy?: string | null
  deliverTo?: string | null
  lines: { id: string; productName: string; comesIn: string; quantity: number }[]
  state: 'OPEN' | 'ORDERED' | 'CLOSED'
  orderNumber?: string | null
  orderUrl?: string | null
  reply?: {
    repliedAt: string
    quotes: PriceQuote[]
    deliveryCharge?: number | null
    canDeliverOn?: string | null
    remark?: string | null
    declined: boolean
    total?: number | null
  } | null
}

const BASE = '/api/price-requests'
const PUBLIC = '/api/public/price-requests'

export const priceRequestsApi = {
  create(body: NewPriceRequest): Promise<PriceRequest> {
    return api.post<PriceRequest>(BASE, { branchId: recordingBranchId() ?? undefined, ...body }).then((r) => r.data)
  },
  list(status: 'OPEN' | 'ALL' = 'OPEN'): Promise<PriceRequestRow[]> {
    return api.get<PriceRequestRow[]>(BASE, { params: { status, size: 20 } }).then((r) => r.data)
  },
  counts(): Promise<{ open: number }> {
    return api.get<{ open: number }>(`${BASE}/counts`).then((r) => r.data)
  },
  get(id: string): Promise<PriceRequest> {
    return api.get<PriceRequest>(`${BASE}/${id}`).then((r) => r.data)
  },
  shared(id: string, supplierId: string, channel: 'WHATSAPP' | 'MESSAGE'): Promise<PriceRequest> {
    return api.post<PriceRequest>(`${BASE}/${id}/suppliers/${supplierId}/shared`, null, { params: { channel } }).then((r) => r.data)
  },
  reply(id: string, supplierId: string, body: PriceReplyInput): Promise<PriceRequest> {
    return api.put<PriceRequest>(`${BASE}/${id}/suppliers/${supplierId}/reply`, body).then((r) => r.data)
  },
  choose(id: string, kind: 'CHEAPEST' | 'SUPPLIER', supplierId?: string): Promise<{ orderIds: string[] }> {
    return api.post<{ orderIds: string[] }>(`${BASE}/${id}/choose`, { kind, supplierId }).then((r) => r.data)
  },
  close(id: string): Promise<PriceRequest> {
    return api.post<PriceRequest>(`${BASE}/${id}/close`).then((r) => r.data)
  },
  publicView(token: string): Promise<PublicPriceRequest> {
    return api.get<PublicPriceRequest>(`${PUBLIC}/${token}`).then((r) => r.data)
  },
  publicOpened(token: string): Promise<void> {
    return api.post(`${PUBLIC}/${token}/opened`).then(() => undefined)
  },
  publicReply(token: string, body: PriceReplyInput): Promise<PublicPriceRequest> {
    return api.put<PublicPriceRequest>(`${PUBLIC}/${token}/reply`, body).then((r) => r.data)
  },
}
