import { useCallback, useEffect, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { superAdminApiClient } from '@/features/admin/api/superAdminApi'
import type { DemoResetStatus, SuperAdminClientDetail } from '@/features/admin/types'
import { isAppError } from '@/types/api'

interface DemoCompanyPanelProps {
  client: SuperAdminClientDetail
  onChanged: (client: SuperAdminClientDetail) => void
  /** After a reset finishes: everything else on the page now describes data that has gone. */
  onReset: () => void
}

const POLL_MS = 2000

/** Which confirmation is open, if any. Each one opens in place - no popup. */
type Confirming = 'make' | 'reset' | 'stop' | null

/**
 * The shared demo company prospects try (API V86), on the company's page.
 *
 * Kept out of the way on purpose (owner, 2026-11-12): a demo can be reset, and a reset deletes data, so
 * nothing here is ever one click.
 * - An ordinary company shows nothing, unless it is brand new and empty (or was a demo before) - then a
 *   small link, never a banner. The server refuses every other company whatever this shows.
 * - Making it a demo, resetting it and switching demo off each need the company's code typed.
 */
export function DemoCompanyPanel({ client, onChanged, onReset }: DemoCompanyPanelProps) {
  const [status, setStatus] = useState<DemoResetStatus | null>(null)
  const [confirming, setConfirming] = useState<Confirming>(null)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<number | null>(null)
  // Held in a ref so a parent passing a fresh function each render doesn't restart the polling.
  const onResetRef = useRef(onReset)
  useEffect(() => {
    onResetRef.current = onReset
  }, [onReset])
  const isDemo = client.demo === true
  const codeTyped = typed.trim().toLowerCase() === client.slug.toLowerCase()

  const poll = useCallback(async () => {
    try {
      const next = await superAdminApiClient.demoResetStatus(client.id)
      setStatus(next)
      if (next?.state === 'RUNNING') {
        timer.current = window.setTimeout(() => void poll(), POLL_MS)
      } else if (next?.state === 'DONE') {
        onResetRef.current()
      }
    } catch {
      // A missed poll is not worth a message; try again shortly.
      timer.current = window.setTimeout(() => void poll(), POLL_MS * 2)
    }
  }, [client.id])

  useEffect(() => {
    if (!isDemo) return
    void superAdminApiClient
      .demoResetStatus(client.id)
      .then((current) => {
        setStatus(current)
        if (current?.state === 'RUNNING') void poll()
      })
      .catch(() => undefined)
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [client.id, isDemo, poll])

  function open(which: Confirming) {
    setConfirming(which)
    setTyped('')
    setError(null)
  }

  async function setDemo(demo: boolean) {
    setBusy(true)
    setError(null)
    try {
      onChanged(await superAdminApiClient.setClientDemo(client.id, demo, typed))
      open(null)
    } catch (err) {
      setError(isAppError(err) ? err.message : "Couldn't change it. Try again.")
    } finally {
      setBusy(false)
    }
  }

  async function reset() {
    setBusy(true)
    setError(null)
    try {
      setStatus(await superAdminApiClient.resetDemo(client.id, typed))
      open(null)
      void poll()
    } catch (err) {
      setError(isAppError(err) ? err.message : "Couldn't start the reset. Try again.")
    } finally {
      setBusy(false)
    }
  }

  const confirmField = (
    <div className="mt-3 max-w-sm">
      <TextField
        id="demo-confirm-code"
        label={`Type ${client.slug} to confirm`}
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        autoComplete="off"
      />
    </div>
  )

  const cancel = (
    <Button variant="quiet" onClick={() => open(null)}>
      Keep it as it is
    </Button>
  )

  if (!isDemo) {
    if (client.canBecomeDemo !== true) return null
    if (confirming !== 'make') {
      return (
        <div className="text-sm">
          <button
            type="button"
            className="font-medium text-neutral-500 underline-offset-2 hover:text-neutral-700 hover:underline"
            onClick={() => open('make')}
          >
            Make this a demo company…
          </button>
        </div>
      )
    }
    return (
      <section className="rounded-lg border border-warning-200 bg-warning-50 p-4">
        <h2 className="text-base font-semibold text-neutral-900">Make {client.name} a demo company?</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
          <li>Only for a company you signed up yourself for prospects to try. Never for a customer.</li>
          <li>
            A demo can be reset. A reset deletes all of its products, stock, suppliers, branches and orders to
            suppliers, and fills it with sample data.
          </li>
          <li>Nothing leaves a demo: no emails to suppliers, no marketplace orders, no payments.</li>
        </ul>
        {confirmField}
        {error && <p className="mt-2 text-sm text-danger-700">{error}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="danger" loading={busy} disabled={!codeTyped} onClick={() => void setDemo(true)}>
            Make it a demo company
          </Button>
          {cancel}
        </div>
      </section>
    )
  }

  const running = status?.state === 'RUNNING'

  return (
    <section className="rounded-lg border border-primary-200 bg-primary-50/40 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">Demo company</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Prospects share this company. Nothing leaves it: no emails to suppliers, no orders, no payments. People
            can change only the users they added themselves.
          </p>
        </div>
        {confirming === null && !running && (
          <Button variant="secondary" className="shrink-0 whitespace-nowrap" onClick={() => open('reset')}>
            <RotateCcw className="h-4 w-4" />
            Reset demo
          </Button>
        )}
      </div>

      {confirming === 'reset' && (
        <div className="mt-4 rounded-md border border-neutral-200 bg-white p-4">
          <p className="text-sm font-medium text-neutral-900">Reset {client.name} to a fresh restaurant?</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-600">
            <li>
              Deleted and made again: products, pictures, suppliers, branches, areas, stock and all its history, and
              orders to suppliers.
            </li>
            <li>Comes back with 90 days of a busy kitchen, ending today.</li>
            <li>Kept: everyone&apos;s login and password, roles, and which branch each person works at.</li>
          </ul>
          {confirmField}
          {error && <p className="mt-2 text-sm text-danger-700">{error}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="danger" loading={busy} disabled={!codeTyped} onClick={() => void reset()}>
              Reset demo
            </Button>
            {cancel}
          </div>
        </div>
      )}

      {confirming === 'stop' && (
        <div className="mt-4 rounded-md border border-neutral-200 bg-white p-4">
          <p className="text-sm font-medium text-neutral-900">Make {client.name} an ordinary company again?</p>
          <p className="mt-2 text-sm text-neutral-600">
            Its emails, orders and payments start going out like any company&apos;s, and people using it can change each
            other&apos;s accounts. Its data stays as it is, and it can be made a demo again later.
          </p>
          {confirmField}
          {error && <p className="mt-2 text-sm text-danger-700">{error}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="danger" loading={busy} disabled={!codeTyped} onClick={() => void setDemo(false)}>
              Stop being a demo
            </Button>
            {cancel}
          </div>
        </div>
      )}

      {status && (
        <div className="mt-4 text-sm" aria-live="polite">
          {status.state === 'RUNNING' && (
            <p className="text-neutral-700">
              Resetting: {status.step}. This takes a few minutes; you can leave this page.
            </p>
          )}
          {status.state === 'DONE' && status.result && (
            <p className="text-success-700">
              Reset {status.finishedAt ? new Date(status.finishedAt).toLocaleString() : ''}: {status.result.products}{' '}
              products ({status.result.pictures} with pictures), {status.result.suppliers} suppliers,{' '}
              {status.result.movements.toLocaleString()} stock records, {status.result.transfers} transfers and{' '}
              {status.result.purchaseOrders} open orders to suppliers.
            </p>
          )}
          {status.state === 'FAILED' && <p className="text-danger-700">{status.problem}</p>}
        </div>
      )}

      {confirming === null && !running && (
        <div className="mt-4 border-t border-primary-100 pt-3">
          <button
            type="button"
            className="text-sm font-medium text-neutral-500 underline-offset-2 hover:text-neutral-700 hover:underline"
            onClick={() => open('stop')}
          >
            Stop being a demo…
          </button>
        </div>
      )}
    </section>
  )
}
