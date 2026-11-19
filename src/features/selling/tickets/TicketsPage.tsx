import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChefHat, Printer, Undo2, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { useToast } from '@/components/useToast'
import { useApiQuery } from '@/data/useApiQuery'
import { isAppError } from '@/types/api'
import { useOptionalWorkingBranch } from '@/features/branches/useWorkingBranch'
import { formatNumber } from '@/features/products/unitCopy'
import { dontSend, ticketItems, ticketsApi, type Ticket, type TicketArea } from '@/features/selling/tickets/ticketsApi'

const AREA_KEY = (branchId: string) => `tickets-area:${branchId}`
const SOUND_KEY = 'tickets-sound'
const PRINT_KEY = (areaId: string) => `tickets-print-new:${areaId}`

function readStore(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStore(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Blocked storage: the choice lasts until the page is closed.
  }
}

/**
 * Tickets (selling till Step 8, API V102-V103; owner, 2026-11-19): one area's page, left open on a phone or tablet
 * there. What a bill sends to this area comes in as a ticket, with a sound; Print gives the paper copy; Ready moves it
 * down (Not ready brings it back), and so does a waiter's Served. An item taken off before it was made turns its
 * ticket red, "Don't send", with a sound, until someone taps OK. The device stays awake while the page is open.
 */
export function TicketsPage() {
  const branches = useOptionalWorkingBranch()
  const branch =
    (branches?.working?.ticketsOn ? branches.working : null) ??
    branches?.branches.find((b) => b.ticketsOn) ??
    branches?.working ??
    branches?.branches[0] ??
    null
  const areas = useApiQuery<TicketArea[]>({
    queryKey: ['ticket-areas', branch?.id ?? null],
    queryFn: () => ticketsApi.areas(branch!.id),
    fallbackError: "Couldn't load the areas.",
    enabled: !!branch,
    refetchInterval: 15_000,
  })
  const [areaId, setAreaId] = useState<string | null>(() => (branch ? readStore(AREA_KEY(branch.id)) : null))
  const area = areas.data?.find((a) => a.id === areaId) ?? areas.data?.find((a) => a.waiting > 0) ?? areas.data?.[0] ?? null

  if (!branch) return null
  return (
    <div className="flex flex-col gap-4">
      {area ? (
        <AreaTickets
          key={area.id}
          area={area}
          areas={areas.data ?? []}
          onArea={(id) => {
            setAreaId(id)
            writeStore(AREA_KEY(branch.id), id)
          }}
        />
      ) : (
        <>
          <h1 className="text-xl font-semibold text-neutral-900 lg:text-2xl">Tickets</h1>
          {!areas.loading && (
            <EmptyState
              icon={ChefHat}
              title="No tickets here"
              description="Tickets come to the areas you work in, where the branch has kitchen and bar tickets on (Branch → Selling)."
            />
          )}
        </>
      )}
    </div>
  )
}

function AreaTickets({ area, areas, onArea }: { area: TicketArea; areas: TicketArea[]; onArea: (id: string) => void }) {
  const { showToast } = useToast()
  const tickets = useApiQuery<Ticket[]>({
    queryKey: ['tickets', area.id],
    queryFn: () => ticketsApi.list(area.id),
    fallbackError: "Couldn't load the tickets.",
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  })
  const waiting = useMemo(() => (tickets.data ?? []).filter((t) => !t.readyAt || t.changed), [tickets.data])
  const ready = useMemo(() => (tickets.data ?? []).filter((t) => t.readyAt && !t.changed), [tickets.data])
  const sound = useTicketSound()
  const [printNew, setPrintNew] = useState(() => readStore(PRINT_KEY(area.id)) === '1')
  const [printing, setPrinting] = useState<{ ticket: Ticket; dontSend?: boolean }[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  useWakeLock()
  useTicker(30_000)

  // A ticket not seen before, or a "Don't send" not seen before: a sound, and its paper copy when this device prints
  // new ones by itself.
  const seen = useRef<{ ids: Set<string>; changed: Set<string> } | null>(null)
  useEffect(() => {
    if (!tickets.data) return
    const ids = new Set(tickets.data.map((t) => t.id))
    const changed = new Set(tickets.data.filter((t) => t.changed).map((t) => t.id))
    if (seen.current) {
      const fresh = tickets.data.filter((t) => !t.readyAt && !seen.current!.ids.has(t.id))
      const turned = tickets.data.filter((t) => t.changed && !seen.current!.changed.has(t.id))
      if (fresh.length > 0 || turned.length > 0) {
        sound.play()
        if (printNew) setPrinting([...fresh.map((ticket) => ({ ticket })), ...turned.map((ticket) => ({ ticket, dontSend: true }))])
      }
    }
    seen.current = { ids, changed }
  }, [tickets.data, printNew, sound])

  useEffect(() => {
    if (printing.length === 0) return
    const root = document.documentElement
    root.dataset.page = 'tickets'
    const finished = () => {
      if (root.dataset.page === 'tickets') delete root.dataset.page
      window.removeEventListener('afterprint', finished)
      setPrinting([])
    }
    window.addEventListener('afterprint', finished)
    window.print()
  }, [printing])

  async function act(ticket: Ticket, action: 'ready' | 'notReady' | 'seen') {
    setBusy(ticket.id)
    try {
      tickets.setData(await ticketsApi[action](ticket.id))
    } catch (error) {
      showToast(isAppError(error) ? error.message : "Couldn't change that. Try again.", 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 lg:text-2xl">Tickets · {area.name}</h1>
          <p className="text-sm text-neutral-600" aria-live="polite">
            {waiting.length === 0 ? 'Nothing waiting' : `${waiting.length} waiting`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={sound.toggle} aria-pressed={sound.on}>
            {sound.on ? <Volume2 className="h-4 w-4" aria-hidden="true" /> : <VolumeX className="h-4 w-4" aria-hidden="true" />}
            {sound.on ? (sound.ready ? 'Sound on' : 'Tap for sound') : 'Sound off'}
          </Button>
          <label className="flex min-h-11 items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-800">
            <input
              type="checkbox"
              checked={printNew}
              onChange={(event) => {
                setPrintNew(event.target.checked)
                writeStore(PRINT_KEY(area.id), event.target.checked ? '1' : '0')
              }}
              className="h-4 w-4"
            />
            Print each new one
          </label>
        </div>
      </div>

      {areas.length > 1 && (
        <div role="radiogroup" aria-label="Area" className="flex flex-wrap gap-2">
          {areas.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={option.id === area.id}
              onClick={() => onArea(option.id)}
              className={`min-h-10 rounded-full border px-4 text-sm font-semibold tabular-nums ${
                option.id === area.id ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 bg-white text-neutral-800'
              }`}
            >
              {option.name}
              {option.id !== area.id && option.waiting > 0 && ` · ${option.waiting}`}
            </button>
          ))}
        </div>
      )}

      {tickets.error && !tickets.data && <p className="text-sm text-danger-700">{tickets.error}</p>}
      {tickets.data && waiting.length === 0 && (
        <p className="rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-8 text-center text-sm text-neutral-600">
          New tickets for the {area.name} show here, with a sound.
        </p>
      )}
      {waiting.length > 0 && (
        <ul className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Waiting">
          {waiting.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              busy={busy === ticket.id}
              onPrint={() => setPrinting([{ ticket }])}
              onAct={(action) => void act(ticket, action)}
            />
          ))}
        </ul>
      )}
      {ready.length > 0 && (
        <section aria-label="Ready" className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-neutral-600">Ready</h2>
          <ul className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {ready.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                busy={busy === ticket.id}
                onPrint={() => setPrinting([{ ticket }])}
                onAct={(action) => void act(ticket, action)}
              />
            ))}
          </ul>
        </section>
      )}

      <div className="ticket-print" aria-hidden="true">
        {printing.map(({ ticket, dontSend }) => (
          <TicketSlip key={`${ticket.id}-${dontSend ? 'off' : 'on'}`} ticket={ticket} area={area.name} dontSendOnly={dontSend} />
        ))}
      </div>
    </>
  )
}

const KIND_HEAD: Record<Ticket['kind'], { className: string; word?: string }> = {
  NEW: { className: 'bg-primary-50 text-neutral-900' },
  ADDED: { className: 'bg-warning-50 text-warning-800', word: 'Added' },
}

function timeOf(iso: string | undefined): string {
  return iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : ''
}

function TicketCard({
  ticket,
  busy,
  onPrint,
  onAct,
}: {
  ticket: Ticket
  busy: boolean
  onPrint: () => void
  onAct: (action: 'ready' | 'notReady' | 'seen') => void
}) {
  const head = KIND_HEAD[ticket.kind]
  const isReady = !!ticket.readyAt && !ticket.changed
  const off = dontSend(ticket)
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(ticket.createdAt).getTime()) / 60_000))
  return (
    <li
      className={`overflow-hidden rounded-lg bg-white ${off ? 'border-2 border-danger-600' : 'border border-neutral-200'} ${isReady ? 'opacity-60' : ''}`}
      aria-label={`${ticket.label}${head.word ? `, ${head.word}` : ''}${off ? `, don't send ${off.names}` : ''}`}
      data-ticket={ticket.kind}
      data-changed={off ? 'true' : undefined}
    >
      <div className={`flex items-start justify-between gap-3 px-4 py-2.5 ${head.className}`}>
        <p className="min-w-0 text-lg font-bold leading-tight">
          {ticket.label}
          {head.word && <span className="ml-2 text-sm font-bold uppercase tracking-wide">{head.word}</span>}
        </p>
        <p className="shrink-0 text-right text-xs tabular-nums text-neutral-600">
          {timeOf(ticket.createdAt)}
          {ticket.createdByName && ` · ${ticket.createdByName}`}
          {isReady ? (
            <span className="block font-semibold text-neutral-700">
              {ticket.servedAt ? `served ${timeOf(ticket.servedAt)}${ticket.servedByName ? ` · ${ticket.servedByName}` : ''}` : `ready ${timeOf(ticket.readyAt)}`}
            </span>
          ) : (
            <span className={`block font-semibold ${minutes >= 20 ? 'text-danger-700' : 'text-neutral-700'}`}>
              {minutes < 1 ? 'just now' : minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60}`}
            </span>
          )}
        </p>
      </div>
      <ul className="divide-y divide-neutral-100">
        {ticketItems(ticket.lines).map((item, index) => {
          const gone = item.takenOff === 'NOT_MADE'
          return (
            <li key={index} className={`px-4 py-2 ${gone ? 'text-danger-700' : 'text-neutral-900'}`}>
              <p className="text-base">
                <span className={`font-bold tabular-nums ${gone ? 'line-through' : ''}`}>{formatNumber(item.quantity)}</span>{' '}
                <span className={gone ? 'line-through' : ''}>
                  {item.unit ? `${item.unit} ` : ''}
                  {item.withName ? `+ ${item.name}` : item.name}
                </span>
              </p>
              {item.withName && <p className="pl-6 text-sm text-neutral-600">with the {item.withName}</p>}
              {item.sides.map((side, sideIndex) => {
                const sideGone = side.takenOff === 'NOT_MADE'
                return (
                  <p key={sideIndex} className={`pl-6 text-sm ${sideGone ? 'text-danger-700 line-through' : 'text-neutral-800'}`}>
                    + {side.quantity !== 1 ? `${formatNumber(side.quantity)} ` : ''}
                    {side.name}
                    {side.note && <span className="font-bold text-warning-800"> · {side.note}</span>}
                  </p>
                )
              })}
              {item.note && <p className="pl-6 text-sm font-bold text-warning-800">{item.note}</p>}
            </li>
          )
        })}
      </ul>
      {off && (
        <div className="flex items-center justify-between gap-3 border-t border-neutral-100 bg-danger-50 px-4 py-2.5" role="alert">
          <p className="min-w-0 text-sm font-bold text-danger-700">
            Don&apos;t send {off.names}
            <span className="block text-xs font-medium">
              {timeOf(off.at)}
              {off.by && ` · ${off.by}`}
            </span>
          </p>
          <Button variant="danger" loading={busy} onClick={() => onAct('seen')}>
            OK
          </Button>
        </div>
      )}
      <div className="flex gap-2 border-t border-neutral-100 px-4 py-2.5">
        <Button variant="secondary" className="flex-1" onClick={onPrint}>
          <Printer className="h-4 w-4" aria-hidden="true" />
          Print
        </Button>
        {isReady ? (
          <Button variant="secondary" className="flex-1" loading={busy && !off} onClick={() => onAct('notReady')}>
            <Undo2 className="h-4 w-4" aria-hidden="true" />
            Not ready
          </Button>
        ) : (
          !ticket.readyAt &&
          ticket.lines.some((line) => !line.takenOff) && (
            <Button variant="action" className="flex-1" loading={busy && !off} onClick={() => onAct('ready')}>
              <Check className="h-4 w-4" aria-hidden="true" />
              Ready
            </Button>
          )
        )}
      </div>
    </li>
  )
}

/**
 * The paper copy: big table name, the area, when and who; only this area's items, no prices. {@code dontSendOnly}: the
 * short slip for a change, since paper can't change - "TABLE 5 · DON'T SEND" and what was taken off.
 */
function TicketSlip({ ticket, area, dontSendOnly = false }: { ticket: Ticket; area: string; dontSendOnly?: boolean }) {
  const head = KIND_HEAD[ticket.kind]
  if (dontSendOnly) {
    const off = ticket.lines.filter((line) => line.takenOff === 'NOT_MADE')
    const last = off.at(-1)
    return (
      <div className="ticket-slip">
        <p className="ticket-slip-big">{ticket.label.toUpperCase()} · DON&apos;T SEND</p>
        <p>
          {area.toUpperCase()} · {timeOf(last?.takenOffAt)}
          {last?.takenOffByName && ` · ${last.takenOffByName}`}
        </p>
        <hr />
        {off.map((line) => (
          <p key={line.movementId} className="ticket-slip-big">
            {formatNumber(line.quantity)} × {line.name}
          </p>
        ))}
        <p className="ticket-slip-in">(on the {timeOf(ticket.createdAt)} ticket)</p>
        <hr />
      </div>
    )
  }
  return (
    <div className="ticket-slip">
      <p className="ticket-slip-big">
        {ticket.label.toUpperCase()}
        {head.word ? ` · ${head.word.toUpperCase()}` : ''}
      </p>
      <p>
        {area.toUpperCase()} · {timeOf(ticket.createdAt)}
        {ticket.createdByName && ` · ${ticket.createdByName}`}
      </p>
      <hr />
      {ticketItems(ticket.lines).map((item, index) => {
        const gone = item.takenOff === 'NOT_MADE'
        return (
          <div key={index} className="ticket-slip-item">
            <p className="ticket-slip-big" style={gone ? { textDecoration: 'line-through' } : undefined}>
              {formatNumber(item.quantity)} × {item.unit ? `${item.unit} ` : ''}
              {item.withName ? `+ ${item.name}` : item.name}
              {gone ? " (DON'T SEND)" : ''}
            </p>
            {item.withName && <p className="ticket-slip-in">with the {item.withName}</p>}
            {item.sides.map((side, sideIndex) => (
              <p key={sideIndex} className="ticket-slip-in">
                + {side.quantity !== 1 ? `${formatNumber(side.quantity)} ` : ''}
                {side.name}
                {side.note ? ` · ${side.note}` : ''}
              </p>
            ))}
            {item.note && <p className="ticket-slip-in">** {item.note} **</p>}
          </div>
        )
      })}
      <hr />
    </div>
  )
}

/** Two short tones for a new ticket. Browsers play sound only after a tap on the page, so until then it says so. */
function useTicketSound() {
  const [on, setOn] = useState(() => readStore(SOUND_KEY) !== '0')
  const [ready, setReady] = useState(false)
  const context = useRef<AudioContext | null>(null)
  const unlock = useCallback(() => {
    try {
      context.current ??= new AudioContext()
      void context.current.resume().then(() => setReady(context.current?.state === 'running'))
    } catch {
      // No Web Audio: the tickets still come in, silently.
    }
  }, [])
  useEffect(() => {
    window.addEventListener('pointerdown', unlock)
    return () => window.removeEventListener('pointerdown', unlock)
  }, [unlock])
  const play = useCallback(() => {
    const audio = context.current
    if (!on || !audio || audio.state !== 'running') return
    ;[0, 0.22].forEach((at, index) => {
      const tone = audio.createOscillator()
      const gain = audio.createGain()
      tone.frequency.value = index === 0 ? 880 : 1175
      gain.gain.setValueAtTime(0.0001, audio.currentTime + at)
      gain.gain.exponentialRampToValueAtTime(0.4, audio.currentTime + at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + at + 0.18)
      tone.connect(gain).connect(audio.destination)
      tone.start(audio.currentTime + at)
      tone.stop(audio.currentTime + at + 0.2)
    })
  }, [on])
  const toggle = useCallback(() => {
    setOn((was) => {
      writeStore(SOUND_KEY, was ? '0' : '1')
      return !was
    })
  }, [])
  return useMemo(() => ({ on, ready, play, toggle }), [on, ready, play, toggle])
}

/** Keeps the screen from sleeping while the page is open, where the browser allows it. */
function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    let gone = false
    const take = async () => {
      try {
        if (document.visibilityState === 'visible' && 'wakeLock' in navigator) lock = await navigator.wakeLock.request('screen')
        if (gone) void lock?.release()
      } catch {
        // Not allowed here (battery saver, an old browser): the screen sleeps as usual.
      }
    }
    void take()
    const again = () => void take()
    document.addEventListener('visibilitychange', again)
    return () => {
      gone = true
      document.removeEventListener('visibilitychange', again)
      void lock?.release()
    }
  }, [])
}

/** Re-renders now and then, so "12 min" keeps up. */
function useTicker(ms: number) {
  const [, setNow] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), ms)
    return () => window.clearInterval(timer)
  }, [ms])
}
