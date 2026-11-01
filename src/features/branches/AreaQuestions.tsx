import { AREA_KINDS, AREA_KIND_ORDER, ARRIVING, type AreaKind } from '@/features/branches/areas'

/**
 * The two questions about an area, as one way everywhere (owner, 2026-11-01): Edit asks them, and so does each card
 * when areas are added. What happens there (D-A12), and what happens when stock is moved there (Part 4) - each its
 * own box, only the chosen answer explained under it.
 *
 * @param name the area's name as typed so far, for "someone in the Kitchen".
 * @param delivery where deliveries arrive: it keeps stock, so "used up as soon as it arrives" can't be chosen.
 */
export function AreaQuestions({
  id,
  name,
  kind,
  confirms,
  onKind,
  onConfirms,
  disabled = false,
  delivery = false,
}: {
  id: string
  name: string
  kind: AreaKind
  confirms: boolean
  onKind: (kind: AreaKind) => void
  onConfirms: (confirms: boolean) => void
  disabled?: boolean
  delivery?: boolean
}) {
  const place = name.trim() ? `the ${name.trim()}` : 'this area'
  return (
    <>
      <ChoiceList
        legend="What happens here?"
        name={`${id}-kind`}
        value={kind}
        onChange={onKind}
        disabled={disabled}
        options={AREA_KIND_ORDER.map((option) => ({
          value: option,
          title: AREA_KINDS[option].title,
          means: AREA_KINDS[option].means,
          ...(delivery && option === 'USED_UP' ? { off: 'Deliveries arrive here, so it keeps stock.' } : {}),
        }))}
      />
      {/* Two names on every move (Part 4): its own question, about arriving - any kind of area can ask it. */}
      <ChoiceList
        legend="When stock is moved here"
        name={`${id}-confirms`}
        value={confirms ? 'CONFIRM' : 'NOW'}
        onChange={(value) => onConfirms(value === 'CONFIRM')}
        disabled={disabled}
        options={[
          {
            value: 'NOW',
            title: ARRIVING.NOW,
            means:
              kind === 'USED_UP'
                ? "It's recorded as used as soon as it's moved."
                : `${capitalise(place)}'s figure goes up as soon as it's moved.`,
          },
          {
            value: 'CONFIRM',
            title: ARRIVING.CONFIRM,
            means: `It waits until someone in ${place} says they got it${kind === 'USED_UP' ? ", then it's recorded as used" : ''}.`,
          },
        ]}
      />
    </>
  )
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * One question as one box: a line per answer, and only the chosen answer explained, under it - short on a phone,
 * and plainly one question, not a list of separate switches.
 */
function ChoiceList<T extends string>({
  legend,
  name,
  value,
  onChange,
  disabled,
  options,
}: {
  legend: string
  name: string
  value: T
  onChange: (value: T) => void
  disabled: boolean
  /** `off`: why it can't be chosen here, said on its line. */
  options: { value: T; title: string; means: string; off?: string }[]
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-neutral-800">{legend}</legend>
      <div className="divide-y divide-neutral-100 overflow-hidden rounded-lg border border-neutral-200 bg-white">
        {options.map((option) => {
          const chosen = option.value === value
          return (
            <label
              key={option.value}
              className={`flex gap-3 px-3 py-2.5 ${chosen ? 'bg-primary-50' : ''} ${
                option.off ? 'opacity-60' : 'cursor-pointer hover:bg-neutral-50'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={chosen}
                disabled={option.off != null || disabled}
                onChange={() => onChange(option.value)}
                className="mt-1 h-4 w-4 shrink-0"
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className={`text-base text-neutral-900 ${chosen ? 'font-medium' : ''}`}>{option.title}</span>
                {(chosen || option.off) && <span className="text-sm text-neutral-700">{option.off ?? option.means}</span>}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
