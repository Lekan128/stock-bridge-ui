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

/**
 * The shared demo company prospects try (API V86), on the company's page. Opens in place - no popup:
 * marking a company as the demo, and "Reset demo", which wipes it and fills it again with a fresh 90 days.
 * The reset is typed to confirm, like Clear catalog, and runs on the server for a few minutes; this
 * shows how far it has got.
 */
export function DemoCompanyPanel({ client, onChanged, onReset }: DemoCompanyPanelProps) {
  const [status, setStatus] = useState<DemoResetStatus | null>(null)
  const [confirm, setConfirm] = useState('')
  const [resetOpen, setResetOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<number | null>(null)
  // Held in a ref so a parent passing a fresh function each render doesn't restart the polling.
  const onResetRef = useRef(onReset)
  useEffect(() => {
    onResetRef.current = onReset
  }, [onReset])
  const isDemo = client.demo === true

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

  async function setDemo(demo: boolean) {
    setBusy(true)
    setError(null)
    try {
      onChanged(await superAdminApiClient.setClientDemo(client.id, demo))
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
      setStatus(await superAdminApiClient.resetDemo(client.id, confirm))
      setResetOpen(false)
      setConfirm('')
      void poll()
    } catch (err) {
      setError(isAppError(err) ? err.message : "Couldn't start the reset. Try again.")
    } finally {
      setBusy(false)
    }
  }

  const running = status?.state === 'RUNNING'

  if (!isDemo) {
    return (
      <section className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="text-base font-semibold text-neutral-900">Demo company</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Make {client.name} the shared demo for prospects. Nothing leaves a demo: no emails to suppliers, no
          marketplace orders, no payments. Its numbers are left out of the platform totals, and you can reset it to a
          fresh restaurant whenever you like.
        </p>
        {error && <p className="mt-2 text-sm text-danger-700">{error}</p>}
        <div className="mt-3">
          <Button variant="secondary" loading={busy} onClick={() => void setDemo(true)}>
            Make it the demo
          </Button>
        </div>
      </section>
    )
  }

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
        {!resetOpen && !running && (
          <Button variant="secondary" className="shrink-0 whitespace-nowrap" onClick={() => setResetOpen(true)}>
            <RotateCcw className="h-4 w-4" />
            Reset demo
          </Button>
        )}
      </div>

      {resetOpen && (
        <div className="mt-4 rounded-md border border-neutral-200 bg-white p-4">
          <p className="text-sm font-medium text-neutral-900">Reset {client.name} to a fresh restaurant?</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-600">
            <li>
              Removed and made again: products, pictures, suppliers, branches, areas, stock and all its history, and
              orders to suppliers.
            </li>
            <li>Comes back with 90 days of a busy kitchen, ending today.</li>
            <li>Kept: everyone&apos;s login and password, roles, and which branch each person works at.</li>
          </ul>
          <div className="mt-3 max-w-sm">
            <TextField
              id="demo-reset-confirm"
              label={`Type ${client.slug} to confirm`}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="off"
            />
          </div>
          {error && <p className="mt-2 text-sm text-danger-700">{error}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="danger"
              loading={busy}
              disabled={confirm.trim().toLowerCase() !== client.slug.toLowerCase()}
              onClick={() => void reset()}
            >
              Reset demo
            </Button>
            <Button
              variant="quiet"
              onClick={() => {
                setResetOpen(false)
                setConfirm('')
                setError(null)
              }}
            >
              Keep it as it is
            </Button>
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

      {!resetOpen && !running && (
        <div className="mt-4 border-t border-primary-100 pt-3">
          {error && <p className="mb-2 text-sm text-danger-700">{error}</p>}
          <Button variant="quiet" loading={busy} onClick={() => void setDemo(false)}>
            Stop being a demo
          </Button>
        </div>
      )}
    </section>
  )
}
