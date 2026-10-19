import { useState } from 'react'
import { CircleHelp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/Button'
import type { PriceAnswer, PriceQuestion } from '@/features/imports/types'

export interface PriceQuestionPanelProps {
  question: PriceQuestion
  /** The column as the file spells it, for the sentence ("Price", "Unit price"). */
  columnName: string
  onAnswer: (answer: PriceAnswer) => Promise<void>
}

/**
 * The one question a product sheet can ask about money (`SELLING_PRICE_PLAN.md` §5.3, §6.8).
 *
 * "Price" on a shop's own spreadsheet is the invoice price for some and the shelf price for others,
 * and either wrong guess quietly ruins every profit figure after it. So instead of guessing, one
 * sentence, the column's own values to check against, and an answer per button - the kind of
 * question a person can settle by glancing at their sheet. Our own template never raises it.
 *
 * Keeping selling prices when the company doesn't record sales turns selling on; the button says
 * so. Someone who can't turn it on is told the column is left out, and why - and is not held up.
 */
export function PriceQuestionPanel({ question, columnName, onAnswer }: PriceQuestionPanelProps) {
  const [busy, setBusy] = useState<PriceAnswer | null>(null)
  const [error, setError] = useState<string | null>(null)
  const samples = question.samples.length > 0 ? question.samples.join(' · ') : null
  const turnsSellingOn = !question.sellingOn && question.canTurnOnSelling

  async function answer(choice: PriceAnswer) {
    setBusy(choice)
    setError(null)
    try {
      await onAnswer(choice)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that. Try again.")
      setBusy(null)
    }
  }

  const button = (choice: PriceAnswer, label: string, variant: 'secondary' | 'primary' = 'secondary') =>
    question.options.includes(choice) && (
      <Button key={choice} variant={variant} loading={busy === choice} disabled={busy != null} onClick={() => void answer(choice)}>
        {label}
      </Button>
    )

  // Told, not asked: a sheet's selling prices from someone who can't turn selling on.
  if (question.kind === 'KEEP_SELLING_PRICES' && !question.blocking) {
    return (
      <p role="status" className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
        The “{columnName}” column will be left out: your company doesn't record sales. Your owner can turn on selling in{' '}
        <Link to="/app/company" className="font-medium text-primary-700 underline">
          Company settings
        </Link>
        .
      </p>
    )
  }

  return (
    <section aria-labelledby="price-question-title" className="flex flex-col gap-3 rounded-lg border border-primary-200 bg-primary-50 p-4">
      <h2 id="price-question-title" className="flex items-center gap-2 text-base font-semibold text-neutral-900">
        <CircleHelp className="h-4 w-4 text-primary-700" aria-hidden="true" />
        {question.kind === 'PRICE_MEANING'
          ? `Is “${columnName}” what you pay, or what you sell for?`
          : `Your sheet has selling prices. Keep them?`}
      </h2>
      <p className="text-sm text-neutral-700">
        {samples && (
          <>
            The column has <span className="font-medium tabular-nums">{samples}</span>
            {question.samples.length >= 3 ? '…' : '.'}{' '}
          </>
        )}
        {question.kind === 'PRICE_MEANING'
          ? 'We need to know before anything is imported.'
          : 'Keeping them turns on selling for your company: prices on products, and recording sales.'}
      </p>
      <div className="flex flex-wrap gap-2">
        {question.kind === 'PRICE_MEANING' ? (
          <>
            {button('COST', 'What we pay')}
            {button('SELLING', turnsSellingOn ? 'What we sell for (turns on selling)' : 'What we sell for')}
            {button('IGNORE', 'Leave it out')}
          </>
        ) : (
          <>
            {button('SELLING', 'Keep prices and turn on selling', 'primary')}
            {button('IGNORE', 'Leave this column out')}
          </>
        )}
      </div>
      {question.kind === 'PRICE_MEANING' && !question.options.includes('SELLING') && !question.sellingOn && (
        <p className="text-xs text-neutral-600">
          If it's what you sell for, leave it out: your company doesn't record sales.
          {question.sellingAvailable !== false && ' Your owner can turn that on.'}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger-700">
          {error}
        </p>
      )}
    </section>
  )
}
