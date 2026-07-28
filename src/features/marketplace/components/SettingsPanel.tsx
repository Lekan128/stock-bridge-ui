import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Megaphone, Truck, Wallet } from 'lucide-react'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { Modal } from '@/components/Modal'
import { Skeleton } from '@/components/Skeleton'
import { TextField } from '@/components/TextField'
import { useToast } from '@/components/useToast'
import { marketplaceAdminApi } from '@/features/marketplace/api/marketplaceAdminApi'
import { QueryErrorState } from '@/features/marketplace/components/QueryErrorState'
import { formatDateTime } from '@/features/marketplace/formatters'
import {
  marketplaceSettingsSchema,
  toSettingsPayload,
  type MarketplaceSettingsFormValues,
} from '@/features/marketplace/schemas'
import type { AdminMarketplaceSettings } from '@/features/marketplace/types'
import { isAppError } from '@/types/api'
import { formatNaira, formatNairaWhole } from '@/utils/money'

export interface SettingsPanelProps {
  settings: AdminMarketplaceSettings | null
  setSettings: (settings: AdminMarketplaceSettings) => void
  loading: boolean
  error: string | null
  refetch: () => void
}

/** Money arrives as a number and is edited as a string; `2500` must render as `2500`, not `2500.00`. */
function toMoneyInput(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '0'
  return String(value)
}

function toFormValues(settings: AdminMarketplaceSettings): MarketplaceSettingsFormValues {
  return {
    deliveryFee: toMoneyInput(settings.deliveryFee),
    freeDeliveryThreshold: toMoneyInput(settings.freeDeliveryThreshold),
    minimumOrderValue: toMoneyInput(settings.minimumOrderValue),
    payOnDeliveryEnabled: settings.payOnDeliveryEnabled,
    payOnDeliveryMaxOrderValue: toMoneyInput(settings.payOnDeliveryMaxOrderValue),
    supportPhone: settings.supportPhone ?? '',
    supportEmail: settings.supportEmail ?? '',
  }
}

/**
 * ProcurePal's live commercial rules.
 *
 * This is the one screen in the module where a careless save changes what every customer pays, so
 * it does three things ordinary forms do not: it states that up front, it renders the rules back
 * as the sentences a buyer would experience ("orders over ₦150,000 ship free"), and it puts a
 * confirm step listing exactly what is changing between the form and what is live.
 *
 * The PUT is a **full replacement**, not a patch — `toSettingsPayload` always sends all seven
 * fields, which is also why the form is seeded from the server's own response.
 */
export function SettingsPanel({ settings, setSettings, loading, error, refetch }: SettingsPanelProps) {
  const { showToast } = useToast()
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState<MarketplaceSettingsFormValues | null>(null)
  const [saving, setSaving] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<MarketplaceSettingsFormValues>({
    resolver: zodResolver(marketplaceSettingsSchema),
    // `values` (not defaultValues) so the form re-seeds when the settings finish loading, and
    // again from the PUT response after a save.
    values: settings ? toFormValues(settings) : undefined,
  })

  const deliveryFee = Number(watch('deliveryFee'))
  const freeThreshold = Number(watch('freeDeliveryThreshold'))
  const minimumOrder = Number(watch('minimumOrderValue'))
  const codEnabled = watch('payOnDeliveryEnabled')
  const codMax = Number(watch('payOnDeliveryMaxOrderValue'))

  async function save(values: MarketplaceSettingsFormValues) {
    setSaving(true)
    setFormError(null)
    try {
      const updated = await marketplaceAdminApi.updateSettings(toSettingsPayload(values))
      setSettings(updated)
      reset(toFormValues(updated))
      setPending(null)
      showToast('Marketplace settings updated — the storefront is using them now.', 'success')
    } catch (err: unknown) {
      setPending(null)
      setFormError(isAppError(err) ? err.message : 'Those settings could not be saved. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-56" />
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-lg border border-neutral-200 bg-white p-4">
            <Skeleton className="h-4 w-40" />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error || !settings) {
    return (
      <QueryErrorState
        title="Marketplace settings could not be loaded"
        message={error ?? 'The settings are unavailable.'}
        onRetry={refetch}
      />
    )
  }

  const changes = pending ? describeChanges(settings, pending) : []

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">Commercial settings</h2>
        <p className="mt-1 text-sm text-neutral-500">
          These are live. Saving changes what every customer is charged at checkout, immediately.
          {settings.updatedAt && ` Last changed ${formatDateTime(settings.updatedAt)}.`}
        </p>
      </div>

      <form onSubmit={handleSubmit((values) => setPending(values))} noValidate className="flex flex-col gap-4">
        <section className="rounded-lg border border-neutral-200 bg-white p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <Truck className="h-4 w-4 text-neutral-400" aria-hidden="true" />
            Delivery and order value
          </h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <TextField
              label="Delivery fee (₦)"
              inputMode="decimal"
              error={errors.deliveryFee?.message}
              {...register('deliveryFee')}
            />
            <TextField
              label="Free delivery from (₦)"
              inputMode="decimal"
              error={errors.freeDeliveryThreshold?.message}
              {...register('freeDeliveryThreshold')}
            />
            <TextField
              label="Minimum order value (₦)"
              inputMode="decimal"
              hint="0 means no minimum"
              error={errors.minimumOrderValue?.message}
              {...register('minimumOrderValue')}
            />
          </div>
          <p className="mt-3 rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
            A buyer{minimumOrder > 0 ? ` must spend at least ${formatNairaWhole(minimumOrder)} and` : ''} pays{' '}
            {deliveryFee > 0 ? formatNaira(deliveryFee) : 'nothing'} for delivery
            {freeThreshold > 0 ? `, free once the basket reaches ${formatNairaWhole(freeThreshold)}` : ''}.
          </p>
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <Wallet className="h-4 w-4 text-neutral-400" aria-hidden="true" />
            Pay on delivery
          </h3>
          <label className="mt-4 flex items-start gap-2.5">
            <input
              type="checkbox"
              {...register('payOnDeliveryEnabled')}
              className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
            />
            <span>
              <span className="block text-sm font-medium text-neutral-700">Offer pay on delivery at checkout</span>
              <span className="block text-xs text-neutral-500">
                Only companies whose payment terms allow it will see the option.
              </span>
            </span>
          </label>
          <div className="mt-4 sm:max-w-xs">
            <TextField
              label="Maximum order value for pay on delivery (₦)"
              inputMode="decimal"
              disabled={!codEnabled}
              hint={codEnabled ? 'Bigger orders must be paid up front.' : 'Enable pay on delivery to set a limit.'}
              error={errors.payOnDeliveryMaxOrderValue?.message}
              {...register('payOnDeliveryMaxOrderValue')}
            />
          </div>
          <p className="mt-3 rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
            {codEnabled
              ? `Eligible customers can pay on delivery for orders up to ${formatNairaWhole(codMax)}.`
              : 'Every customer must pay online before ProcurePal ships.'}
          </p>
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <Megaphone className="h-4 w-4 text-neutral-400" aria-hidden="true" />
            Support contact
          </h3>
          <p className="mt-1 text-xs text-neutral-500">Shown in the storefront footer and on order pages.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TextField label="Support phone" type="tel" error={errors.supportPhone?.message} {...register('supportPhone')} />
            <TextField
              label="Support email"
              type="email"
              error={errors.supportEmail?.message}
              {...register('supportEmail')}
            />
          </div>
        </section>

        <FormError message={formError} />

        <div className="flex flex-wrap items-center justify-end gap-2">
          {isDirty && (
            <Button variant="secondary" onClick={() => reset(toFormValues(settings))}>
              Discard changes
            </Button>
          )}
          <Button
            type="submit"
            disabled={!isDirty}
            title={isDirty ? undefined : 'Nothing has changed yet'}
          >
            Review and save
          </Button>
        </div>
      </form>

      {/* A bespoke review step rather than `ConfirmDialog`: the whole point is the itemised list of
          what is about to change, and a one-line message could not carry it. */}
      {pending && (
        <Modal
          open
          onClose={() => setPending(null)}
          title="Save commercial settings?"
          size="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setPending(null)} disabled={saving}>
                Keep editing
              </Button>
              <Button loading={saving} onClick={() => void save(pending)}>
                Save settings
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <p className="text-sm text-neutral-600">
              This takes effect immediately — the next customer to reach checkout is charged on these rules.
            </p>
            {changes.length > 0 ? (
              <ul className="flex flex-col gap-1.5 rounded-md border border-warning-200 bg-warning-50 px-3 py-2 text-sm text-warning-900">
                {changes.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-neutral-500">
                Nothing appears to have changed, but the settings will be written again.
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

/** A plain-language diff for the confirm step: what is live now, and what it becomes. */
function describeChanges(current: AdminMarketplaceSettings, next: MarketplaceSettingsFormValues): string[] {
  const changes: string[] = []

  const money: { label: string; from: number; to: number }[] = [
    { label: 'Delivery fee', from: current.deliveryFee, to: Number(next.deliveryFee) },
    { label: 'Free delivery from', from: current.freeDeliveryThreshold, to: Number(next.freeDeliveryThreshold) },
    { label: 'Minimum order value', from: current.minimumOrderValue, to: Number(next.minimumOrderValue) },
    {
      label: 'Pay-on-delivery limit',
      from: current.payOnDeliveryMaxOrderValue,
      to: Number(next.payOnDeliveryMaxOrderValue),
    },
  ]

  for (const field of money) {
    if (field.from !== field.to) {
      changes.push(`• ${field.label}: ${formatNaira(field.from)} → ${formatNaira(field.to)}`)
    }
  }

  if (current.payOnDeliveryEnabled !== next.payOnDeliveryEnabled) {
    changes.push(`• Pay on delivery: ${next.payOnDeliveryEnabled ? 'turned on' : 'turned off for everyone'}`)
  }
  if ((current.supportPhone ?? '') !== next.supportPhone) {
    changes.push(`• Support phone: ${next.supportPhone || 'removed'}`)
  }
  if ((current.supportEmail ?? '') !== next.supportEmail) {
    changes.push(`• Support email: ${next.supportEmail || 'removed'}`)
  }

  return changes
}
