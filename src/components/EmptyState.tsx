import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export interface EmptyStateProps {
  /** Optional lucide icon rendered in a tinted circle. */
  icon?: LucideIcon
  title: string
  /** One or two sentences: say what is missing and what the reader can do about it. */
  description?: ReactNode
  /** Buttons/links. Pass `buttonClassName()` on a <Link> so it matches Button visually. */
  action?: ReactNode
  /**
   * `neutral` for "nothing here yet", `positive` for a *good* empty result (no low stock,
   * no failed payments) — a green mark stops a healthy state reading as a problem.
   */
  tone?: 'neutral' | 'positive'
  className?: string
}

const toneClasses: Record<NonNullable<EmptyStateProps['tone']>, string> = {
  neutral: 'bg-neutral-100 text-neutral-400',
  positive: 'bg-accent-100 text-accent-600',
}

/**
 * The generic designed empty state, modelled on EmptyProductsState so every list in the app —
 * catalog, cart, orders, addresses, fulfilment queue — reads the same. The UX bar forbids a bare
 * "No results" line, so this is what every list renders when it has nothing to show.
 */
export function EmptyState({ icon: Icon, title, description, action, tone = 'neutral', className = '' }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-16 text-center ${className}`}
    >
      {Icon && (
        <div className={`flex h-12 w-12 items-center justify-center rounded-full ${toneClasses[tone]}`}>
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
      )}
      <h2 className={`text-base font-semibold text-neutral-900 ${Icon ? 'mt-4' : ''}`}>{title}</h2>
      {description && <p className="mt-1 max-w-sm text-sm text-neutral-500">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  )
}
