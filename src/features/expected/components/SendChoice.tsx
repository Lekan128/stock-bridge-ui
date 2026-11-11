import { expectedCopy } from '@/features/expected/copy'
import { InlineEmailEditor } from '@/features/expected/components/InlineEmailEditor'
import type { SendWay } from '@/features/expected/sendWay'
import type { CompanyVendor } from '@/features/vendors/types'

const text = expectedCopy.form


export interface SendChoiceProps {
  vendor: CompanyVendor
  value: SendWay
  onChange: (way: SendWay) => void
  /** The supplier's email may be added or fixed from here (MANAGE_VENDORS, and not a supplier on Procure Paddy). */
  canEditEmail: boolean
  editingEmail: boolean
  onEditingEmailChange: (editing: boolean) => void
  onVendorUpdated: (vendor: CompanyVendor) => void
  disabled?: boolean
}

/**
 * The way a supplier is given this order, picked before the button (redesign 2026-11-04). It
 * replaces the email switch, the "What happens next" box and the "Already ordered by phone?" link
 * with one question whose answers make sense from their titles alone. The button below repeats the
 * answer, so what pressing it does is never in small print.
 *
 * A way that can't work for this supplier isn't offered: no phone, no WhatsApp; no email, a line
 * saying how to add one instead.
 */
export function SendChoice(props: SendChoiceProps) {
  const { vendor, value, onChange, canEditEmail, editingEmail, onEditingEmailChange, onVendorUpdated, disabled } = props
  const phone = (vendor.contactPhone ?? '').trim()
  const email = (vendor.email ?? '').trim()

  const ways: { way: SendWay; title: string; hint: React.ReactNode }[] = []
  if (phone) ways.push({ way: 'WHATSAPP', title: text.viaWhatsApp, hint: text.viaWhatsAppHint(phone) })
  if (email) {
    ways.push({
      way: 'EMAIL',
      title: text.viaEmail,
      hint: (
        <>
          {text.viaEmailHint(email)}
          {canEditEmail && (
            <>
              {' · '}
              <button
                type="button"
                disabled={disabled}
                onClick={(event) => {
                  event.preventDefault()
                  onEditingEmailChange(true)
                }}
                className="rounded-sm font-medium text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
              >
                {text.change}
              </button>
            </>
          )}
        </>
      ),
    })
  }
  ways.push({ way: 'SELF', title: text.viaSelf, hint: text.viaSelfHint })
  ways.push({ way: 'PHONE', title: text.viaPhone, hint: text.viaPhoneHint })

  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="mb-2 text-sm font-semibold text-neutral-900">{text.sendHeading(vendor.name)}</legend>
      <div className="flex flex-col divide-y divide-neutral-100 overflow-hidden rounded-lg border border-neutral-200 bg-white">
        {ways.map(({ way, title, hint }) => {
          const on = value === way
          return (
            <label
              key={way}
              className={`grid cursor-pointer grid-cols-[1.25rem_1fr] items-start gap-x-3 px-4 py-3 ${on ? 'bg-primary-50' : 'hover:bg-neutral-50'}`}
            >
              <input
                type="radio"
                name="po-send-way"
                value={way}
                checked={on}
                onChange={() => onChange(way)}
                className="mt-0.5 h-4 w-4 accent-primary-900"
              />
              <span className="text-sm font-semibold text-neutral-900">{title}</span>
              <span className="col-start-2 text-xs break-words text-neutral-600">{hint}</span>
            </label>
          )
        })}
      </div>
      {editingEmail ? (
        <InlineEmailEditor
          vendor={vendor}
          onSaved={(updated) => {
            onVendorUpdated(updated)
            onEditingEmailChange(false)
          }}
          onCancel={() => onEditingEmailChange(false)}
        />
      ) : (
        !email &&
        canEditEmail && (
          <p className="text-sm text-neutral-600">
            {text.addEmailToSend(vendor.name)}{' '}
            <button
              type="button"
              onClick={() => onEditingEmailChange(true)}
              className="rounded-sm font-medium text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
              {text.addEmail}
            </button>
          </p>
        )
      )}
    </fieldset>
  )
}
