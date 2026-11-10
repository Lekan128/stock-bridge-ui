import { Check } from 'lucide-react'

export interface FormStep {
  id: string
  label: string
  /** Nothing in it has to be filled: said beside it, so Next with it empty is plainly fine. */
  optional?: boolean
  /** Gone through and fine. */
  done?: boolean
  /** Something in it to fix. */
  problem?: boolean
}

/**
 * The product form's sections (owner, 2026-11-10: AWS's steps down the left, Azure's across the top - "use the one
 * that best fits into our design"). The same marks as checkout's and bulk import's `StepIndicator` - a number in a
 * circle, blue for where you are, green ✓ once done - so it reads as the app's own: a list down the left on a wide
 * screen, a row across the top on a phone, where a list down the side doesn't fit. Every step can be tapped at any
 * time, forward too: nothing is lost by looking ahead, and a step's own fields are checked on Next and on Create.
 *
 * `numbered` for adding a product, where they're steps taken in order; an edit lists them plainly, sections to jump to.
 */
export function FormSteps({
  steps,
  current,
  onSelect,
  numbered,
  label,
}: {
  steps: FormStep[]
  current: string
  onSelect: (id: string) => void
  numbered: boolean
  label: string
}) {
  return (
    <nav aria-label={label}>
      {/* A phone: one row across the top, scrolled sideways if it must; every label shown, since it's tapped. */}
      <ol className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:hidden">
        {steps.map((step, index) => (
          <li key={step.id} className="shrink-0">
            <button
              type="button"
              onClick={() => onSelect(step.id)}
              aria-current={step.id === current ? 'step' : undefined}
              className={`flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-medium ${
                step.id === current
                  ? 'border-primary-600 bg-primary-50 text-primary-800'
                  : 'border-neutral-200 bg-white text-neutral-700'
              }`}
            >
              <Marker step={step} index={index} numbered={numbered} current={step.id === current} small />
              {step.label}
            </button>
          </li>
        ))}
      </ol>

      {/* A wide screen: down the left, joined by a line, as AWS lays its steps out. */}
      <ol className="hidden lg:flex lg:flex-col">
        {steps.map((step, index) => {
          const isCurrent = step.id === current
          return (
            <li key={step.id} className="relative pb-5 last:pb-0">
              {index < steps.length - 1 && (
                <span aria-hidden="true" className={`absolute top-8 bottom-0 left-3.5 w-0.5 -translate-x-1/2 ${step.done ? 'bg-accent-300' : 'bg-neutral-200'}`} />
              )}
              <button
                type="button"
                onClick={() => onSelect(step.id)}
                aria-current={isCurrent ? 'step' : undefined}
                className="group relative flex w-full items-start gap-3 rounded-md text-left focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
              >
                <Marker step={step} index={index} numbered={numbered} current={isCurrent} />
                <span className="min-w-0 pt-0.5">
                  <span
                    className={`block text-sm font-medium group-hover:underline ${
                      isCurrent ? 'text-primary-700' : step.problem ? 'text-danger-700' : 'text-neutral-800'
                    }`}
                  >
                    {step.label}
                  </span>
                  {step.problem ? (
                    <span className="block text-xs text-danger-600">Something to fix</span>
                  ) : (
                    step.optional && <span className="block text-xs text-neutral-500">Optional</span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function Marker({
  step,
  index,
  numbered,
  current,
  small,
}: {
  step: FormStep
  index: number
  numbered: boolean
  current: boolean
  small?: boolean
}) {
  const size = small ? 'h-6 w-6' : 'h-7 w-7'
  if (step.problem) {
    return (
      <span className={`flex ${size} shrink-0 items-center justify-center rounded-full border-2 border-danger-500 bg-white text-xs font-bold text-danger-600`}>
        !
      </span>
    )
  }
  if (step.done && !current) {
    return (
      <span className={`flex ${size} shrink-0 items-center justify-center rounded-full border-2 border-accent-600 bg-accent-600 text-white`}>
        <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
      </span>
    )
  }
  return (
    <span
      className={`flex ${size} shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold ${
        current ? 'border-primary-600 bg-primary-600 text-white' : 'border-neutral-300 bg-white text-neutral-500'
      }`}
    >
      {numbered ? index + 1 : ''}
    </span>
  )
}
