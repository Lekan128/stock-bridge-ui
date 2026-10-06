import { Check } from 'lucide-react'
import { Block, PageShell, PrimaryCta } from '@/marketing/components'
import { FOUNDING_OFFER } from '@/marketing/config'
import { Island } from '@/marketing/islands/Island'
import { LossCalculator } from '@/marketing/islands/LossCalculator'
import { FOUNDING_PRICE, OFFER_ENDS_ON, REGULAR_PRICE, formatDay } from '@/marketing/offer'
import { WHATSAPP_URL } from '@/marketing/site'

const naira = (amount: number) => `₦${amount.toLocaleString('en-NG')}`

/**
 * The questions about price that stop a decision (LANDING_PAGE_PLAN.md §5, `/pricing`). Every
 * answer is a decision the owners made on 2026-10-05; nothing here is promised that isn't staffed.
 */
export const PRICING_FAQ = [
  {
    question: 'When do I start paying?',
    answer: `Not before ${formatDay(OFFER_ENDS_ON)}. Until then Procurepaddy is free for every shop. From that day the Shop plan is ${naira(REGULAR_PRICE)} a month; founding shops keep 12 months free from when they joined, then pay ${naira(FOUNDING_PRICE)} a month for as long as they stay.`,
  },
  {
    question: 'Do you charge for each staff member?',
    answer: 'No. Every plan includes every staff member, on their own phone, with their own login.',
  },
  {
    question: 'Will I be charged without knowing?',
    answer: `No. Nothing is charged automatically. Before ${formatDay(OFFER_ENDS_ON)} we will tell you exactly how to pay, and you decide.`,
  },
  {
    question: 'Can I stop any time?',
    answer: 'Yes. There is no contract. Download your products to Excel whenever you like; they are yours.',
  },
  {
    question: 'I have more than one shop or warehouse. Which plan?',
    answer:
      'Today each account keeps one stock location. Several branches or warehouses in one account is being built with our first Business clients. Talk to us on WhatsApp and we will tell you honestly what works today.',
  },
]

function Feature({ children }: { children: string }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="mt-1 h-4 w-4 shrink-0 text-accent-700" aria-hidden="true" />
      <span>{children}</span>
    </li>
  )
}

function talkToUs(plan: string): string {
  return `${WHATSAPP_URL}?text=${encodeURIComponent(
    `Hello Procurepaddy, I'd like to talk about ${plan}.\nProducts we stock: \nBranches or warehouses: \nStaff who record stock: \nSales in a month (roughly): `,
  )}`
}

/** `/pricing`: Custom and Business first, as the anchor; then the Shop plan, which is what most visitors need. */
export function PricingPage() {
  return (
    <PageShell
      crumbs={[{ name: 'Pricing', path: '/pricing' }]}
      eyebrow="Pricing"
      title="Free today. One price for the whole shop after that."
      source="pricing"
      lead={
        <p>
          Procurepaddy is free for every shop until {formatDay(OFFER_ENDS_ON)}. After that the Shop plan is {naira(REGULAR_PRICE)}{' '}
          a month, with every feature and every staff member included.
          {FOUNDING_OFFER && ` The first 100 founding shops get 12 months free from the day they join, then ${naira(FOUNDING_PRICE)} a month for life.`}
        </p>
      }
    >
      <Block>
        <div className="grid gap-5 lg:grid-cols-3">
          <article className="flex flex-col rounded-lg border border-neutral-200 p-6">
            <h2 className="text-lg font-semibold text-neutral-900">Custom</h2>
            <p className="mt-1 text-sm text-neutral-600">An app built around how your business works.</p>
            <p className="mt-5 font-narrow text-3xl font-bold tabular-nums">
              From ₦1,000,000<span className="text-base font-normal text-neutral-600"> a month</span>
            </p>
            <ul className="mt-5 flex flex-1 flex-col gap-2 text-sm text-neutral-800">
              <Feature>Starts with a paid discovery: we learn how your business runs before we build</Feature>
              <Feature>Your screens, your reports, your workflow</Feature>
              <Feature>Everything in Business</Feature>
            </ul>
            <a
              href={talkToUs('a custom Procurepaddy')}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-300 px-4 font-semibold text-neutral-900 hover:bg-neutral-50"
            >
              Talk to us
            </a>
          </article>

          <article className="flex flex-col rounded-lg border border-neutral-200 p-6">
            <h2 className="text-lg font-semibold text-neutral-900">Business</h2>
            <p className="mt-1 text-sm text-neutral-600">For large warehouses and distributors.</p>
            <p className="mt-5 font-narrow text-3xl font-bold tabular-nums">
              ₦200,000<span className="text-base font-normal text-neutral-600"> a month</span>
            </p>
            <ul className="mt-5 flex flex-1 flex-col gap-2 text-sm text-neutral-800">
              <Feature>A named person on WhatsApp, 8am to 6pm Monday to Saturday, answering within 1 hour</Feature>
              <Feature>Live in 7 days, or your first month is free</Feature>
              <Feature>We load your products and train your staff</Feature>
              <Feature>Your feature requests reviewed with you every month, and the top one scheduled</Feature>
            </ul>
            <p className="mt-5 rounded-md bg-primary-50 px-3 py-2 text-sm text-primary-900">
              Founding Business: our first 3 clients pay ₦100,000 a month for 6 months, in return for a case study and a
              reference call.
            </p>
            <a
              href={talkToUs('Procurepaddy Business')}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-300 px-4 font-semibold text-neutral-900 hover:bg-neutral-50"
            >
              Talk to us
            </a>
          </article>

          <article className="flex flex-col rounded-lg border-2 border-primary-900 p-6">
            <h2 className="text-lg font-semibold text-neutral-900">Shop</h2>
            <p className="mt-1 text-sm text-neutral-600">For shops, supermarkets, pharmacies and stores.</p>
            <p className="mt-5 font-narrow text-3xl font-bold tabular-nums">
              {naira(REGULAR_PRICE)}
              <span className="text-base font-normal text-neutral-600"> a month from {formatDay(OFFER_ENDS_ON)}</span>
            </p>
            <p className="mt-1 text-sm font-semibold text-accent-800">
              {FOUNDING_OFFER
                ? `Founding shops: 12 months free, then ${naira(FOUNDING_PRICE)} a month for life`
                : `Free until ${formatDay(OFFER_ENDS_ON)}`}
            </p>
            <ul className="mt-5 flex flex-1 flex-col gap-2 text-sm text-neutral-800">
              <Feature>Every feature, every staff member, on their own phones</Feature>
              <Feature>Works with no network; nothing recorded is lost</Feature>
              <Feature>Bags, cartons and kilos; counts that show what is missing</Feature>
              <Feature>Know who recorded what, and give each person only what they need</Feature>
              {FOUNDING_OFFER ? (
                <Feature>We load your products for you within 24 hours</Feature>
              ) : (
                <Feature>Import your Excel list in minutes</Feature>
              )}
            </ul>
            <PrimaryCta place="pricing-shop" className="mt-6" />
          </article>
        </div>
        <p className="mt-6 max-w-3xl text-sm text-neutral-600">
          Prices in naira. Business and Custom are paid by bank transfer against an invoice. Today each account keeps one
          stock location; several branches in one account is being built with our first Business clients.
        </p>
      </Block>

      <Block title="What does missing stock cost you?" tint>
        <div className="grid items-start gap-8 lg:grid-cols-2">
          <div className="max-w-[60ch] text-lg leading-relaxed text-neutral-800">
            <p>
              Compare Procurepaddy with what goes missing, not with other software. A shop selling ₦3 million a month that
              loses 1% loses ₦30,000 a month: three times the Shop plan.
            </p>
            <p className="mt-4">
              You can't stop what you can't see. A count that shows the difference, and a record of who changed what, is how
              the leak is found.
            </p>
          </div>
          <Island name="loss" props={{ price: REGULAR_PRICE }}>
            <LossCalculator price={REGULAR_PRICE} />
          </Island>
        </div>
      </Block>

      <Block title="Pricing questions">
        <div className="max-w-3xl divide-y divide-neutral-200 border-y border-neutral-200">
          {PRICING_FAQ.map((item) => (
            <details key={item.question} className="group py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-lg font-semibold text-neutral-900">
                {item.question}
                <span className="font-mono text-lg text-primary-600 group-open:hidden" aria-hidden="true">
                  +
                </span>
                <span className="hidden font-mono text-lg text-primary-600 group-open:inline" aria-hidden="true">
                  −
                </span>
              </summary>
              <p className="pb-5 text-neutral-700">{item.answer}</p>
            </details>
          ))}
        </div>
      </Block>
    </PageShell>
  )
}
