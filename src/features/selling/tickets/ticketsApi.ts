import { api } from '@/api/client'

/**
 * Kitchen and bar tickets (API V102, selling till Step 8). Each Send on a bill gives every area its items come from a
 * ticket of just its items; the bill's first send is NEW, later ones ADDED, and an item taken off before it was made
 * gives its area a DONT_MAKE ticket.
 */
export type TicketKind = 'NEW' | 'ADDED' | 'DONT_MAKE'

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
  doneAt?: string
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
  done: (id: string) => api.put<Ticket[]>(`/api/tickets/${id}/done`).then((r) => r.data),
  notDone: (id: string) => api.delete<Ticket[]>(`/api/tickets/${id}/done`).then((r) => r.data),
}

/** A ticket's items as the kitchen reads them: each meal with its sides under it; identical plain dishes counted up. */
export interface TicketItem {
  quantity: number
  unit?: string
  name: string
  note?: string
  takenOff?: TicketLine['takenOff']
  sides: { quantity: number; name: string; note?: string; takenOff?: TicketLine['takenOff'] }[]
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
      sides: [],
      withName: line.withKey ? line.withName : undefined,
    }
    items.push(item)
    byKey.set(line.lineKey, item)
  }
  for (const line of lines) {
    if (!line.withKey || !keys.has(line.withKey)) continue
    byKey.get(line.withKey)?.sides.push({ quantity: line.quantity, name: line.name, note: line.note, takenOff: line.takenOff })
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
