import { Check, MessageCircle, Share, ShieldCheck } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { buttonClassName } from '@/components/Button'
import { isInstalledHere } from '@/features/onboarding/onboardingApi'
import { SendListSheet } from '@/features/onboarding/SendListSheet'
import { useOnboarding } from '@/features/onboarding/useOnboarding'
import { WHATSAPP_URL } from '@/marketing/site'
import { isIos, isStandalone, promptInstall, useServiceWorkerState } from '@/pwa/serviceWorker'
import { welcomeStorage } from '@/utils/storage'
import { displayUsername } from '@/utils/whatsappNumber'

const HIDDEN_KEY = 'pp.checklistHidden.'

function readHidden(companyId: string): boolean {
  try {
    return localStorage.getItem(HIDDEN_KEY + companyId) === '1'
  } catch {
    return false
  }
}

/**
 * The setup checklist (LANDING_PAGE_PLAN.md §4): the first thing an owner sees until their shop is
 * running, so a new shop goes from sign-up to its first count without leaving the app (except to
 * WhatsApp). Four things, in the order that makes the shop work:
 *
 * 1. Add your products: send us your list (we load it within 24 hours), import it, or add one.
 * 2. Record your first delivery or count: the moment it clicks.
 * 3. Put Procurepaddy on your phone: so it opens with no network.
 * 4. Add your staff: so every change has a name.
 *
 * Ticks come from the server (right on every phone, and the team loading the products ticks the
 * first one), except "on your phone", which only the phone knows. Owners only; staff never see it.
 * Gone once everything is done and the owner closes it, or whenever they hide it.
 */
export function SetupChecklist() {
  const { user, client } = useAuth()
  const isOwner = user?.permissions.includes(PERMISSIONS.MANAGE_USERS) === true
  const canManageProducts = user?.permissions.includes(PERMISSIONS.MANAGE_PRODUCTS) === true
  const companyId = client?.identifier ?? ''
  const [hiddenNow, setHiddenNow] = useState(false)
  const hidden = hiddenNow || readHidden(companyId)
  const { status, refetch } = useOnboarding(isOwner && !hidden)
  const { canInstall } = useServiceWorkerState()
  const [sheetOpen, setSheetOpen] = useState(false)
  const welcome = welcomeStorage.get()

  if (!isOwner || hidden || !status || !client) return null

  const installed = isInstalledHere(isStandalone())
  const steps = [status.products > 0, status.stockChanges > 0, installed, status.staff > 0]
  const done = steps.filter(Boolean).length
  const allDone = done === steps.length
  const listWaiting = status.products === 0 && status.listFiles > 0
  const login = welcome && welcome.clientIdentifier === companyId ? displayUsername(welcome.username) : null

  function hide() {
    try {
      localStorage.setItem(HIDDEN_KEY + companyId, '1')
    } catch {
      // Hidden for this visit only.
    }
    welcomeStorage.clear()
    setHiddenNow(true)
  }

  return (
    <section aria-labelledby="setup-title" className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 p-5">
        <div>
          <h2 id="setup-title" className="text-lg font-semibold text-neutral-900">
            {allDone ? 'Your shop is set up' : 'Set up your shop'}
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            {companyId && (
              <>
                Company ID <span className="font-mono font-semibold text-neutral-900">{companyId}</span>: your staff type it
                to log in.
              </>
            )}
            {login && (
              <>
                {' '}
                You log in with <span className="font-semibold text-neutral-900">{login}</span>.
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="sm:text-right">
            <p className="text-sm font-semibold text-neutral-900 tabular-nums">
              {done} of {steps.length} done
            </p>
            <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-neutral-100" aria-hidden="true">
              <div className="h-full rounded-full bg-accent-600" style={{ width: `${(done / steps.length) * 100}%` }} />
            </div>
          </div>
        </div>
      </div>

      <ol className="divide-y divide-neutral-100">
        <Step
          number={1}
          done={status.products > 0}
          title="Add your products"
          detail={
            status.products > 0
              ? `${status.products} ${status.products === 1 ? 'product' : 'products'} in.`
              : listWaiting
                ? "We have your list and we're loading it: within 24 hours. This ticks itself when they're in."
                : 'Send us your list and we load every product, pack size and opening stock within 24 hours.'
          }
        >
          {status.products === 0 && canManageProducts && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className={buttonClassName(listWaiting ? 'secondary' : 'action', 'min-h-10')}
              >
                {listWaiting ? 'Send more' : 'Send us your list'}
              </button>
              <Link to="/app/products/import" className="text-sm font-medium text-primary-600 hover:underline">
                Import Excel yourself
              </Link>
              <Link to="/app/products/new" className="text-sm font-medium text-primary-600 hover:underline">
                Add one now
              </Link>
            </div>
          )}
          {status.supportAccess === 'ON' && status.products === 0 && (
            <p className="mt-3 flex items-start gap-2 text-sm text-neutral-600">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
              Procurepaddy support is in your account to load your products. Everything it adds is signed with its name,
              and you can switch it off in Users.
            </p>
          )}
        </Step>

        <Step
          number={2}
          done={status.stockChanges > 0}
          title="Record your first delivery or count"
          detail={
            status.stockChanges > 0
              ? `${status.stockChanges} stock ${status.stockChanges === 1 ? 'change' : 'changes'} recorded.`
              : "Record today's delivery, a sale, or count one shelf. It works with no network."
          }
        >
          {status.stockChanges === 0 &&
            (status.products > 0 ? (
              <Link to="/app/quick" className={buttonClassName(steps[0] ? 'action' : 'secondary', 'min-h-10')}>
                Open quick mode
              </Link>
            ) : (
              <p className="text-sm text-neutral-500">After your products are in.</p>
            ))}
        </Step>

        <Step
          number={3}
          done={installed}
          title="Put Procurepaddy on your phone"
          detail={installed ? 'On your home screen.' : 'It opens like an app, even when there is no network.'}
        >
          {!installed &&
            (canInstall ? (
              <button type="button" onClick={() => void promptInstall()} className={buttonClassName('secondary', 'min-h-10')}>
                Install
              </button>
            ) : isIos() ? (
              <p className="flex items-start gap-2 text-sm text-neutral-700">
                <Share className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
                In Safari, tap Share, then Add to Home Screen.
              </p>
            ) : (
              <p className="text-sm text-neutral-700">
                Open this page on your phone, then in the browser menu tap Install app or Add to Home screen.
              </p>
            ))}
        </Step>

        <Step
          number={4}
          done={status.staff > 0}
          title="Add your staff"
          detail={
            status.staff > 0
              ? `${status.staff} staff ${status.staff === 1 ? 'account' : 'accounts'}.`
              : 'Each person gets their own login, so you see who recorded what, and they only do what you allow.'
          }
        >
          {status.staff === 0 && (
            <Link to="/app/users" className={buttonClassName('secondary', 'min-h-10')}>
              Add staff
            </Link>
          )}
        </Step>
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-5 py-3 text-sm">
        <a
          href={`${WHATSAPP_URL}?text=${encodeURIComponent(`Hello Procurepaddy, this is ${client.name ?? companyId} (${companyId}). I need help setting up.`)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 font-medium text-primary-600 hover:underline"
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          Stuck? WhatsApp us
        </a>
        <button type="button" onClick={hide} className="font-medium text-neutral-600 hover:text-neutral-900 hover:underline">
          {allDone ? 'Close' : 'Hide this list'}
        </button>
      </div>

      <SendListSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        sent={status.files}
        companyName={client.name ?? companyId}
        companyId={companyId}
        onSent={refetch}
      />
    </section>
  )
}

function Step({
  number,
  done,
  title,
  detail,
  children,
}: {
  number: number
  done: boolean
  title: string
  detail: string
  children?: ReactNode
}) {
  return (
    <li className="flex gap-4 px-5 py-4">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
          done ? 'bg-accent-600 text-white' : 'border border-neutral-300 text-neutral-700'
        }`}
        aria-hidden="true"
      >
        {done ? <Check className="h-4 w-4" /> : number}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className={`text-base font-semibold ${done ? 'text-neutral-600' : 'text-neutral-900'}`}>
          {title}
          <span className="sr-only">{done ? ' (done)' : ' (to do)'}</span>
        </h3>
        <p className="mt-0.5 text-sm text-neutral-600">{detail}</p>
        {children && <div className="mt-3">{children}</div>}
      </div>
    </li>
  )
}
