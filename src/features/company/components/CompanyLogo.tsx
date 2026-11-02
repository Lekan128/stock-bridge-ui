import { useRef, useState } from 'react'
import { companyApi } from '@/features/company/api/companyApi'
import type { Company } from '@/features/company/types'
import { isAppError } from '@/types/api'

interface CompanyLogoProps {
  company: Company
  /** MANAGE_COMPANY_PROFILE. Everyone else just sees the logo. */
  canEdit: boolean
  onUpdated: (company: Company) => void
}

/**
 * The company's logo, top right of Company settings (PURCHASE_ORDER_PLAN.md section 3.6).
 *
 * One click on the square opens the device's own file picker; the moment a file is chosen it is
 * uploaded and shown. No Save button, no dialog of ours. "Change" and "Remove" are plain links
 * under it. With no logo it is a dashed square holding the company's first letter.
 */
export function CompanyLogo({ company, canEdit, onUpdated }: CompanyLogoProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'problem' } | null>(null)
  const hasLogo = company.logoUrl != null

  async function run(action: () => Promise<Company>, done: string) {
    setBusy(true)
    setMessage(null)
    try {
      onUpdated(await action())
      setMessage({ text: done, tone: 'ok' })
    } catch (err) {
      setMessage({
        text: isAppError(err) ? err.message : "We couldn't save that. Try again.",
        tone: 'problem',
      })
    } finally {
      setBusy(false)
    }
  }

  function handleChosen(file: File | undefined) {
    if (!file) return
    void run(() => companyApi.setLogo(file), 'Saved')
    // So choosing the same file again still counts as a choice.
    if (inputRef.current) inputRef.current.value = ''
  }

  const square = hasLogo ? (
    <img
      src={company.logoUrl ?? undefined}
      alt={`${company.name} logo`}
      className="h-full w-full object-contain"
    />
  ) : (
    <span aria-hidden className="text-2xl font-semibold text-neutral-400">
      {company.name.trim().charAt(0).toUpperCase()}
    </span>
  )

  const squareClass =
    'flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl bg-white ' +
    (hasLogo ? 'border border-neutral-200' : 'border border-dashed border-neutral-300')

  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      {canEdit ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-label={hasLogo ? 'Change your logo' : 'Add your logo'}
          className={`${squareClass} hover:border-neutral-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-60`}
        >
          {square}
        </button>
      ) : (
        <div className={squareClass}>{square}</div>
      )}

      {canEdit && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => handleChosen(event.target.files?.[0])}
          />
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="text-primary-700 hover:underline disabled:opacity-60"
            >
              {hasLogo ? 'Change' : 'Add logo'}
            </button>
            {hasLogo && (
              <button
                type="button"
                onClick={() => void run(() => companyApi.removeLogo(), 'Removed')}
                disabled={busy}
                className="text-neutral-600 hover:underline disabled:opacity-60"
              >
                Remove
              </button>
            )}
          </div>
          <p
            role="status"
            className={`min-h-4 max-w-40 text-center text-xs ${
              message?.tone === 'problem' ? 'text-red-700' : 'text-neutral-500'
            }`}
          >
            {busy ? 'Saving…' : message?.text}
          </p>
        </>
      )}
    </div>
  )
}
