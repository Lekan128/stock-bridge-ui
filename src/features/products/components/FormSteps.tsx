import type { ComponentType } from 'react'
import { Check } from 'lucide-react'

export interface FormStep {
  id: string
  label: string
  /** A small picture of what's in it: a tag for Basics, a ruler for Units. */
  icon: ComponentType<{ className?: string }>
  /** Nothing in it has to be filled: said beside it when adding, so Next with it empty is plainly fine. */
  optional?: boolean
  /** Gone through and fine. */
  done?: boolean
  /** Something in it to fix. */
  problem?: boolean
}

/**
 * The product form's sections (owner, 2026-11-10: AWS's steps down the left or Azure's across the top - suggestions,
 * "use the one that best fits into our design"). Two looks for two jobs:
 *
 * - Adding (`numbered`): steps taken in order - checkout's and bulk import's marks (a number in a circle, blue where
 *   you are, green ✓ once done), small and close together.
 * - Editing: not steps at all - a list of sections to jump between, each with its picture, the open one lifted in
 *   white like a settings menu. Empty circles there read as boxes left unticked.
 *
 * Down the left on a wide screen; a row across the top on a phone, where a side list doesn't fit. Every one can be
 * tapped at any time.
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
      <ol className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:hidden">
        {steps.map((step, index) => {
          const isCurrent = step.id === current
          return (
            <li key={step.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onSelect(step.id)}
                aria-current={isCurrent ? 'step' : undefined}
                className={`flex h-10 items-center gap-2 rounded-full border px-3 text-sm font-medium ${
                  isCurrent
                    ? 'border-primary-600 bg-primary-600 text-white'
                    : step.problem
                      ? 'border-danger-300 bg-white text-danger-700'
                      : 'border-neutral-200 bg-white text-neutral-700'
                }`}
              >
                {numbered ? (
                  <Marker step={step} index={index} current={isCurrent} onDark={isCurrent} />
                ) : step.problem ? (
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-danger-500" />
                ) : (
                  <step.icon className="h-4 w-4" aria-hidden="true" />
                )}
                {step.label}
              </button>
            </li>
          )
        })}
      </ol>

      {/* A wide screen, adding: the steps down the left, joined by a line. */}
      {numbered ? (
        <ol className="hidden lg:flex lg:flex-col">
          {steps.map((step, index) => {
            const isCurrent = step.id === current
            return (
              <li key={step.id} className="relative pb-1 last:pb-0">
                {index < steps.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={`absolute top-8 -bottom-2 left-[1.375rem] w-px ${step.done ? 'bg-accent-400' : 'bg-neutral-200'}`}
                  />
                )}
                <button
                  type="button"
                  onClick={() => onSelect(step.id)}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`relative flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none ${
                    isCurrent ? 'bg-white shadow-sm ring-1 ring-neutral-200' : 'hover:bg-neutral-100'
                  }`}
                >
                  <Marker step={step} index={index} current={isCurrent} />
                  <StepLabel step={step} current={isCurrent} showOptional />
                </button>
              </li>
            )
          })}
        </ol>
      ) : (
        /* A wide screen, editing: the sections, each with its picture; the open one lifted in white. */
        <ul className="hidden lg:flex lg:flex-col lg:gap-0.5">
          {steps.map((step) => {
            const isCurrent = step.id === current
            return (
              <li key={step.id}>
                <button
                  type="button"
                  onClick={() => onSelect(step.id)}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none ${
                    isCurrent ? 'bg-white text-primary-700 shadow-sm ring-1 ring-neutral-200' : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  {isCurrent && <span aria-hidden="true" className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-primary-600" />}
                  <step.icon className={`h-4 w-4 shrink-0 ${isCurrent ? 'text-primary-600' : 'text-neutral-500'}`} aria-hidden="true" />
                  <span className="flex-1">{step.label}</span>
                  {step.problem && (
                    <span className="rounded-full bg-danger-50 px-2 py-0.5 text-xs font-medium text-danger-700">Fix</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </nav>
  )
}

function StepLabel({ step, current, showOptional }: { step: FormStep; current: boolean; showOptional?: boolean }) {
  return (
    <span className="min-w-0 pt-0.5">
      <span className={`block text-sm font-medium ${current ? 'text-primary-700' : step.problem ? 'text-danger-700' : 'text-neutral-800'}`}>
        {step.label}
      </span>
      {step.problem ? (
        <span className="block text-xs text-danger-600">Something to fix</span>
      ) : (
        showOptional && step.optional && <span className="block text-xs text-neutral-500">Optional</span>
      )}
    </span>
  )
}

function Marker({ step, index, current, onDark }: { step: FormStep; index: number; current: boolean; onDark?: boolean }) {
  const base = 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold'
  if (step.problem) return <span className={`${base} border-2 border-danger-500 bg-white text-danger-600`}>!</span>
  if (step.done && !current) {
    return (
      <span className={`${base} bg-accent-600 text-white`}>
        <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
      </span>
    )
  }
  if (current) return <span className={`${base} ${onDark ? 'bg-white text-primary-700' : 'bg-primary-600 text-white'}`}>{index + 1}</span>
  return <span className={`${base} border border-neutral-300 bg-white text-neutral-500`}>{index + 1}</span>
}
