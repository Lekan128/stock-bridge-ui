import { useState } from 'react'
import { Button } from '@/components/Button'
import { useToast } from '@/components/useToast'
import type { Profile } from '@/features/profile/types'
import { MAX_QUICK_TABS, MODES, useQuickModeTabs, type Mode } from '@/features/quick/quickTabs'
import { isAppError } from '@/types/api'

const GRID_COLS = ['', 'grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4']

/**
 * "Your quick mode buttons" (owner, 2026-11-01): up to four of the buttons this person may use, kept on their
 * account so every phone they sign in on shows the same. Here, not in quick mode - quick mode stays about the one
 * thing being done. Above the choices, the row as quick mode will show it. Nothing to choose (one button, or none):
 * no panel.
 */
export function QuickModeButtonsPanel({ onUpdated }: { onUpdated: (profile: Profile) => void }) {
  const quick = useQuickModeTabs()
  const { showToast } = useToast()
  const [picked, setPicked] = useState<Mode[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  if (quick.available.length < 2) return null

  const current = picked ?? quick.tabs
  const changed = picked != null && (picked.length !== quick.tabs.length || picked.some((mode) => !quick.tabs.includes(mode)))
  const isUsual = current.length === quick.usual.length && current.every((mode) => quick.usual.includes(mode))
  const full = current.length >= MAX_QUICK_TABS

  function toggle(mode: Mode) {
    setProblem(null)
    setPicked(current.includes(mode) ? current.filter((m) => m !== mode) : quick.available.filter((m) => m === mode || current.includes(m)))
  }

  async function save(next: Mode[] | null) {
    setSaving(true)
    setProblem(null)
    try {
      onUpdated(await quick.save(next))
      setPicked(null)
      showToast(next == null ? 'Quick mode has the usual buttons again' : 'Quick mode buttons saved', 'success')
    } catch (error) {
      setProblem(isAppError(error) ? error.message : 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-labelledby="quick-buttons-heading" className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-5">
      <div>
        <h2 id="quick-buttons-heading" className="text-base font-semibold text-neutral-900">
          Quick mode buttons
        </h2>
        <p className="mt-0.5 text-sm text-neutral-500">
          Keep the ones you use most, up to {MAX_QUICK_TABS}. Every phone you sign in on shows the same.
        </p>
      </div>

      {/* The row as quick mode will show it, the first one chosen as it opens. */}
      <div aria-hidden="true" className={`grid ${GRID_COLS[current.length] ?? 'grid-cols-4'} gap-1 rounded-lg bg-neutral-100 p-1`} data-quick-preview>
        {MODES.filter((mode) => current.includes(mode.value)).map((mode, index) => (
          <span
            key={mode.value}
            className={`flex h-10 items-center justify-center rounded-md text-sm font-semibold ${
              index === 0 ? 'bg-primary-600 text-white shadow-sm' : 'text-neutral-600'
            }`}
          >
            {mode.label}
          </span>
        ))}
      </div>

      <fieldset>
        <legend className="sr-only">Buttons in quick mode</legend>
        <div className="divide-y divide-neutral-100 overflow-hidden rounded-lg border border-neutral-200">
          {MODES.filter((mode) => quick.available.includes(mode.value)).map((mode) => {
            const on = current.includes(mode.value)
            // At least one stays; no more than four.
            const locked = (on && current.length === 1) || (!on && full)
            return (
              <label
                key={mode.value}
                className={`flex gap-3 px-3 py-2.5 ${on ? 'bg-primary-50' : ''} ${locked ? '' : 'cursor-pointer hover:bg-neutral-50'}`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  disabled={locked || saving}
                  onChange={() => toggle(mode.value)}
                  className="mt-1 h-4 w-4 shrink-0"
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className={`text-base text-neutral-900 ${on ? 'font-medium' : ''}`}>{mode.label}</span>
                  <span className="text-sm text-neutral-600">{mode.meaning}</span>
                </span>
              </label>
            )
          })}
        </div>
        {full && quick.available.length > MAX_QUICK_TABS && (
          <p className="mt-1.5 text-xs text-neutral-600">Quick mode has room for {MAX_QUICK_TABS}. Untick one to choose another.</p>
        )}
      </fieldset>

      {problem && (
        <p role="alert" className="text-sm text-danger-700">
          {problem}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" disabled={!changed || saving} loading={saving} onClick={() => void save(isUsual ? null : current)}>
          Save
        </Button>
        {/* Only once they've made a choice of their own: back to the app's. */}
        {quick.chosen != null && !changed && (
          <button
            type="button"
            disabled={saving}
            onClick={() => void save(null)}
            className="inline-flex min-h-11 items-center text-sm font-medium text-primary-700 hover:underline"
          >
            Use the usual buttons
          </button>
        )}
      </div>
    </section>
  )
}
