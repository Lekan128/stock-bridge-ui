import { useState } from 'react'
import { Banknote, Download, FileText, HandCoins, Hourglass, Lock, Printer, Wallet } from 'lucide-react'
import { Button } from '@/components/Button'
import { Badge, type BadgeVariant } from '@/components/Badge'
import { DateRangeControl } from '@/components/analytics/DateRangeControl'
import { defaultDateRange, toApiDateTime, type DateRange } from '@/components/analytics/dateRange'
import { formatDateRange, formatNumber } from '@/components/analytics/formatters'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/Skeleton'
import { AnalyticsErrorState } from '@/features/marketplace/analytics/components/AnalyticsErrorState'
import { useStatementDownload, useVendorStatement } from '@/features/vendor/hooks/useVendorStatement'
import type {
  LedgerEntryType,
  MaturingTranche,
  PayoutBatchStatus,
  VendorStatementLine,
} from '@/features/vendor/types'
import { formatNaira } from '@/utils/money'

/** Plain-English labels. The enum names are the server's vocabulary, not a vendor's. */
const LINE_LABELS: Record<LedgerEntryType, string> = {
  SALE_PROCEEDS: 'Sale',
  COMMISSION: 'Commission',
  SALE_REVERSAL: 'Sale reversed',
  COMMISSION_REVERSAL: 'Commission refunded',
  PAYOUT: 'Paid out',
}

const PAYOUT_BADGES: Record<PayoutBatchStatus, { variant: BadgeVariant; label: string }> = {
  PENDING: { variant: 'info', label: 'Awaiting transfer' },
  PAID: { variant: 'success', label: 'Paid' },
  FAILED: { variant: 'danger', label: 'Failed' },
}

const dateFormatter = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/**
 * The seller's account statement — `/app/selling/statement`.
 *
 * <h2>What this screen is for</h2>
 * Two questions, and everything on it answers one of them: *what have I been charged*, and
 * *what will I be paid, when*. It is the surface the stakeholder asked for by name, and the
 * bar it has to clear is unusual for a screen in this app — a vendor must be able to check
 * every figure on it with a calculator. So the commission column shows the rate and the
 * amount it was applied to next to the fee itself, and every row carries a running balance,
 * rather than asking anyone to trust a total.
 *
 * <h2>Signed amounts, deliberately</h2>
 * Money is rendered signed — `−₦62.53` for a commission — rather than as a magnitude in a
 * "debit" column. The column has to add up to the closing balance, and a reader adding a
 * column of unsigned numbers gets the wrong answer. Colour is a second cue, never the only
 * one, so this stays readable in print and to anyone who cannot distinguish the two.
 *
 * <h2>Escrow before ledger</h2>
 * The position cards come first and the line history second, because "when do I get paid"
 * is the question a vendor actually opens this page with. The states are labelled in their
 * own words — awaiting delivery / clearing / ready to pay / on its way — with the mechanism
 * explained under each, since "escrow" and "maturity" are the platform's words and not
 * necessarily theirs.
 *
 * <h2>The clearing bucket, and why the wording matters more than the number</h2>
 * Money a buyer HAS confirmed but which is still inside its hold is the single most likely
 * source of a "where is my money" email: the vendor delivered, the buyer signed for it, and
 * the payout that follows does not include it. So it gets its own card, its own dates, and
 * plain words — "clearing", not "maturing" or "in escrow", because a vendor is owed this
 * money and the copy should not imply otherwise.
 *
 * The card answers the whole question in one sentence: how much, when it clears, and when it
 * is actually paid. Those last two are different dates and both are shown, because the payout
 * runs on a fixed fortnightly cycle and money that clears on the 3rd is paid on the 10th. A
 * screen that showed only the clearing date would create exactly the expectation it was built
 * to prevent.
 *
 * <h2>Who sees it</h2>
 * Vendors AND ProcurePal, behind `RequireSeller` — the same reasoning as the own-sales
 * screen. ProcurePal reaches it and gets an explained empty state rather than a refusal:
 * the platform cannot owe itself commission, so it has no ledger, and saying so is a better
 * answer than a 403 that reads as a bug.
 *
 * <h2>Export</h2>
 * CSV and a print stylesheet, deliberately not a PDF. A PDF would mean a new dependency, a
 * font and a layout, and none of it makes the arithmetic easier to check — whereas a CSV
 * opens in the spreadsheet a bookkeeper already has and lets them re-add the column
 * themselves, which is exactly the property this statement is supposed to have.
 */
export function VendorStatementPage() {
  const [range, setRange] = useState<DateRange>(defaultDateRange)
  const params = { from: toApiDateTime(range.from), to: toApiDateTime(range.to) }

  const statement = useVendorStatement(params)
  const { download, downloading, error: downloadError } = useStatementDownload()

  const data = statement.data
  const rangeLabel = formatDateRange(range.from, range.to)

  const onDownload = () => {
    const stamp = `${range.from.toISOString().slice(0, 10)}-to-${range.to.toISOString().slice(0, 10)}`
    void download(params, `procurepaddy-statement-${stamp}.csv`)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Statement</h1>
          <p className="text-sm text-neutral-500">
            What you earned, what ProcurePaddy charged, and what you will be paid.
          </p>
        </div>
        {/* print:hidden on the whole control cluster: a printed statement should not carry
            buttons a reader cannot press. */}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <DateRangeControl value={range} onChange={setRange} />
          <Button variant="secondary" onClick={() => window.print()} disabled={!data}>
            <Printer size={16} aria-hidden />
            Print
          </Button>
          <Button variant="secondary" onClick={onDownload} loading={downloading} disabled={!data}>
            <Download size={16} aria-hidden />
            CSV
          </Button>
        </div>
      </div>

      {downloadError && (
        <p role="alert" className="rounded-md border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {downloadError}
        </p>
      )}

      {statement.loading && !data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-28 rounded-lg" />
          ))}
        </div>
      )}
      {statement.error && !data && <AnalyticsErrorState message={statement.error} onRetry={statement.refetch} />}

      {data && !data.ledgerBearing && (
        <EmptyState
          icon={FileText}
          title="No statement for this account"
          description={
            <>
              {data.sellerName} sells on its own marketplace, so there is no commission to charge and no
              payout to make — ProcurePaddy cannot owe itself money. Sales figures for this account live
              on <span className="font-medium">My sales</span>.
            </>
          }
        />
      )}

      {data && data.ledgerBearing && (
        <div className={`flex flex-col gap-6 ${statement.loading ? 'opacity-60' : ''}`}>
          {/* ------------------------------------------------------------------
              Position first: "when do I get paid" is what a vendor opens this for.
             ------------------------------------------------------------------ */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <PositionCard
              icon={Hourglass}
              label="Awaiting delivery"
              value={formatNaira(data.escrow.pendingNet)}
              hint={
                data.escrow.pendingOrderCount === 0
                  ? 'Nothing awaiting delivery'
                  : `${formatNumber(data.escrow.pendingOrderCount)} order${data.escrow.pendingOrderCount === 1 ? '' : 's'} paid for, not yet confirmed delivered`
              }
            />
            {/* The bucket the hold created. Second, not last: it comes directly after the money
                that has not been confirmed yet and directly before the money that is ready,
                which is the order it actually moves through. */}
            <PositionCard
              icon={Lock}
              label="Clearing"
              value={formatNaira(data.escrow.maturing)}
              hint={
                data.escrow.nextMaturityAt
                  ? `Confirmed by the buyer. Clears from ${dateFormatter.format(new Date(data.escrow.nextMaturityAt))}`
                  : `Confirmed money waits ${data.escrow.escrowHoldDays} day${data.escrow.escrowHoldDays === 1 ? '' : 's'} before it can be paid`
              }
            />
            <PositionCard
              icon={HandCoins}
              label="Ready to pay"
              value={formatNaira(data.escrow.payableNow)}
              hint={`Cleared. Goes out at the next payout, ${dateFormatter.format(new Date(data.escrow.nextPayoutCutoff))}`}
              tone={data.escrow.payableNow < 0 ? 'warning' : 'default'}
            />
            <PositionCard
              icon={Banknote}
              label="On its way"
              value={formatNaira(data.escrow.inFlight)}
              hint="Already on a payout batch, awaiting transfer"
            />
          </section>

          {/* ------------------------------------------------------------------
              The sentence this whole screen exists to say, with the real dates in it.
             ------------------------------------------------------------------ */}
          {data.escrow.maturingTranches.length > 0 && (
            <section className="rounded-lg border border-neutral-200 bg-white p-5">
              <div className="flex items-start gap-3">
                <Lock size={16} className="mt-0.5 shrink-0 text-neutral-400" aria-hidden />
                <div className="flex-1">
                  <h2 className="text-base font-semibold text-neutral-900">
                    Money clearing right now
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                    Your buyers have confirmed these orders, so this money is yours and it is
                    already counted in what you are owed. It waits{' '}
                    <span className="font-medium text-neutral-900">
                      {data.escrow.escrowHoldDays} day
                      {data.escrow.escrowHoldDays === 1 ? '' : 's'}
                    </span>{' '}
                    after each confirmation before it can be paid &mdash; the window that lets a
                    return or a disputed order be sorted out before the money has gone. After
                    that it goes out with the next payout, which runs every other Monday.
                  </p>
                </div>
              </div>

              <ul className="mt-4 divide-y divide-neutral-100 border-t border-neutral-100">
                {data.escrow.maturingTranches.map((tranche) => (
                  <TrancheRow key={tranche.maturesAt} tranche={tranche} />
                ))}
              </ul>
            </section>
          )}

          {data.escrow.heldBalance < 0 && (
            <p className="rounded-md border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800">
              Your balance is negative because refunds have outweighed new sales. Nothing is payable until
              new sales bring it back above zero — the shortfall is carried forward, not invoiced.
            </p>
          )}

          {/* Surprising, correct, and worth explaining rather than hiding. A refund lands
              immediately while the sale it reverses is still clearing, so for the rest of that
              window "ready to pay" can be negative against an equal amount in "clearing". The
              two net to what is actually owed, and no money goes out in the meantime — which is
              the hold doing exactly the job it was added for. */}
          {data.escrow.payableNow < 0 && data.escrow.heldBalance >= 0 && (
            <p className="rounded-md border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800">
              A refund has been applied against an order that is still clearing, so
              &ldquo;ready to pay&rdquo; is showing below zero. Nothing is wrong and nothing is
              owed by you: the refund and the sale it reverses cancel out, and your total
              &mdash; {formatNaira(data.escrow.heldBalance)} &mdash; is what you are actually
              owed. No payout will go out for the reversed order.
            </p>
          )}

          {/* ------------------------------------------------------------------
              The reconciliation. Shown as working, not as a conclusion.
             ------------------------------------------------------------------ */}
          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-neutral-900">This period</h2>
              <p className="text-sm text-neutral-500">{rangeLabel}</p>
            </div>
            <dl className="mt-4 divide-y divide-neutral-100 text-sm">
              <ReconciliationRow label="Opening balance" value={data.openingBalance} strong />
              <ReconciliationRow label="Sales proceeds" value={data.movements.salesProceeds} />
              <ReconciliationRow label="Commission charged" value={data.movements.commission} />
              <ReconciliationRow label="Reversals and refunds" value={data.movements.reversals} />
              <ReconciliationRow label="Paid out to you" value={data.movements.payouts} />
              <ReconciliationRow label="Closing balance" value={data.closingBalance} strong />
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-neutral-500">{data.salesProceedsBasis}</p>
            <p className="mt-2 text-xs leading-relaxed text-neutral-500">
              Sales here are dated when delivery was confirmed, and exclude delivery fees. Your{' '}
              <span className="font-medium">My sales</span> figures are dated when the order was placed and
              include delivery, before commission — so the two will not match for the same month, and both
              are correct.
            </p>
          </section>

          {/* ------------------------------------------------------------------
              Every line, with the arithmetic visible.
             ------------------------------------------------------------------ */}
          <section className="rounded-lg border border-neutral-200 bg-white">
            <div className="border-b border-neutral-100 px-5 py-4">
              <h2 className="text-base font-semibold text-neutral-900">Every entry</h2>
              <p className="text-sm text-neutral-500">
                Commission is the line total times your rate, rounded to the nearest kobo, per line.
              </p>
            </div>
            {data.lines.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="Nothing in this period"
                description="Money appears here when a buyer confirms they received your goods — not when they pay. It is then held for a short clearing period before it can be paid out."
                className="border-0"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[46rem] text-sm">
                  <thead className="border-b border-neutral-100 text-left text-xs uppercase tracking-wide text-neutral-500">
                    <tr>
                      <th scope="col" className="px-5 py-3 font-medium">Date</th>
                      <th scope="col" className="px-5 py-3 font-medium">Entry</th>
                      <th scope="col" className="px-5 py-3 font-medium">Order</th>
                      <th scope="col" className="px-5 py-3 text-right font-medium">Working</th>
                      <th scope="col" className="px-5 py-3 text-right font-medium">Amount</th>
                      <th scope="col" className="px-5 py-3 text-right font-medium">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {data.lines.map((line) => (
                      <StatementRow key={line.id} line={line} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ------------------------------------------------------------------
              Payouts whose cut-off fell in this window.
             ------------------------------------------------------------------ */}
          {data.payouts.length > 0 && (
            <section className="rounded-lg border border-neutral-200 bg-white">
              <div className="border-b border-neutral-100 px-5 py-4">
                <h2 className="text-base font-semibold text-neutral-900">Payouts</h2>
                <p className="text-sm text-neutral-500">
                  Payouts run every other Monday. A batch is transferred by hand, so it is marked paid once
                  the transfer has actually gone out.
                </p>
              </div>
              <ul className="divide-y divide-neutral-100">
                {data.payouts.map((batch) => (
                  <li key={batch.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div>
                      <p className="font-medium text-neutral-900">
                        {batch.batchNumber}{' '}
                        <Badge variant={PAYOUT_BADGES[batch.status].variant}>
                          {PAYOUT_BADGES[batch.status].label}
                        </Badge>
                      </p>
                      <p className="text-xs text-neutral-500">
                        Period to {dateFormatter.format(new Date(batch.periodEnd))} · {formatNumber(batch.lineCount)}{' '}
                        entries
                        {batch.paymentReference ? ` · ref ${batch.paymentReference}` : ''}
                      </p>
                      {batch.failureReason && (
                        <p className="mt-1 text-xs text-danger-700">
                          {batch.failureReason} — these entries go back into the next payout.
                        </p>
                      )}
                    </div>
                    <p className="text-sm font-semibold tabular-nums text-neutral-900">
                      {formatNaira(batch.netAmount)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="text-xs text-neutral-400">
            Generated {dateTimeFormatter.format(new Date(data.generatedAt))} · {data.sellerName} · {data.currency}
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * One clearing tranche: the amount, the day it clears, and the day it is actually paid.
 *
 * Both dates, always, and never just the first. They are typically a week apart and a vendor
 * shown only the clearing date will expect the money that day — which is precisely the
 * expectation this row exists to correct. "Paid on or after" rather than "paid on", because a
 * payout run is started by a person: the amount is fixed by the cycle, the exact day it lands
 * is not.
 */
function TrancheRow({ tranche }: { tranche: MaturingTranche }) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-2 py-3">
      <div className="text-sm">
        <p className="text-neutral-900">
          Clears <span className="font-medium">{dateFormatter.format(new Date(tranche.maturesAt))}</span>
        </p>
        <p className="text-xs text-neutral-500">
          Paid on or after {dateFormatter.format(new Date(tranche.payableOnRunAfter))}
        </p>
      </div>
      <p className="text-sm font-semibold tabular-nums text-neutral-900">
        {formatNaira(tranche.amount)}
      </p>
    </li>
  )
}

/** One escrow-position tile. Deliberately not MetricCard — there is no previous period to diff against. */
function PositionCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'default',
}: {
  icon: typeof Wallet
  label: string
  value: string
  hint: string
  tone?: 'default' | 'warning'
}) {
  const border = tone === 'warning' ? 'border-warning-200 bg-warning-50' : 'border-neutral-200 bg-white'
  return (
    <div className={`rounded-lg border p-5 ${border}`}>
      <div className="flex items-center gap-2 text-neutral-500">
        <Icon size={16} aria-hidden />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900">{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-neutral-500">{hint}</p>
    </div>
  )
}

/**
 * One line of the reconciliation. Negative figures render with their sign rather than in
 * brackets: brackets are an accounting convention this audience may not read, and the sign
 * is what makes the column addable.
 */
function ReconciliationRow({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between py-2 ${strong ? 'font-semibold text-neutral-900' : ''}`}>
      <dt className={strong ? '' : 'text-neutral-600'}>{label}</dt>
      <dd className={`tabular-nums ${signClass(value, strong)}`}>{formatNaira(value)}</dd>
    </div>
  )
}

function StatementRow({ line }: { line: VendorStatementLine }) {
  return (
    <tr>
      <td className="whitespace-nowrap px-5 py-3 text-neutral-600">
        {dateFormatter.format(new Date(line.occurredAt))}
      </td>
      <td className="px-5 py-3">
        <span className="font-medium text-neutral-900">{LINE_LABELS[line.type]}</span>
        {line.productName && <p className="text-xs text-neutral-500">{line.productName}</p>}
        {line.memo && <p className="text-xs text-neutral-400">{line.memo}</p>}
      </td>
      <td className="whitespace-nowrap px-5 py-3 text-neutral-600">{line.orderNumber ?? '—'}</td>
      {/* The check-it-yourself column. Only commission lines have working to show; everything
          else is a figure copied from the order, so inventing a formula for them would suggest
          a calculation that never happened. */}
      <td className="whitespace-nowrap px-5 py-3 text-right text-xs text-neutral-500 tabular-nums">
        {line.basisAmount != null && line.commissionRate != null
          ? `${formatNaira(line.basisAmount)} × ${(line.commissionRate * 100).toFixed(2)}%`
          : '—'}
      </td>
      <td className={`whitespace-nowrap px-5 py-3 text-right font-medium tabular-nums ${signClass(line.amount)}`}>
        {formatNaira(line.amount)}
      </td>
      <td className="whitespace-nowrap px-5 py-3 text-right text-neutral-600 tabular-nums">
        {formatNaira(line.runningBalance)}
      </td>
    </tr>
  )
}

/**
 * Colour is a SECOND cue and never the only one — the sign is always printed. That keeps the
 * table readable in greyscale print and for a reader who cannot distinguish the two colours,
 * which on a page about somebody's money is not an optional nicety.
 */
function signClass(value: number, strong = false): string {
  if (value < 0) return 'text-danger-700'
  if (value > 0) return 'text-accent-700'
  return strong ? '' : 'text-neutral-500'
}
