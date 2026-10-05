import type { ReactNode } from 'react'
import {
  ArrowRightLeft,
  Barcode,
  CircleCheck,
  FileSpreadsheet,
  PackageSearch,
  Scale,
  ShieldCheck,
  TriangleAlert,
  Undo2,
  UserCheck,
  WifiOff,
} from 'lucide-react'
import { Logo } from '@/components/Logo'
import { ContourLines } from '@/components/brand/ContourLines'
import { FAQ } from '@/marketing/faq'
import { FOUNDERS } from '@/marketing/founders'
import { STACK } from '@/marketing/offer'
import { WHATSAPP_NUMBER, WHATSAPP_URL } from '@/marketing/site'
import { AccountLink } from '@/marketing/islands/AccountLink'
import { HeroReceipt } from '@/marketing/islands/HeroReceipt'
import { Island } from '@/marketing/islands/Island'
import { ScarcityLine } from '@/marketing/islands/ScarcityLine'
import { SetupDialog } from '@/marketing/islands/SetupDialog'
import { StickyCta } from '@/marketing/islands/StickyCta'

/**
 * The Procurepaddy home page with the founding offer (LANDING_PAGE_PLAN.md, step 3).
 *
 * Hormozi decides what it says and in what order: one offer, one action, proof next to every ask,
 * the whole value equation in the headline, real urgency (the conversion rules). The design (§2b)
 * decides whether it's believed: the brand's navy and contour lines, Plex, the app's own receipt and
 * stamp, nothing that pulses. Static HTML; only the Islands come alive in the browser.
 */

/** The page's one action. A link to sign-up without JavaScript; with it, the two-field form. */
function Cta({ place, onNavy = false, className = '' }: { place: string; onNavy?: boolean; className?: string }) {
  return (
    <a
      href="/signup"
      data-cta={place}
      className={`inline-flex min-h-12 items-center justify-center rounded-md px-6 text-base font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${
        onNavy
          ? 'bg-white text-primary-900 hover:bg-primary-50 focus-visible:ring-white focus-visible:ring-offset-primary-900'
          : 'bg-action text-white hover:bg-action-hover focus-visible:ring-primary-500'
      } ${className}`}
    >
      Get my free setup
    </a>
  )
}

function Section({ id, label, children, className = '' }: { id?: string; label?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} aria-label={label} className={`px-4 py-16 sm:px-6 sm:py-24 ${className}`}>
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  )
}

const h2 = 'font-narrow text-3xl leading-tight font-bold tracking-tight text-balance sm:text-5xl'

const FEATURES = [
  { icon: WifiOff, title: 'No network? Keep recording.', body: 'Stock in, stock out and counts are kept on the phone and sent the moment it reconnects, each one exactly once.' },
  { icon: Scale, title: 'Bags and kilos, done right.', body: 'Set the pack once ("bag of 50 kg") and record in whichever is easier. 2 bags is 100 kg.' },
  { icon: UserCheck, title: 'Know who recorded what.', body: 'Every change carries a name and a time, and each staff member can only do what you allow.' },
  { icon: PackageSearch, title: "Find what's missing.", body: 'Count a shelf. Procurepaddy shows the difference from what was recorded, straight away.' },
  { icon: TriangleAlert, title: 'Never run out by surprise.', body: 'The products running low are on your first screen every morning, with Stock in right beside them.' },
  { icon: Barcode, title: 'Fast at the gate.', body: 'Quick mode: scan or type, tap the amount on a big keypad, next item. A USB or Bluetooth scanner works.' },
  { icon: FileSpreadsheet, title: 'Your Excel in, your Excel out.', body: 'Import your product list in minutes, and download it again any time.' },
  { icon: ArrowRightLeft, title: 'Know your real cost.', body: 'Cost per supplier, oldest stock used first, so the figure you sell against is the true one.' },
  { icon: Undo2, title: 'Made a mistake? Undo it.', body: 'A wrong stock change can be taken back within two minutes, exactly, with nothing left behind.' },
]

const COMPARISON: [string, string, string, string][] = [
  ['Who changed a number, and when', 'Nobody knows', 'No record', 'Every change, with a name and a time'],
  ['Works on your staff’s phones', 'One book, one place', 'Not really: one file', 'Yes, every phone'],
  ['Works with no network', 'Yes', 'If the file is on that computer', 'Yes, and sends later'],
  ["Shows what's missing", 'No', 'No', 'Yes: a count shows the difference'],
  ['Survives water, fire, a lost book', 'No', 'If someone backed it up', 'Yes, kept safe on our servers'],
  ['Bags and kilos', 'By hand', 'With formulas', 'Set the pack once'],
  ['Cost', '₦200–₦500', 'Free with Office', 'Free for 12 months, then ₦5,000/month'],
]

export function FoundingLanding() {
  return (
    <div className="bg-white text-neutral-900">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-40 focus:rounded-md focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      <header className="px-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 py-5">
        <a href="/" aria-label="Procurepaddy home">
          <Logo size={26} />
        </a>
        <nav aria-label="Main" className="flex items-center gap-1 text-sm">
          <a href="#how" className="hidden rounded-md px-3 py-2 font-medium text-neutral-700 hover:bg-neutral-100 md:inline">
            How it works
          </a>
          <a href="#faq" className="hidden rounded-md px-3 py-2 font-medium text-neutral-700 hover:bg-neutral-100 md:inline">
            FAQ
          </a>
          <Island name="account">
            <AccountLink />
          </Island>
          <a
            href="/signup"
            data-cta="header"
            className="hidden min-h-10 items-center rounded-md bg-action px-4 font-semibold whitespace-nowrap text-white hover:bg-action-hover sm:inline-flex"
          >
            Get my free setup
          </a>
        </nav>
        </div>
      </header>

      <main id="main">
        {/* Hero: the whole value equation, the offer, proof and urgency in one screen. */}
        <section className="px-4 pt-6 pb-16 sm:px-6 sm:pt-12 sm:pb-24">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-12">
            <div className="flex flex-col gap-5 lg:col-span-7">
              <p className="text-sm font-semibold tracking-wide text-primary-700">
                The inventory app for Nigerian shops and warehouses
              </p>
              <h1 className="font-narrow text-4xl leading-[1.03] font-bold tracking-tight text-balance sm:text-6xl">
                Know exactly what&apos;s in your shop within 24 hours, without typing in a single product.
              </h1>
              <p className="max-w-[60ch] text-lg leading-relaxed text-neutral-700">
                Send us your list and we load it. Your staff record every bag, carton and piece on their phones, even with
                no network, and you see who recorded what. Free for 12 months.
              </p>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                <Cta place="hero" />
                <a href="#how" className="text-base font-medium text-primary-700 hover:underline">
                  See how it works
                </a>
              </div>
              <p className="flex items-start gap-2 text-sm text-neutral-800">
                <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-700" aria-hidden="true" />
                We tried to break it: the app closed mid-delivery with no signal, and nothing was lost.
              </p>
              <Island name="scarcity">
                <ScarcityLine />
              </Island>
            </div>
            <div className="lg:col-span-5">
              <div className="mx-auto w-full max-w-xs rounded-[2rem] border-[10px] border-neutral-900 bg-neutral-50 p-4 shadow-paper">
                <Island name="receipt">
                  <HeroReceipt />
                </Island>
              </div>
            </div>
          </div>
        </section>

        {/* The problem, in the owner's own words. */}
        <Section label="The problem" className="bg-neutral-50">
          <h2 className={`${h2} max-w-3xl`}>Where is the stock going?</h2>
          <div className="mt-10 grid gap-10 sm:grid-cols-3">
            {[
              ['“The book got wet.”', 'And three months of records went with it.'],
              ['“He says he sold it.”', "And you can't prove he didn't."],
              ['“We ran out last week.”', 'Nobody noticed until a customer asked.'],
            ].map(([quote, aftermath]) => (
              <div key={quote}>
                <p className="font-narrow text-2xl font-bold text-neutral-900">{quote}</p>
                <p className="mt-2 text-neutral-700">{aftermath}</p>
              </div>
            ))}
          </div>
          <p className="mt-10 max-w-[60ch] text-lg text-neutral-800">
            An exercise book can&apos;t tell you what&apos;s missing. Excel can&apos;t tell you who changed it.
            Procurepaddy can.
          </p>
        </Section>

        {/* How it works: a real sequence, so numbered. */}
        <Section id="how" label="How it works">
          <h2 className={h2}>How the inventory app works</h2>
          <ol className="mt-10 grid gap-10 sm:grid-cols-3">
            {[
              ['Send us your list', 'Excel, CSV or photos of your book. We load every product and pack size within 24 hours.'],
              ['Record stock in and out', 'On your phone and your staff’s, even with no signal. It sends itself when the network comes back.'],
              ['Count a shelf', 'Procurepaddy shows the difference from what was recorded, and who recorded what since.'],
            ].map(([title, body], index) => (
              <li key={title} className="flex flex-col gap-3">
                <span className="font-mono text-sm font-semibold text-primary-600" aria-hidden="true">
                  0{index + 1}
                </span>
                <h3 className="text-xl font-semibold">{title}</h3>
                <p className="text-neutral-700">{body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10">
            <Cta place="how" />
          </div>
        </Section>

        {/* What you can do: each a real feature, a list not a card grid. */}
        <Section label="What you can do" className="bg-neutral-50">
          <h2 className={`${h2} max-w-3xl`}>Everything a shop needs to keep its stock straight</h2>
          <div className="mt-10 grid items-start gap-12 lg:grid-cols-12">
            <ul className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:col-span-8">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-4">
                  <Icon className="mt-1 h-6 w-6 shrink-0 text-primary-700" aria-hidden="true" />
                  <div>
                    <h3 className="font-semibold">{title}</h3>
                    <p className="mt-1 text-neutral-700">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
            {/* The real app, not a mock-up: a provision store's Inventory on a phone. */}
            <figure className="mx-auto w-full max-w-[18rem] lg:sticky lg:top-8 lg:col-span-4">
              <div className="overflow-hidden rounded-[2rem] border-[10px] border-neutral-900 bg-white shadow-paper">
                <img
                  src="/marketing/inventory-phone.webp"
                  width={390}
                  height={844}
                  loading="lazy"
                  decoding="async"
                  alt="Procurepaddy's Inventory on a phone: 10 products, 2 low and 1 out. Beans, Oloyin: 150 kg usable, 3 bags, marked Low. Evaporated milk: 960 pieces, 20 cartons. Rice: 1,050 kg, 21 bags."
                  className="block h-auto w-full"
                />
              </div>
              <figcaption className="mt-3 text-center text-sm text-neutral-600">A provision store&apos;s stock, on the owner&apos;s phone.</figcaption>
            </figure>
          </div>
        </Section>

        {/* Proof: a demonstration, on the brand's navy. */}
        <section aria-label="Proof" className="relative overflow-hidden bg-primary-900 px-4 py-16 text-white sm:px-6 sm:py-24">
          <ContourLines className="absolute inset-0 h-full w-full text-white/[0.07]" />
          <div className="relative mx-auto max-w-6xl">
            <h2 className={`${h2} max-w-3xl`}>We tried to break it.</h2>
            <p className="mt-4 max-w-[60ch] text-lg text-primary-100">
              Before any shop used it, we ran it through what markets and warehouses do to phones.
            </p>
            <ul className="mt-10 grid gap-10 sm:grid-cols-3">
              {[
                ['3 of 3', 'deliveries arrived, once each', 'The app was closed with three deliveries unsent and no signal. Reopened, back online: all three arrived, none twice.'],
                ['2 phones', 'counting and selling at once', 'One phone counts a shelf offline while another records a sale. The count keeps the sale.'],
                ['100,000', 'products, searched on a slow phone', 'In under a second, with no network, on a phone four times slower than a new one.'],
              ].map(([figure, caption, body]) => (
                <li key={figure}>
                  <p className="font-narrow text-4xl font-bold tabular-nums">{figure}</p>
                  <p className="mt-1 font-semibold text-primary-100">{caption}</p>
                  <p className="mt-3 text-primary-100">{body}</p>
                </li>
              ))}
            </ul>
            <div className="mt-12">
              <Cta place="proof" onNavy />
            </div>
          </div>
        </section>

        {/* The offer, printed the way the app prints a stock change: a receipt. */}
        <Section id="offer" label="The founding offer">
          <div className="grid items-start gap-12 lg:grid-cols-12">
            <div className="flex flex-col gap-5 lg:col-span-5">
              <h2 className={h2}>The Free Founding Shop Setup</h2>
              <p className="text-lg text-neutral-700">
                The first 100 shops get Procurepaddy set up for them, free for a year, at half price for life after that.
                It&apos;s limited because people do the setups: ten a week.
              </p>
              <Island name="scarcity">
                <ScarcityLine />
              </Island>
              <div>
                <Cta place="offer" />
              </div>
            </div>
            <div className="lg:col-span-7">
              <div className="relative mx-auto max-w-md rounded-sm border border-neutral-200 bg-white shadow-paper">
                <div className="h-2 border-b border-dashed border-neutral-300 bg-neutral-50" aria-hidden="true" />
                <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-neutral-300 px-5 py-4">
                  <p className="font-mono text-xs font-semibold tracking-wider text-neutral-900 uppercase">Founding shop setup</p>
                  <p className="font-mono text-xs text-neutral-500">No. 001–100</p>
                </div>
                <ul>
                  {STACK.map((line) => (
                    <li key={line.what} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-b border-dashed border-neutral-200 px-5 py-3">
                      <span className="font-medium text-neutral-900">{line.what}</span>
                      <span className="font-mono text-sm text-neutral-900 tabular-nums">{line.value}</span>
                      <span className="text-sm text-neutral-600">{line.why}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-end justify-between gap-4 px-5 pt-4 pb-6">
                  <span className="mb-1 -rotate-6 rounded-sm border-2 border-accent-700 bg-accent-50 px-2 py-0.5 font-mono text-sm font-bold tracking-widest text-accent-700">
                    FOUNDING
                  </span>
                  <div className="text-right font-mono tabular-nums">
                    <p className="text-sm text-neutral-500">
                      Value <span className="line-through">₦165,000 + ₦60,000/yr</span>
                    </p>
                    <p className="mt-1 text-neutral-900">
                      Today <span className="text-3xl font-semibold">₦0</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* The guarantees: the risk is ours. */}
        <Section label="Guarantees" className="bg-neutral-50">
          <h2 className={`${h2} max-w-3xl`}>The risk is ours, not yours</h2>
          <div className="mt-10 grid gap-10 md:grid-cols-2">
            {[
              ['The Nothing-Lost Guarantee', 'If Procurepaddy ever loses something you recorded, your next year is free.'],
              ['Working in 7 days', "If your shop isn't running on Procurepaddy within 7 days of sending us your list, we keep working with you until it is, and add 3 more free months."],
            ].map(([title, body]) => (
              <div key={title} className="flex gap-4">
                <ShieldCheck className="mt-1 h-7 w-7 shrink-0 text-accent-700" aria-hidden="true" />
                <div>
                  <h3 className="text-xl font-semibold">{title}</h3>
                  <p className="mt-2 text-neutral-700">{body}</p>
                </div>
              </div>
            ))}
          </div>
          <details className="mt-8 max-w-3xl text-sm text-neutral-700">
            <summary className="cursor-pointer font-medium text-primary-700">Read the terms</summary>
            <div className="mt-3 flex flex-col gap-3">
              <p>
                <strong>Nothing-Lost.</strong> Covers any stock in, stock out, count or product change Procurepaddy showed as
                recorded (stamped RECORDED or SYNCED). &ldquo;Lost&rdquo; means that once the device has reconnected, the
                record isn&apos;t in your history. Not covered: records on a device lost, broken or reset before it
                reconnected, and records a user undid, deleted or changed. Message us on WhatsApp within 30 days; we reply
                within 5 working days. One free year per account in any twelve months.
              </p>
              <p>
                <strong>Working in 7 days.</strong> For founding shops. &ldquo;Running&rdquo; means your products are loaded
                and you&apos;ve recorded a first stock change. The 7 days start when we have your complete list; your part is
                replying on WhatsApp and taking the 20-minute first-count call at a time we offer.
              </p>
            </div>
          </details>
          <div className="mt-10">
            <Cta place="guarantee" />
          </div>
        </Section>

        {/* The real alternative, honestly. */}
        <Section label="Comparison">
          <h2 className={`${h2} max-w-3xl`}>Inventory app vs Excel vs an exercise book</h2>
          <div
            className="mt-10 overflow-x-auto rounded-lg border border-neutral-200 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            role="region"
            aria-label="Inventory app vs Excel vs an exercise book, scrolls sideways"
            tabIndex={0}
          >
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th scope="col" className="p-4 font-medium text-neutral-600">
                    <span className="sr-only">What matters</span>
                  </th>
                  <th scope="col" className="p-4 font-semibold">Exercise book</th>
                  <th scope="col" className="p-4 font-semibold">Excel</th>
                  <th scope="col" className="bg-primary-50 p-4 font-semibold text-primary-900">Procurepaddy</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map(([row, book, excel, us]) => (
                  <tr key={row} className="border-b border-neutral-200 last:border-b-0">
                    <th scope="row" className="p-4 font-medium text-neutral-900">{row}</th>
                    <td className="p-4 text-neutral-700">{book}</td>
                    <td className="p-4 text-neutral-700">{excel}</td>
                    <td className="bg-primary-50 p-4 font-medium text-neutral-900">{us}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {FOUNDERS && (
          <Section label="Who we are" className="bg-neutral-50">
            <div className="grid items-center gap-10 md:grid-cols-12">
              <img
                src={FOUNDERS.photo.src}
                alt={FOUNDERS.photo.alt}
                width={FOUNDERS.photo.width}
                height={FOUNDERS.photo.height}
                loading="lazy"
                className="h-auto w-full rounded-lg md:col-span-5"
              />
              <div className="md:col-span-7">
                <h2 className={h2}>Who we are</h2>
                <p className="mt-5 text-lg text-neutral-800">{FOUNDERS.note}</p>
                <p className="mt-4 text-neutral-600">
                  {FOUNDERS.people.map((person) => `${person.name}, ${person.role}`).join(' · ')}
                </p>
              </div>
            </div>
          </Section>
        )}

        {/* The last objections. */}
        <Section id="faq" label="Questions">
          <h2 className={h2}>Questions shop owners ask</h2>
          <div className="mt-10 flex max-w-3xl flex-col gap-3">
            {FAQ.map((item, index) => (
              <details key={item.question} open={index === 0} className="group rounded-lg border border-neutral-200 bg-white px-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold">
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
        </Section>

        {/* The final call. */}
        <section aria-label="Get started" className="relative overflow-hidden bg-primary-900 px-4 py-16 text-white sm:px-6 sm:py-24">
          <ContourLines className="absolute inset-0 h-full w-full text-white/[0.07]" />
          <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-6">
            <h2 className={`${h2} max-w-3xl`}>Your stock, counted and on your phone, this week.</h2>
            <Cta place="final" onNavy />
            <Island name="scarcity" props={{ tone: 'dark' }}>
              <ScarcityLine tone="dark" />
            </Island>
            <p className="text-primary-100">Or keep counting in the book. It&apos;s free too, until something goes missing.</p>
          </div>
        </section>

        <div className="px-4 py-10 sm:px-6">
          <p className="mx-auto max-w-6xl text-neutral-700">
            Running a large warehouse or a distribution business?{' '}
            <a
              href={`${WHATSAPP_URL}?text=${encodeURIComponent('Hello Procurepaddy, I would like to talk about Procurepaddy Business.')}`}
              className="font-semibold text-primary-700 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Talk to us about Procurepaddy Business
            </a>
          </p>
        </div>
      </main>

      <footer className="border-t border-neutral-200 px-4 py-10 pb-28 sm:px-6 sm:pb-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 text-sm text-neutral-600">
          <Logo size={20} />
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
            <a href="#how" className="hover:text-neutral-900 hover:underline">How it works</a>
            <a href="#faq" className="hover:text-neutral-900 hover:underline">FAQ</a>
            <a href="/login" className="hover:text-neutral-900 hover:underline">Log in</a>
            <a href={WHATSAPP_URL} className="hover:text-neutral-900 hover:underline" target="_blank" rel="noreferrer">
              WhatsApp {WHATSAPP_NUMBER}
            </a>
          </nav>
          <p>© 2026 Procurepaddy</p>
        </div>
      </footer>

      <Island name="sticky">
        <StickyCta />
      </Island>
      <Island name="setup">
        <SetupDialog />
      </Island>
    </div>
  )
}
