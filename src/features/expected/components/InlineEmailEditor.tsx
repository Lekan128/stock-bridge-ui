import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { expectedCopy } from '@/features/expected/copy'
import { vendorsApi } from '@/features/vendors/api/vendorsApi'
import type { CompanyVendor } from '@/features/vendors/types'
import { isAppError } from '@/types/api'

const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/

export interface InlineEmailEditorProps {
  vendor: CompanyVendor
  /** The directory row after the email was saved. */
  onSaved: (vendor: CompanyVendor) => void
  onCancel: () => void
}

/**
 * One field for a supplier's email address, opened in place — add one, change one, or fix one that
 * bounced. In place and not a sheet because it is a single field (`DESIGN.md`: renaming one thing
 * in its own row may stay inline), and because the person is in the middle of something and
 * should not lose their place.
 *
 * Enter saves this field and nothing else — it must not submit the order behind it. Escape backs out.
 */
export function InlineEmailEditor({ vendor, onSaved, onCancel }: InlineEmailEditorProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(vendor.email ?? '')
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  // Typing can start at once: focus lands in the field the moment it opens.
  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  async function save() {
    const next = draft.trim()
    if (!LOOKS_LIKE_EMAIL.test(next)) {
      setProblem(expectedCopy.contact.emailInvalid)
      return
    }
    if (next.toLowerCase() === (vendor.email ?? '').toLowerCase()) {
      onCancel()
      return
    }
    setSaving(true)
    setProblem(null)
    try {
      onSaved(await vendorsApi.setEmail(vendor.id, next))
    } catch (err: unknown) {
      // A refusal of the address itself is said in our words, never the server's field names.
      setProblem(
        isAppError(err)
          ? err.status === 400 || err.status === 422
            ? expectedCopy.contact.emailInvalid
            : err.message
          : expectedCopy.contact.emailSaveFailed,
      )
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="sr-only">
        {expectedCopy.contact.emailField}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          id={inputId}
          type="email"
          inputMode="email"
          autoComplete="off"
          value={draft}
          disabled={saving}
          placeholder={expectedCopy.contact.emailPlaceholder}
          aria-invalid={problem != null || undefined}
          aria-describedby={`${inputId}-help`}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void save()
            } else if (event.key === 'Escape') {
              event.stopPropagation()
              onCancel()
            }
          }}
          className="min-w-0 flex-1 rounded-md border border-neutral-200 px-3 py-2 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none sm:text-sm"
        />
        <Button variant="secondary" loading={saving} onClick={() => void save()}>
          {saving ? expectedCopy.contact.saving : expectedCopy.contact.saveEmail}
        </Button>
        <Button variant="quiet" disabled={saving} onClick={onCancel}>
          {expectedCopy.contact.cancelEmail}
        </Button>
      </div>
      <p
        id={`${inputId}-help`}
        className={`text-xs ${problem ? 'text-danger-700' : 'text-neutral-500'}`}
        role={problem ? 'alert' : undefined}
      >
        {problem ?? expectedCopy.contact.emailHelp(vendor.name)}
      </p>
    </div>
  )
}
