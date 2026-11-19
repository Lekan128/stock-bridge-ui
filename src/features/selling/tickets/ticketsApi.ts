import { api } from '@/api/client'

/**
 * Kitchen and bar tickets (API V102, V103; selling till Step 8). Where a branch has tickets on, each Send on a bill
 * gives every area its items come from a ticket of just its items; the bill's first send is NEW, later ones ADDED. The
 * area taps Ready; the waiter taps Served (which counts as Ready). An item taken off before it was made shows on its
 * ticket as "Don't send" until someone in the area taps OK.
 */
export type TicketKind = 'NEW' | 'ADDED'

export interface TicketLine {
  movementId: string
  lineKey: string
  /** The meal a side goes with: on this ticket, or sent before (then `withName` says which). */
  withKey?: string
  name: string
  quantity: number
  unit?: string
  note?: string
  takenOff?: 'NOT_MADE' | 'SENT_BACK'
  takenOffAt?: string
  takenOffByName?: string
  withName?: string
}

export interface Ticket {
  id: string
  billId: string
  kind: TicketKind
  /** "Table 5", "Window", or the name the bill is for. */
  label: string
  createdAt: string
  createdByName?: string
  readyAt?: string
  /** A waiter took it to the table (V103); Served counts as Ready. */
  servedAt?: string
  servedByName?: string
  /** An item on it was taken off before it was made, and nobody here has said OK yet: "Don't send". */
  changed?: boolean
  lines: TicketLine[]
}

export interface TicketArea {
  id: string
  name: string
  waiting: number
}

export const ticketsApi = {
  areas: (branchId: string) => api.get<TicketArea[]>('/api/tickets/areas', { params: { branchId } }).then((r) => r.data),
  list: (areaId: string) => api.get<Ticket[]>('/api/tickets', { params: { areaId } }).then((r) => r.data),
  ready: (id: string) => api.put<Ticket[]>(`/api/tickets/${id}/ready`).then((r) => r.data),
  notReady: (id: string) => api.delete<Ticket[]>(`/api/tickets/${id}/ready`).then((r) => r.data),
  /** OK to a "Don't send": what was taken off leaves the ticket. */
  seen: (id: string) => api.put<Ticket[]>(`/api/tickets/${id}/seen`).then((r) => r.data),
  /** Branch → Selling (V103). */
  setOn: (branchId: string, on: boolean) => api.put<{ on: boolean }>(`/api/branches/${branchId}/tickets`, { on }).then((r) => r.data),
}

/** A ticket's items as the kitchen reads them: each meal with its sides under it; identical plain dishes counted up. */
export interface TicketItem {
  quantity: number
  unit?: string
  name: string
  note?: string
  takenOff?: TicketLine['takenOff']
  takenOffAt?: string
  takenOffByName?: string
  sides: { quantity: number; name: string; note?: string; takenOff?: TicketLine['takenOff']; takenOffAt?: string; takenOffByName?: string }[]
  /** A side whose meal went out on an earlier ticket. */
  withName?: string
}

export function ticketItems(lines: TicketLine[]): TicketItem[] {
  const keys = new Set(lines.map((line) => line.lineKey))
  const items: (TicketItem & { key: string })[] = []
  const byKey = new Map<string, TicketItem>()
  for (const line of lines) {
    if (line.withKey && keys.has(line.withKey)) continue
    const item: TicketItem & { key: string } = {
      key: line.lineKey,
      quantity: line.quantity,
      unit: line.unit,
      name: line.name,
      note: line.note,
      takenOff: line.takenOff,
      takenOffAt: line.takenOffAt,
      takenOffByName: line.takenOffByName,
      sides: [],
      withName: line.withKey ? line.withName : undefined,
    }
    items.push(item)
    byKey.set(line.lineKey, item)
  }
  for (const line of lines) {
    if (!line.withKey || !keys.has(line.withKey)) continue
    byKey.get(line.withKey)?.sides.push({
      quantity: line.quantity,
      name: line.name,
      note: line.note,
      takenOff: line.takenOff,
      takenOffAt: line.takenOffAt,
      takenOffByName: line.takenOffByName,
    })
  }
  // "2 Jollof rice & chicken": identical dishes with nothing of their own are one row.
  const merged: TicketItem[] = []
  for (const item of items) {
    const plain = (i: TicketItem) => !i.note && i.sides.length === 0 && !i.takenOff && !i.withName
    const same = plain(item) && merged.find((m) => plain(m) && m.name === item.name && m.unit === item.unit)
    if (same) same.quantity += item.quantity
    else merged.push({ ...item, sides: [...item.sides] })
  }
  return merged
}

/** "Don't send" items on a ticket: what was taken off before it was made, with when and by whom. */
export function dontSend(ticket: Ticket): { names: string; at?: string; by?: string } | null {
  const off = ticket.lines.filter((line) => line.takenOff === 'NOT_MADE')
  if (!ticket.changed || off.length === 0) return null
  const last = off.reduce((a, b) => ((a.takenOffAt ?? '') > (b.takenOffAt ?? '') ? a : b))
  return {
    names: off.map((line) => (line.quantity !== 1 ? `${formatCount(line.quantity)} ${line.name}` : line.name)).join(', '),
    at: last.takenOffAt,
    by: last.takenOffByName,
  }
}

function formatCount(quantity: number): string {
  return Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2).replace(/0+$/, '')
}
