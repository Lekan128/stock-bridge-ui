import Dexie, { type Table } from 'dexie'
import { invalidateInventory, syncProductIntoCache } from '@/data/inventoryCache'
import { queryClient } from '@/data/queryClient'
import { queryKeys } from '@/data/queryKeys'
import type { OutboxOp, OutboxProblem, StockCountPayload, SubmitOutcome } from '@/features/outbox/types'
import { stockApi, type StockInRequestPayload } from '@/features/products/api/stockApi'
import type { StockMutationResponse, StockOutPayload } from '@/features/products/types'
import { isAppError } from '@/types/api'

/**
 * Stock writes that could not reach the server yet (INVENTORY_OFFLINE_AND_CHARACTER_PLAN.md, A4).
 *
 * Every stock-in, stock-out and count goes through here. Online it is sent at once and behaves
 * exactly as before — including an oversell answered in the form, where the person can fix it.
 * When the server can't be reached, it is saved on this phone and sent later:
 *
 *   - in the order it was entered, per product (a sale is never sent before the delivery it
 *     depends on), products independently of one another;
 *   - with its own Idempotency-Key, so a resend after a lost reply is recorded once;
 *   - dated when it was ENTERED, and flagged as late, so the server can tell a sale made before a
 *     stock count from one made after it (`StockManagementService`);
 *   - on every sign of a connection: back online, the page shown again, every 20 s while anything
 *     waits, and straight after anything new is added.
 *
 * A write the server refuses once it arrives (oversold by then, product gone, permission removed)
 * is never dropped: it waits as "needs you" until the person decides, and the product's later
 * writes wait behind it.
 */

export interface OutboxState {
  /** Every waiting write, oldest first. */
  ops: OutboxOp[]
  /** True while a write is on its way. */
  sending: boolean
  /** Writes sent so far in the current round of sending, for "Sending 2 of 5" (A6). */
  sentThisRound: number
  /** When the last round that sent anything finished, for a brief "All caught up". */
  lastSentAt: number | null
  /**
   * Writes that waited on this phone and have since been sent, newest first — the sync centre's
   * "Sent" receipts. This session only and capped: a reassurance, not a history (that's the
   * product's own movement list).
   */
  recentlySent: SentOp[]
  /** The outbox for the signed-in user is open. */
  ready: boolean
}

const RETRY_INTERVAL_MS = 20_000
/** Back-off after a failed attempt: 5 s, 10 s, 20 s … capped at 5 minutes. */
const backoff = (attempts: number) => Math.min(5_000 * 2 ** Math.max(0, attempts - 1), 300_000)

class OutboxDatabase extends Dexie {
  ops!: Table<OutboxOp, string>

  constructor(name: string) {
    super(name)
    this.version(1).stores({ ops: 'id, productId, createdAt' })
  }
}

export type SentOp = OutboxOp & { sentAt: number }
const RECENT_LIMIT = 10

const CLOSED: OutboxState = { ops: [], sending: false, sentThisRound: 0, lastSentAt: null, recentlySent: [], ready: false }
let state: OutboxState = CLOSED
const listeners = new Set<() => void>()

function setState(patch: Partial<OutboxState>): void {
  state = { ...state, ...patch }
  for (const listener of listeners) listener()
}

export function subscribeOutbox(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getOutboxState(): OutboxState {
  return state
}

// --------------------------------------------------------------------------------- lifecycle

let db: OutboxDatabase | null = null
let databaseName: string | null = null
let stopTriggers: (() => void) | null = null

export async function startOutbox(name: string): Promise<void> {
  if (databaseName === name) return
  await stopOutbox({ deleteData: false })
  databaseName = name
  db = new OutboxDatabase(name)
  try {
    const ops = await db.ops.orderBy('createdAt').toArray()
    if (databaseName !== name) return
    setState({ ops, ready: true })
  } catch {
    // No IndexedDB (some private modes): writes are still sent online, just not kept offline.
    setState({ ops: [], ready: true })
  }
  stopTriggers = attachTriggers()
  void processOutbox()
}

/**
 * Closes the outbox. With `deleteData`, the waiting writes are gone for good — only ever after the
 * person has been told and agreed (the logout guard). A session that simply ends keeps them, so the
 * same person signing in again picks up where they left off.
 */
export async function stopOutbox({ deleteData }: { deleteData: boolean }): Promise<void> {
  const name = databaseName
  databaseName = null
  stopTriggers?.()
  stopTriggers = null
  db?.close()
  db = null
  setState(CLOSED)
  if (deleteData && name) {
    try {
      await Dexie.delete(name)
    } catch {
      // Already gone.
    }
  }
}

function attachTriggers(): () => void {
  const kick = () => void processOutbox()
  const onVisible = () => {
    if (document.visibilityState === 'visible') kick()
  }
  window.addEventListener('online', kick)
  document.addEventListener('visibilitychange', onVisible)
  const timer = window.setInterval(() => {
    if (state.ops.some((op) => op.status === 'pending')) kick()
  }, RETRY_INTERVAL_MS)
  return () => {
    window.removeEventListener('online', kick)
    document.removeEventListener('visibilitychange', onVisible)
    window.clearInterval(timer)
  }
}

async function save(op: OutboxOp): Promise<void> {
  setState({ ops: [...state.ops.filter((existing) => existing.id !== op.id), op].sort((a, b) => a.createdAt - b.createdAt) })
  await db?.ops.put(op).catch(() => undefined)
}

async function remove(id: string): Promise<void> {
  setState({ ops: state.ops.filter((op) => op.id !== id) })
  await db?.ops.delete(id).catch(() => undefined)
}

// ------------------------------------------------------------------------------------ sending

/** No answer at all, or a server error: worth trying again later. Anything else is an answer. */
function isTransient(error: unknown): boolean {
  return isAppError(error) && (error.status === 0 || error.status >= 500)
}

function send(op: OutboxOp, { late }: { late: boolean }): Promise<StockMutationResponse> {
  // A write sent the moment it is entered is dated by the server, as always. One sent later
  // carries the moment it was entered, and says it is late.
  const timing = late ? { occurredAt: new Date(op.createdAt).toISOString(), recordedOffline: true } : {}
  switch (op.kind) {
    case 'STOCK_IN':
      return stockApi.stockIn(op.productId, { ...op.payload, ...timing } as StockInRequestPayload, op.id)
    case 'STOCK_OUT':
      return stockApi.stockOut(op.productId, { ...op.payload, ...timing } as StockOutPayload, op.id)
    case 'COUNT':
      return stockApi.count(
        op.productId,
        { ...op.payload, ...(late ? { countedAt: new Date(op.createdAt).toISOString() } : {}) },
        op.id,
      )
  }
}

/** What the server answered, made into something the person can act on. */
function problemFrom(error: unknown): OutboxProblem {
  if (isAppError(error) && error.status === 409 && error.availableQuantity != null && error.requestedQuantity != null) {
    return { kind: 'oversell', message: error.message, available: error.availableQuantity, requested: error.requestedQuantity }
  }
  if (isAppError(error) && error.status === 404) {
    return { kind: 'refused', message: 'This product no longer exists.' }
  }
  if (isAppError(error) && error.status === 403) {
    return { kind: 'refused', message: 'Your account is no longer allowed to record this.' }
  }
  return { kind: 'refused', message: isAppError(error) ? error.message : 'The server could not record this.' }
}

/** The product's figures everywhere — detail, list, device catalogue — after a write lands (or is undone). */
export function applyStockResult(productId: string, response: StockMutationResponse): void {
  if (response.product) syncProductIntoCache(queryClient, response.product)
  void queryClient.invalidateQueries({ queryKey: ['products', 'history', productId] })
  void queryClient.invalidateQueries({ queryKey: queryKeys.products.lowStock })
  void invalidateInventory(queryClient)
}

type NewOp =
  | { kind: 'STOCK_IN'; productId: string; productName: string; summary: string; payload: StockInRequestPayload; baseDelta: number }
  | { kind: 'STOCK_OUT'; productId: string; productName: string; summary: string; payload: StockOutPayload; baseDelta: number }
  | { kind: 'COUNT'; productId: string; productName: string; summary: string; payload: StockCountPayload }

/**
 * Records a stock write: sent now if the server can be reached, otherwise saved on this phone.
 *
 * A refusal that comes back NOW (oversell, invalid entry) is thrown, exactly as the form expects:
 * the person is looking at it and can fix it. Only a write that could not be sent is queued.
 * A write behind another for the same product that is still waiting is queued straight away, so
 * the product's writes always arrive in the order they were made.
 */
export async function submitStockWrite(input: NewOp): Promise<SubmitOutcome<StockMutationResponse>> {
  const op = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    status: 'pending',
    attempts: 0,
    nextAttemptAt: 0,
    ...(input.kind === 'COUNT' ? { baseDelta: null } : {}),
  } as OutboxOp

  const waitingBehind = state.ops.some((existing) => existing.productId === op.productId)
  // Choosing which deliveries a sale comes from needs the server's current lots: never queued.
  const mustBeOnline = op.kind === 'STOCK_OUT' && (op.payload.allocations?.length ?? 0) > 0

  if (!waitingBehind) {
    try {
      const response = await send(op, { late: false })
      applyStockResult(op.productId, response)
      return { status: 'sent', response }
    } catch (error) {
      if (!isTransient(error) || mustBeOnline) throw error
    }
  } else if (mustBeOnline) {
    throw { status: 0, message: 'Choosing which deliveries this comes from needs a connection.' }
  }

  await save({ ...op, attempts: 1, nextAttemptAt: Date.now() + backoff(1) })
  void processOutbox()
  return { status: 'queued', op }
}

let processing = false
let processAgain = false
/**
 * "Send now" holds for the whole round, not just its first pass: a product's next write only
 * becomes sendable once the one before it lands, and is still inside its own back-off then.
 */
let forceRound = false
/** The write on its way right now, if any — too late to take back (Undo, B2). */
let inFlightId: string | null = null

/** Whether this write is being sent at this moment, so taking it back can no longer stop it. */
export function isInFlight(id: string): boolean {
  return inFlightId === id
}

/** Sends whatever can be sent now. Single-flight; a call while running runs again after. */
export async function processOutbox({ force = false }: { force?: boolean } = {}): Promise<void> {
  if (!db) return
  if (force) forceRound = true
  if (state.ops.length === 0) {
    if (!processing) finishRound()
    return
  }
  if (processing) {
    processAgain = true
    return
  }
  processing = true
  try {
    // The first waiting write per product; anything behind it waits its turn.
    const heads = new Map<string, OutboxOp>()
    for (const op of state.ops) if (!heads.has(op.productId)) heads.set(op.productId, op)
    for (const op of heads.values()) {
      if (op.status !== 'pending') continue
      if (!forceRound && op.nextAttemptAt > Date.now()) continue
      setState({ sending: true })
      inFlightId = op.id
      try {
        const response = await send(op, { late: true })
        await remove(op.id)
        setState({
          sentThisRound: state.sentThisRound + 1,
          recentlySent: [{ ...op, sentAt: Date.now() }, ...state.recentlySent].slice(0, RECENT_LIMIT),
        })
        applyStockResult(op.productId, response)
        processAgain = true // the product's next write, if any, can go now
      } catch (error) {
        if (isTransient(error)) {
          const attempts = op.attempts + 1
          await save({ ...op, attempts, nextAttemptAt: Date.now() + backoff(attempts) })
        } else {
          await save({ ...op, status: 'needs_attention', problem: problemFrom(error) })
        }
      } finally {
        inFlightId = null
      }
    }
  } finally {
    processing = false
    if (processAgain) {
      processAgain = false
      void processOutbox() // still the same round: `sending` and the tally carry over
    } else {
      finishRound()
    }
  }
}

/** The round is over: nothing more can go until the next trigger. */
function finishRound(): void {
  forceRound = false
  if (!state.sending && state.sentThisRound === 0) return
  setState({
    sending: false,
    sentThisRound: 0,
    ...(state.sentThisRound > 0 ? { lastSentAt: Date.now() } : {}),
  })
}

// ---------------------------------------------------------------------------- resolving

/** Try a waiting or refused write again now. */
export async function retryOp(id: string): Promise<void> {
  const op = state.ops.find((entry) => entry.id === id)
  if (!op) return
  await save({ ...op, status: 'pending', problem: undefined, nextAttemptAt: 0 })
  await processOutbox({ force: true })
}

/** Give up on a write. It is never sent. */
export async function discardOp(id: string): Promise<void> {
  await remove(id)
  void processOutbox()
}

/**
 * Oversold by the time it arrived: send it for what was actually there instead. A new write with
 * a new key — the old key names a request for the original quantity, and the server would refuse
 * to replay it for a different one.
 */
export async function sendAvailableInstead(id: string): Promise<void> {
  const op = state.ops.find((entry) => entry.id === id)
  if (!op || op.kind !== 'STOCK_OUT' || op.problem?.kind !== 'oversell') return
  const available = op.problem.available
  if (available <= 0) {
    await remove(op.id)
    return
  }
  // `available` is in stock units, so the replacement is entered in stock units too. Swapped in
  // one step, keeping its place in the queue, so the list never shows nothing waiting in between.
  const replacement: OutboxOp = {
    ...op,
    id: crypto.randomUUID(),
    payload: { ...op.payload, quantity: available, unit: undefined, allocations: undefined },
    baseDelta: -available,
    summary: `${available} (what was left)`,
    status: 'pending',
    problem: undefined,
    attempts: 0,
    nextAttemptAt: 0,
  }
  setState({ ops: state.ops.map((entry) => (entry.id === op.id ? replacement : entry)) })
  await db?.transaction('rw', db.ops, async () => {
    await db!.ops.delete(op.id)
    await db!.ops.put(replacement)
  }).catch(() => undefined)
  await processOutbox({ force: true })
}
