import { useEffect, useRef, type ReactNode } from 'react'
import { StepIndicator } from '@/components/StepIndicator'
import { copy } from '@/features/imports/copy'

const STEPS = [
  { id: 'upload', label: copy.steps.upload },
  { id: 'review', label: copy.steps.review },
  { id: 'confirm', label: copy.steps.confirm },
]

export interface ImportStepFrameProps {
  /** 0 Upload · 1 Review · 2 Confirm. */
  step: number
  title: string
  subtitle?: ReactNode
  onStepClick?: (index: number) => void
  children: ReactNode
}

/**
 * The shell every step shares: progress, heading, content.
 *
 * The heading takes focus whenever the step changes. Without it a keyboard or screen-reader
 * user who presses Continue is left with focus on a button that no longer exists, and has to
 * tab from the top of the document to work out where they landed.
 */
export function ImportStepFrame({ step, title, subtitle, onStepClick, children }: ImportStepFrameProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [step, title])

  return (
    <div className="flex flex-col gap-6">
      <StepIndicator
        steps={STEPS}
        currentIndex={step}
        onStepClick={onStepClick}
        label={copy.steps.progressLabel}
        className="max-w-md"
      />

      <div>
        {/* Clamped because the review step's title carries the filename, and people name
          spreadsheets things like `Dangote-price-list-Q3-2026-final-FINAL-v7-revised.xlsx`. At
          360px that wrapped to six lines and pushed the counters, the supplier decisions and the
          Continue button entirely below the fold — a heading that hides the screen it names. The
          full text stays the accessible name and the tooltip, so nothing is lost, only folded. */}
        <h1
          ref={headingRef}
          tabIndex={-1}
          title={title}
          className="line-clamp-2 text-2xl font-semibold break-words text-neutral-900 focus:outline-none"
        >
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-neutral-600">{subtitle}</p>}
      </div>

      {children}
    </div>
  )
}
