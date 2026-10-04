import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export interface EmptyStateProps {
  /** Optional lucide icon, set small beside the title. */
  icon?: LucideIcon
  title: string
  /** One or two sentences: say what is missing and what the reader can do about it. */
  description?: ReactNode
  /** Buttons/links — the next thing to do. Pass `buttonClassName()` on a <Link> to match Button. */
  action?: ReactNode
  /**
   * `neutral` for "nothing here yet", `positive` for a *good* empty result (no low stock,
   * no failed payments) — a green mark stops a healthy state reading as a problem.
   */
  tone?: 'neutral' | 'positive'
  className?: string
}

/**
 * What every list shows when it has nothing to show (B2, v2). Left-aligned and set like the rest
 * of the page — a title, what is missing and what to do next as a sentence, then the action —
 * rather than a dashed box with an icon in a circle centred in it (plan §1.3: both on Impeccable's
 * list of template tells).
 */
export function EmptyState({ icon: Icon, title, description, action, tone = 'neutral', className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-start gap-2 rounded-lg border border-neutral-200 bg-white px-5 py-8 text-left sm:px-8 ${className}`}>
      <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900">
        {Icon && (
          <Icon className={`h-5 w-5 shrink-0 ${tone === 'positive' ? 'text-accent-600' : 'text-neutral-400'}`} aria-hidden="true" />
        )}
        {title}
      </h2>
      {description && <div className="max-w-prose text-sm text-neutral-600">{description}</div>}
      {action && <div className="mt-3 flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  )
}
