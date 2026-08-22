import { Clock, Zap } from 'lucide-react'

/**
 * The two field groups, in the words a supplier actually uses.
 *
 * <h2>Why the lists are spelled out rather than named</h2>
 * The rule is "identity-based attributes re-trigger moderation", and that sentence is
 * useless to the person it is aimed at: a busy supplier reading it has to guess which bucket
 * "unit of measure" is in, guesses wrong, and finds out by watching their listing disappear.
 * So neither list is described — both are ENUMERATED, every field named exactly as it is
 * labelled on the form above it, and nothing is left to inference. A vendor should never have
 * to work out which group a field is in.
 *
 * <p>The framing is "what the product IS" versus "what it costs and how many you have",
 * because that is the distinction the server actually implements
 * (`ProductModerationRules.invalidatesApproval`) and it is one a seller already has an
 * intuition for. Price and stock are stated as a POSITIVE — they go live straight away —
 * rather than as an absence, so the notice reads as an explanation of how the system works
 * rather than as a warning about what will be taken away.
 *
 * <h2>Kept in step with the server, by hand</h2>
 * These six field names are `ProductModerationRules.invalidatesApproval`'s six parameters.
 * There is no mechanism keeping them in sync, so a seventh field added there needs a line
 * here — and the moderation write-path audit table in that class is where a reader is sent
 * to check.
 *
 * <p>Both lists are module-private. Nothing outside this file consumes them, and exporting a
 * non-component from a component module costs a fast-refresh lint warning for no benefit.
 */
const IDENTITY_FIELD_LABELS = [
  'Product name',
  'SKU',
  'Description',
  'Brand',
  'Photo',
  'Unit of measure (50kg bag, carton, litre…)',
]

const IMMEDIATE_FIELD_LABELS = [
  'Unit price',
  'Cost price',
  'Quantity in stock',
  'Low stock threshold',
  'Supplier',
  'Whether the product is active',
]

export interface ReviewImpactNoticeProps {
  /**
   * `edit` speaks about a listing that already exists ("sends it back"); `create` about one
   * that does not yet ("will be reviewed before"). Getting this wrong is how a first-time
   * vendor concludes their brand-new product has already been rejected once.
   */
  mode: 'create' | 'edit'
}

/**
 * Shown above the product form for vendors only — see `ProductFormPage` for why ProcurePal
 * and ordinary buying companies never see it.
 */
export function ReviewImpactNotice({ mode }: ReviewImpactNoticeProps) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
      <p className="text-sm font-medium text-neutral-900">
        {mode === 'edit'
          ? 'Some changes send this listing back for a quick review'
          : 'New listings get a quick review before buyers see them'}
      </p>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-warning-800">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Goes back for review
          </p>
          <p className="mt-1 text-xs text-neutral-600">
            {mode === 'edit'
              ? 'Change what the product IS and it comes off the storefront until we approve it again — usually the same working day.'
              : 'Everything that says what the product IS gets checked before it goes on the storefront.'}
          </p>
          <ul className="mt-1.5 flex flex-col gap-0.5 text-xs text-neutral-700">
            {IDENTITY_FIELD_LABELS.map((label) => (
              <li key={label} className="flex gap-1.5">
                <span aria-hidden="true" className="text-neutral-400">
                  •
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-accent-700">
            <Zap className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Goes live straight away
          </p>
          <p className="mt-1 text-xs text-neutral-600">
            Never needs review, and never takes your listing down. Correct these as often as you need to.
          </p>
          <ul className="mt-1.5 flex flex-col gap-0.5 text-xs text-neutral-700">
            {IMMEDIATE_FIELD_LABELS.map((label) => (
              <li key={label} className="flex gap-1.5">
                <span aria-hidden="true" className="text-neutral-400">
                  •
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
