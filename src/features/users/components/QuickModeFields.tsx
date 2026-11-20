import { PERMISSIONS } from '@/auth/permissions'
import { hasAreas } from '@/features/branches/areas'
import { useOptionalWorkingBranch } from '@/features/branches/useWorkingBranch'
import { MAX_QUICK_TABS, MODES, type Mode } from '@/features/quick/quickTabs'
import { useSellingPolicy } from '@/features/selling/useSellingPolicy'

/** The buttons a role allows at this company: the same rules quick mode uses, for every branch. */
export function quickButtonsFor(permissions: string[], company: { sells: boolean; tables: boolean; tickets: boolean; areas: boolean }): Mode[] {
  const has = (code: string) => permissions.includes(code)
  const allowed: Record<Mode, boolean> = {
    tables: company.sells && company.tables && has(PERMISSIONS.STOCK_OUT),
    tickets: company.tickets && has(PERMISSIONS.VIEW_PRODUCTS),
    sell: company.sells && has(PERMISSIONS.STOCK_OUT),
    in: has(PERMISSIONS.STOCK_IN),
    out: has(PERMISSIONS.STOCK_OUT),
    move: company.areas && has(PERMISSIONS.STOCK_OUT),
    ask: company.areas && (has(PERMISSIONS.STOCK_IN) || has(PERMISSIONS.STOCK_OUT)),
    count: has(PERMISSIONS.MANAGE_INVENTORY),
  }
  return MODES.map((mode) => mode.value).filter((mode) => allowed[mode])
}

/**
 * Quick mode for every job (V105; owner, 2026-11-19), on Edit a person: where they start - the usual app or quick
 * mode - and their quick mode buttons, up to four, from what their role allows. The person can change their buttons
 * on their Profile too; where they start is the manager's choice.
 */
export function QuickModeFields({
  name,
  permissions,
  startsInQuick,
  onStartsInQuick,
  tabs,
  onTabs,
}: {
  name: string
  permissions: string[]
  startsInQuick: boolean
  onStartsInQuick: (quick: boolean) => void
  /** Their buttons; empty: quick mode's own choice for where they work. */
  tabs: Mode[]
  onTabs: (tabs: Mode[]) => void
}) {
  const branch = useOptionalWorkingBranch()
  const { recordsSales } = useSellingPolicy()
  const branches = branch?.branches ?? []
  const available = quickButtonsFor(permissions, {
    sells: recordsSales,
    tables: branches.some((one) => (one.tables?.length ?? 0) > 0),
    tickets: branches.some((one) => one.ticketsOn),
    areas: branches.some((one) => hasAreas(one)),
  })
  if (available.length === 0) return null
  const chosen = tabs.filter((mode) => available.includes(mode))
  const full = chosen.length >= MAX_QUICK_TABS

  return (
    <div className="flex flex-col gap-4 border-t border-neutral-200 pt-4" data-quick-mode-fields>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-neutral-800">Where does {name} start?</legend>
        <div className="divide-y divide-neutral-100 overflow-hidden rounded-lg border border-neutral-200 bg-white">
          {(
            [
              [false, 'The usual app', 'The Dashboard, with the menu.'],
              [
                true,
                'Quick mode',
                `Big buttons for the job, nothing else on the screen. Exit shows the usual app; the next time ${name} opens it, quick mode again.`,
              ],
            ] as const
          ).map(([quick, title, means]) => (
            <label key={title} className={`flex cursor-pointer gap-3 px-3 py-2.5 ${startsInQuick === quick ? 'bg-primary-50' : 'hover:bg-neutral-50'}`}>
              <input
                type="radio"
                name="starts-in"
                checked={startsInQuick === quick}
                onChange={() => onStartsInQuick(quick)}
                className="mt-1 h-4 w-4 shrink-0"
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className={`text-base text-neutral-900 ${startsInQuick === quick ? 'font-medium' : ''}`}>{title}</span>
                {startsInQuick === quick && <span className="text-sm text-neutral-700">{means}</span>}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-neutral-800">
          Quick mode buttons{' '}
          <span className="font-normal text-neutral-500">
            · up to {MAX_QUICK_TABS}
            {chosen.length > 0 ? ` · ${chosen.length} chosen` : ''}
          </span>
        </legend>
        <div className="divide-y divide-neutral-100 overflow-hidden rounded-lg border border-neutral-200 bg-white">
          {MODES.filter((mode) => available.includes(mode.value)).map((mode) => {
            const on = chosen.includes(mode.value)
            const locked = !on && full
            return (
              <label key={mode.value} className={`flex gap-3 px-3 py-2.5 ${on ? 'bg-primary-50' : ''} ${locked ? 'opacity-60' : 'cursor-pointer hover:bg-neutral-50'}`}>
                <input
                  type="checkbox"
                  checked={on}
                  disabled={locked}
                  onChange={() => onTabs(on ? chosen.filter((m) => m !== mode.value) : available.filter((m) => m === mode.value || chosen.includes(m)))}
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
        <p className="mt-1.5 text-xs text-neutral-500">
          {chosen.length === 0
            ? 'None ticked: quick mode picks the usual ones for where they work.'
            : `${name} can change these on their Profile.`}
        </p>
      </fieldset>
    </div>
  )
}
