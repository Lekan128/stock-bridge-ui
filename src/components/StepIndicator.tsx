import { Check } from 'lucide-react'

export interface StepIndicatorStep {
  id: string
  label: string
}

export interface StepIndicatorProps {
  steps: StepIndicatorStep[]
  /** 0-based index of the step currently being worked on. */
  currentIndex: number
  /**
   * Lets the user jump back to an already-completed step. Only ever called for indexes below
   * `currentIndex` — jumping *forward* would skip validation, so it is not offered.
   */
  onStepClick?: (index: number) => void
  className?: string
}

/**
 * Checkout progress indicator (Delivery → Payment → Review). The UX bar requires a visible step
 * indicator with no dead ends, so completed steps are navigable backwards while the remaining
 * ones stay inert.
 */
export function StepIndicator({ steps, currentIndex, onStepClick, className = '' }: StepIndicatorProps) {
  return (
    <nav aria-label="Checkout progress" className={className}>
      <ol className="flex items-center">
        {steps.map((step, index) => {
          const isComplete = index < currentIndex
          const isCurrent = index === currentIndex
          const canNavigate = isComplete && !!onStepClick

          const marker = (
            <>
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold ${
                  isComplete
                    ? 'border-accent-600 bg-accent-600 text-white'
                    : isCurrent
                      ? 'border-primary-600 bg-primary-600 text-white'
                      : 'border-neutral-300 bg-white text-neutral-400'
                }`}
              >
                {isComplete ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" /> : index + 1}
              </span>
              {/* Labels are hidden below sm — at 375px three labels plus connectors don't fit,
                  and the numbered markers alone still convey position. */}
              <span
                className={`hidden text-sm font-medium sm:inline ${
                  isCurrent ? 'text-primary-700' : isComplete ? 'text-neutral-700' : 'text-neutral-400'
                }`}
              >
                {step.label}
              </span>
            </>
          )

          return (
            <li key={step.id} className={`flex items-center gap-2 ${index < steps.length - 1 ? 'flex-1' : ''}`}>
              {canNavigate ? (
                <button
                  type="button"
                  onClick={() => onStepClick(index)}
                  aria-current={isCurrent ? 'step' : undefined}
                  className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  {marker}
                </button>
              ) : (
                <span className="flex items-center gap-2" aria-current={isCurrent ? 'step' : undefined}>
                  {marker}
                </span>
              )}
              {index < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`mx-1 h-0.5 flex-1 rounded-full ${isComplete ? 'bg-accent-300' : 'bg-neutral-200'}`}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
