import { api } from '@/api/client'
import type { BranchTable } from '@/features/branches/types'
import type { SalePaymentMethod } from '@/features/selling/sale/paymentMethod'
import type { SaleDetail } from '@/features/selling/sales/types'

/** An open bill on the grid (API V99, selling till Step 7). */
export interface BillSummary {
  id: string
  branchId: string
  tableId?: string
  name?: string
  /** "Table 5", "Window", or the name a bill was opened for. */
  label: string
  status: 'OPEN' | 'PAID' | 'CANCELLED'
  openedAt: string
  openedByName?: string
  total: number
  items: number
  lastSentAt?: string
}

/** A line already sent to a bill. */
export interface SentLine {
  movementId: string
  lineKey: string
  withKey?: string
  productId: string
  productName: string
  categoryId?: string
  /** Made here (a dish, a mixed drink) rather than kept in stock - how "can it go back?" is asked. */
  madeHere?: boolean
  quantity: number
  enteredUnit?: string
  enteredQuantity?: number
  amount?: number
  areaId?: string
  areaName?: string
  note?: string
  sentAt: string
  sentByName?: string
  takenOff?: 'NOT_MADE' | 'SENT_BACK'
  takenOffNote?: string
}

export interface Bill {
  summary: BillSummary
  lines: SentLine[]
}

export const billsApi = {
  open: (branchId: string) => api.get<BillSummary[]>('/api/bills', { params: { branchId } }).then((r) => r.data),
  get: (id: string) => api.get<Bill>(`/api/bills/${id}`).then((r) => r.data),
  start: (branchId: string, target: { tableId?: string; name?: string }) =>
    api.post<BillSummary>('/api/bills', { branchId, ...target }).then((r) => r.data),
  servedFrom: (branchId: string) =>
    api.get<{ productId: string; areaId: string }[]>('/api/bills/served-from', { params: { branchId } }).then((r) => r.data),
  takeOff: (id: string, movementId: string, kind: 'NOT_MADE' | 'SENT_BACK', note: string) =>
    api.post<Bill>(`/api/bills/${id}/lines/${movementId}/take-off`, { kind, note }).then((r) => r.data),
  pay: (id: string, method: SalePaymentMethod, accountId?: string, areaId?: string) =>
    api.post<SaleDetail>(`/api/bills/${id}/pay`, { method, accountId, areaId }).then((r) => r.data),
  close: (id: string) => api.post<BillSummary>(`/api/bills/${id}/close`).then((r) => r.data),
}

export const tablesApi = {
  list: (branchId: string) => api.get<BranchTable[]>(`/api/branches/${branchId}/tables`).then((r) => r.data),
  add: (branchId: string, request: { count?: number; name?: string }) =>
    api.post<BranchTable[]>(`/api/branches/${branchId}/tables`, request).then((r) => r.data),
  update: (id: string, request: { name?: string; active?: boolean }) =>
    api.patch<BranchTable[]>(`/api/tables/${id}`, request).then((r) => r.data),
  order: (branchId: string, ids: string[]) =>
    api.put<BranchTable[]>(`/api/branches/${branchId}/tables/order`, { ids }).then((r) => r.data),
}

/** "Table 5" for a number, the name as it is otherwise ("Window", "VIP"). */
export function tableLabel(name: string): string {
  return /^\d+$/.test(name) ? `Table ${name}` : name
}

/** "25 min", "1 h 10" - how long a bill has been open. */
export function openFor(since: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - new Date(since).getTime()) / 60000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest}`
}
