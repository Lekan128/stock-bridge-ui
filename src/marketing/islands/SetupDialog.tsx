import { useEffect, useRef, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { buttonClassName } from '@/components/Button'
import { requestSetup, type SetupRequestResult } from '@/marketing/api'
import { track } from '@/marketing/analytics'
import { formatWeek } from '@/marketing/offer'
import { WHATSAPP_NUMBER, WHATSAPP_URL } from '@/marketing/site'
import { OPEN_SETUP_EVENT, SETUP_READY_EVENT } from '@/marketing/islands/Island'

/**
 * The page's one action (conversion rule 4): two fields, and that alone books the setup. The
 * account comes after. A native <dialog>, so focus is held inside it, Escape closes it, and the page
 * behind is inert, with almost no code. Every "Get my free setup" opens it (`../main.tsx`).
 */
export function SetupDialog({ source = 'landing' }: { source?: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const firstField = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [booked, setBooked] = useState<(SetupRequestResult & { businessName: string; whatsapp: string }) | null>(null)
  // Fixed, not useId: an island hydrates on its own, so a generated id wouldn't match the page's.
  const id = 'setup'

  useEffect(() => {
    const open = () => {
      dialog.current?.showModal()
      firstField.current?.focus()
    }
    window.addEventListener(OPEN_SETUP_EVENT, open)
    ;(window as Window & { ppSetupReady?: boolean }).ppSetupReady = true
    window.dispatchEvent(new Event(SETUP_READY_EVENT))
    return () => window.removeEventListener(OPEN_SETUP_EVENT, open)
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const businessName = String(form.get('businessName') ?? '').trim()
    const whatsapp = String(form.get('whatsapp') ?? '').trim()
    setError(null)
    setBusy(true)
    try {
      const result = await requestSetup({ businessName, whatsapp, source, website: String(form.get('website') ?? '') })
      setBooked({ ...result, businessName, whatsapp })
      track('setup_requested', { founding: result.founding, alreadyRequested: result.alreadyRequested, source })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const signupHref = booked
    ? `/signup?${new URLSearchParams({
        setup: booked.id,
        business: booked.businessName,
        whatsapp: booked.whatsapp,
        ...(booked.founding ? { offer: 'founding' } : {}),
      })}`
    : '/signup'

  return (
    <dialog
      ref={dialog}
      aria-labelledby={`${id}-title`}
      className="m-auto w-[min(100%-2rem,28rem)] rounded-lg border border-neutral-200 bg-white p-0 text-neutral-900 shadow-paper backdrop:bg-neutral-900/50"
    >
      <div className="flex flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id={`${id}-title`} className="text-xl font-semibold text-balance">
            {booked ? (booked.alreadyRequested ? "You're already booked in." : "You're booked in.") : 'Get your free setup'}
          </h2>
          <form method="dialog">
            <button className="-m-2 rounded-md p-2 text-neutral-500 hover:bg-neutral-100" aria-label="Close">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </form>
        </div>

        {booked ? (
          <div className="flex flex-col gap-4">
            <p className="text-neutral-700">
              {booked.founding
                ? `Your founding setup is booked for the week of ${formatWeek(booked.setupWeekStarts)}.`
                : 'The founding places are taken, but we will still help you set up on the regular plan.'}{' '}
              We&apos;ll message you on WhatsApp within 5 minutes (8am to 6pm, Monday to Saturday) to collect your product
              list.
            </p>
            <a href={signupHref} className={buttonClassName('action', 'min-h-12 w-full text-base')}>
              Create your password
            </a>
            <a
              href={`${WHATSAPP_URL}?text=${encodeURIComponent(`Hello Procurepaddy, this is ${booked.businessName}. Here is my product list.`)}`}
              className="text-center text-sm font-medium text-primary-600 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Send your product list on WhatsApp now
            </a>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <p className="text-neutral-700">
              Two things, and your setup is booked. We load your products and count your first shelf with you.
            </p>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-neutral-800">Business name</span>
              <input
                ref={firstField}
                name="businessName"
                required
                maxLength={120}
                autoComplete="organization"
                className="min-h-12 rounded-md border border-neutral-300 px-3 text-base focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-neutral-800">WhatsApp number</span>
              <input
                name="whatsapp"
                required
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="0803 123 4567"
                aria-describedby={`${id}-whatsapp-hint`}
                className="min-h-12 rounded-md border border-neutral-300 px-3 text-base focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
              />
              <span id={`${id}-whatsapp-hint`} className="text-sm text-neutral-600">
                We message you here to collect your product list.
              </span>
            </label>
            {/* For bots only: people never see it, and a request that fills it is dropped. */}
            <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0" />
            {error && (
              <p role="alert" className="text-sm text-danger-700">
                {error}
              </p>
            )}
            <button type="submit" disabled={busy} className={buttonClassName('action', 'min-h-12 w-full text-base')}>
              {busy ? 'Booking…' : 'Book my setup'}
            </button>
            <p className="text-center text-sm text-neutral-600">
              No card, no password yet. Questions? WhatsApp{' '}
              <a href={WHATSAPP_URL} className="font-medium text-primary-600 hover:underline" target="_blank" rel="noreferrer">
                {WHATSAPP_NUMBER}
              </a>
            </p>
          </form>
        )}
      </div>
    </dialog>
  )
}
