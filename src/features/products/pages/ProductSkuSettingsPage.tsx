import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/Button'
import { ErrorState } from '@/components/ErrorState'
import { FormError } from '@/components/FormError'
import { Spinner } from '@/components/Spinner'
import { TextField } from '@/components/TextField'
import { useToast } from '@/components/useToast'
import { productsApi } from '@/features/products/api/productsApi'
import { useProductSkuSettings } from '@/features/products/hooks/useProductSkuSettings'
import {
  composeSimplePattern,
  hasSequenceToken,
  parseAsSimple,
  renderExample,
} from '@/features/products/skuPattern'
import type { SkuResetCadence } from '@/features/products/types'
import { isAppError } from '@/types/api'

type Tab = 'simple' | 'advanced'

const SEPARATOR_OPTIONS: { value: string; label: string }[] = [
  { value: '-', label: 'Dash (-)' },
  { value: '_', label: 'Underscore (_)' },
  { value: '.', label: 'Dot (.)' },
  { value: '/', label: 'Slash (/)' },
  { value: '', label: 'None' },
]

const CADENCE_OPTIONS: { value: SkuResetCadence; label: string }[] = [
  { value: 'NEVER', label: 'Never — the number only ever goes up' },
  { value: 'YEARLY', label: 'Yearly — starts over at 1 every January' },
  { value: 'MONTHLY', label: 'Monthly — starts over at 1 every month' },
]

const DEFAULT_PREFIX = 'PROD'
const DEFAULT_SEPARATOR = '-'
const DEFAULT_DIGITS = 4

/**
 * Automatic SKU generation, route-gated on MANAGE_PRODUCTS (router.tsx) — same authority as
 * creating or editing a product, not a read concern every role shares.
 *
 * Both tabs write the SAME `pattern` string — there is no separate stored "mode" on the wire (see
 * `ProductSkuSettings`'s doc comment). Which tab opens on load is derived, every time, by
 * pattern-matching the loaded string against Simple's shape (`parseAsSimple`): a pattern Simple
 * could have produced opens on Simple, pre-filled from its parts; anything else (a date or
 * `{NAME:N}` token) opens on Advanced with Simple hidden for the session — never a lossy attempt
 * to force it back into Simple's shape.
 */
export function ProductSkuSettingsPage() {
  const { settings, setSettings, loading, error, refetch } = useProductSkuSettings()
  const { showToast } = useToast()

  const [initialized, setInitialized] = useState(false)
  const [tab, setTab] = useState<Tab>('simple')
  const [simpleAvailable, setSimpleAvailable] = useState(true)

  const [enabled, setEnabled] = useState(false)
  const [pattern, setPattern] = useState('')
  const [resetCadence, setResetCadence] = useState<SkuResetCadence>('NEVER')

  const [prefix, setPrefix] = useState(DEFAULT_PREFIX)
  const [separator, setSeparator] = useState(DEFAULT_SEPARATOR)
  const [digits, setDigits] = useState(DEFAULT_DIGITS)

  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Seed local editor state from the loaded settings exactly once — every field below is then
  // this page's own state, not a re-render of the fetched response, so typing doesn't fight a
  // hook that re-derives on every keystroke.
  useEffect(() => {
    if (!settings || initialized) return
    setEnabled(settings.enabled)
    setResetCadence(settings.resetCadence)

    // A tenant that has never configured this gets the implicit default ('') — start them on a
    // sensible Simple pattern rather than an empty, unsaveable one (the server requires a
    // {SEQ:N} token whether the toggle is on or off — see SkuPatternValidator).
    const parts = settings.pattern ? parseAsSimple(settings.pattern) : null
    if (settings.pattern === '') {
      setPattern(composeSimplePattern(DEFAULT_PREFIX, DEFAULT_SEPARATOR, DEFAULT_DIGITS))
      setTab('simple')
      setSimpleAvailable(true)
    } else if (parts) {
      setPattern(settings.pattern)
      setPrefix(parts.prefix)
      setSeparator(parts.separator)
      setDigits(parts.digits)
      setTab('simple')
      setSimpleAvailable(true)
    } else {
      setPattern(settings.pattern)
      setTab('advanced')
      setSimpleAvailable(false)
    }
    setInitialized(true)
  }, [settings, initialized])

  // Simple tab composes `pattern` from its three controls; Advanced edits the raw string
  // directly (see its own onChange below). Only recomposes while Simple is actually the open
  // tab, so switching to Advanced and hand-editing never gets silently overwritten.
  useEffect(() => {
    if (tab === 'simple' && simpleAvailable) {
      setPattern(composeSimplePattern(prefix, separator, digits))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, simpleAvailable, prefix, separator, digits])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)

    if (!hasSequenceToken(pattern)) {
      setFormError('Pattern must include a {SEQ:N} sequence token — it is the only part that guarantees two products never get the same SKU.')
      return
    }
    if (pattern.length > 100) {
      setFormError('This pattern is too long. Shorten the prefix/suffix text or a token size.')
      return
    }

    setSaving(true)
    try {
      const updated = await productsApi.updateSkuSettings({ enabled, pattern, resetCadence })
      setSettings(updated)
      showToast('SKU settings saved.', 'success')
    } catch (err) {
      setFormError(isAppError(err) ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">SKU settings</h1>
        <p className="text-sm text-neutral-500">
          Turn on automatic SKU generation and choose the pattern new products get their code from.
          Off by default — existing products, and anything created while this is off, keep whatever
          SKU was typed in.
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-10 text-sm text-neutral-500">
          <Spinner /> Loading…
        </div>
      )}

      {!loading && error && <ErrorState title="Could not load SKU settings" message={error} onRetry={refetch} />}

      {!loading && !error && (
        <form
          onSubmit={(event) => void handleSubmit(event)}
          noValidate
          className="flex max-w-2xl flex-col gap-5 rounded-lg border border-neutral-200 bg-white p-5"
        >
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
            />
            <span>
              <span className="block text-sm font-medium text-neutral-900">Generate SKUs automatically</span>
              <span className="block text-sm text-neutral-500">
                When on, the SKU field is filled in for you on every new product and locked — nobody
                can type their own SKU on the add-product form or in a bulk upload while this is on.
              </span>
            </span>
          </label>

          <div>
            <div className="mb-3 inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 p-0.5">
              <button
                type="button"
                disabled={!simpleAvailable}
                onClick={() => simpleAvailable && setTab('simple')}
                className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  tab === 'simple' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                Simple
              </button>
              <button
                type="button"
                onClick={() => setTab('advanced')}
                className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === 'advanced' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                Advanced
              </button>
            </div>
            {!simpleAvailable && (
              <p className="mb-3 text-xs text-neutral-500">
                Simple isn't available for the current pattern — it uses a date or product-name token,
                which only the Advanced editor can express.
              </p>
            )}

            {tab === 'simple' && simpleAvailable ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <TextField
                  label="Prefix"
                  value={prefix}
                  onChange={(event) => setPrefix(event.target.value.toUpperCase())}
                  hint="Free text, e.g. your company initials."
                />
                <div>
                  <label htmlFor="sku-separator" className="mb-1.5 block text-sm font-medium text-neutral-700">
                    Separator
                  </label>
                  <select
                    id="sku-separator"
                    value={separator}
                    onChange={(event) => setSeparator(event.target.value)}
                    className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
                  >
                    {SEPARATOR_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <TextField
                  label="Sequence digits"
                  type="number"
                  min={1}
                  max={10}
                  value={digits}
                  onChange={(event) => setDigits(Math.min(10, Math.max(1, Number(event.target.value) || 1)))}
                  hint="Zero-padded, e.g. 4 digits → 0001."
                />
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div>
                  <label htmlFor="sku-pattern" className="mb-1.5 block text-sm font-medium text-neutral-700">
                    Pattern
                  </label>
                  <textarea
                    id="sku-pattern"
                    value={pattern}
                    onChange={(event) => setPattern(event.target.value)}
                    rows={2}
                    maxLength={100}
                    className="w-full rounded-md border border-neutral-200 px-3 py-2 font-mono text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
                  />
                  <p className="mt-1.5 text-xs text-neutral-500">
                    Tokens: <code>{'{SEQ:N}'}</code> (required, zero-padded sequence number),{' '}
                    <code>{'{YYYY}'}</code>, <code>{'{YY}'}</code>, <code>{'{MM}'}</code>,{' '}
                    <code>{'{DD}'}</code>, <code>{'{NAME:N}'}</code> (first N letters of the product
                    name). Anything else is used as-is.
                  </p>
                </div>
                <div>
                  <label htmlFor="sku-cadence" className="mb-1.5 block text-sm font-medium text-neutral-700">
                    Reset the sequence
                  </label>
                  <select
                    id="sku-cadence"
                    value={resetCadence}
                    onChange={(event) => setResetCadence(event.target.value as SkuResetCadence)}
                    className="w-full max-w-sm rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
                  >
                    {CADENCE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-neutral-500">
                    Only meaningful alongside a date token — otherwise there's no period for the count
                    to reset within.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
            Example: <span className="font-mono font-medium text-neutral-900">{renderExample(pattern) || '—'}</span>
            <span className="ml-1 text-xs text-neutral-400">(illustration — the real next SKU depends on how many products you already have)</span>
          </div>

          <FormError message={formError} />

          <div className="flex justify-end">
            <Button type="submit" loading={saving}>
              Save changes
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
