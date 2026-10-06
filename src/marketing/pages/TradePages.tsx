import { Block, InTheApp, PageShell, Related, prose } from '@/marketing/components'
import { FOUNDING_OFFER } from '@/marketing/config'
import { ShopResults } from '@/marketing/ShopResults'
import type { TRADE_SLUGS } from '@/marketing/paths'

/**
 * The `/for/` pages (LANDING_PAGE_PLAN.md §5): one per trade, each written for that trade, "never the
 * same page with a word swapped". Every claim is a feature that exists; what doesn't exist yet for a
 * trade (expiry dates for pharmacies, several warehouses for distributors) is said plainly.
 */

type Slug = (typeof TRADE_SLUGS)[number]

export interface Trade {
  slug: Slug
  /** For the breadcrumb and the footer: "Provision stores". */
  name: string
  metaTitle: string
  metaDescription: string
  eyebrow: string
  title: string
  lead: string
  /** The real pains of this trade, in the owner's words. */
  pains: [string, string][]
  /** How Procurepaddy answers each, with the feature that does it. */
  answers: [string, string][]
  /** Products as this trade records them: name, how it comes, how it's counted. */
  examples: [string, string, string][]
  /** What Procurepaddy doesn't do for this trade yet, said before anyone has to ask. */
  notYet?: string
  faq: { question: string; answer: string }[]
  related: [string, string][]
}

export const TRADES: Trade[] = [
  {
    slug: 'provision-stores',
    name: 'Provision stores',
    metaTitle: 'Inventory App for Provision Stores in Nigeria | Procurepaddy',
    metaDescription:
      'Keep stock in your provision store on your phone: cartons and pieces, bags and kilos, who sold what, and what is running low. Works offline.',
    eyebrow: 'For provision stores',
    title: 'Know what is on every shelf of your provision store.',
    lead: 'Hundreds of small items, cartons opened and sold by the piece, and staff on the counter all day. Procurepaddy keeps the count for you on your phone, even when the network is down.',
    pains: [
      ['“The carton was opened, and now nobody knows how many are left.”', 'Noodles come in cartons and go out by the piece. A book can’t keep both straight.'],
      ['“We ran out of sugar and I only found out when a customer asked.”', 'The fast movers run out first, and nobody is watching all of them.'],
      ['“I can’t be in the shop all day.”', 'When you’re at the market buying stock, you have no idea what is happening at the counter.'],
    ],
    answers: [
      ['Cartons and pieces, both right', 'Set the pack once (“carton of 40”) and record a delivery in cartons and a sale in pieces. Procurepaddy keeps one true count.'],
      ['What is running low, every morning', 'Give each product a low-stock level. The products at or under it are on your first screen, with Stock in beside them.'],
      ['Your shop on your phone, wherever you are', 'Every sale, delivery and count your staff record shows on your phone, with who recorded it and when.'],
      ['Count one shelf in minutes', 'Type what is really on the shelf; Procurepaddy shows the difference from what was recorded, straight away.'],
    ],
    examples: [
      ['Indomie Chicken', 'Carton of 40', 'pieces'],
      ['Rice (Mama Gold)', 'Bag of 50 kg', 'kg'],
      ['Peak Milk (tin)', 'Carton of 48', 'pieces'],
      ['Groundnut oil', 'Keg of 25 litres', 'litres'],
    ],
    faq: [
      {
        question: 'Can my sales girl use it without training?',
        answer: 'Recording a sale is: find the product, type the amount, done. Quick mode puts it on one screen with a big keypad. Most staff have it in five minutes.',
      },
      {
        question: 'I sell some things loose, like rice by the kilo.',
        answer: 'Record the delivery in bags and the sale in kilos. Set “bag of 50 kg” once, and 2 bags in means 100 kg in stock.',
      },
      {
        question: 'Does it work as a till?',
        answer: 'No. Procurepaddy is stock control: what came in, what went out, who did it and what’s left. Keep your POS or your receipts book for payments.',
      },
    ],
    related: [
      ['How to track stock in a shop', '/guides/how-to-track-stock-in-a-shop'],
      ['Bags, cartons and pieces: units without confusion', '/guides/bags-cartons-and-pieces'],
      ['Reorder levels explained', '/guides/reorder-levels-explained'],
      ['Procurepaddy vs a notebook', '/compare/notebook'],
    ],
  },
  {
    slug: 'supermarkets',
    name: 'Supermarkets',
    metaTitle: 'Supermarket Inventory Management Software in Nigeria | Procurepaddy',
    metaDescription:
      'Control your supermarket store room: deliveries by supplier, issues to the shop floor, shelf counts and shrinkage, with a barcode scanner. Works offline.',
    eyebrow: 'For supermarkets',
    title: 'Supermarket stock control without a back-office team.',
    lead: 'Thousands of products, deliveries from a dozen suppliers, and a store room that feeds the shelves. Procurepaddy tracks every carton from the delivery van to the shop floor, and every count after it.',
    pains: [
      ['“Stock goes missing between the store room and the shelf.”', 'Shrinkage hides in the gap nobody records: the store room issues, the floor sells, and the numbers never meet.'],
      ['“Which supplier did that come from, and at what price?”', 'Prices change with every delivery. Without the cost per supplier, your margin is a guess.'],
      ['“Counting the whole shop takes a weekend.”', 'So it happens twice a year, and by then the loss is old news.'],
    ],
    answers: [
      ['Every move signed', 'Deliveries in, issues to the floor, counts: each with the name of who did it and when. Staff get only the actions you allow.'],
      ['Cost per supplier, oldest stock first', 'Record who each delivery came from and what you paid. Procurepaddy uses the oldest stock first, so the cost you sell against is the true one.'],
      ['Count one section at a time', 'Count a shelf or an aisle today, another tomorrow. Each count shows the difference immediately, so shrinkage is found in days, not months.'],
      ['Fast at the receiving door', 'Quick mode with a USB or Bluetooth barcode scanner: scan, type the amount, next. It searches 100,000 products in under a second, even on a slow phone.'],
    ],
    examples: [
      ['Coca-Cola 50cl', 'Pack of 12', 'bottles'],
      ['Golden Penny Semovita 1 kg', 'Bale of 10', 'pieces'],
      ['Hypo bleach 1 litre', 'Carton of 12', 'bottles'],
      ['Sugar 500 g', 'Bag of 20', 'pieces'],
    ],
    notYet:
      'Procurepaddy doesn’t connect to your POS yet, so sales at the till aren’t recorded in it automatically. Supermarkets use it for the store room: what suppliers deliver, what goes out to the shelves, and regular shelf counts. Scanning is with a USB or Bluetooth scanner, not the phone’s camera.',
    faq: [
      {
        question: 'Can we import our existing product list with barcodes?',
        answer: 'Yes. Import your Excel list with names, codes, barcodes, pack sizes and quantities. Founding shops can send the file and we load it for you.',
      },
      {
        question: 'How many products can it handle?',
        answer: 'We test it with 100,000 products on a slow phone: search answers in under a second, offline.',
      },
      {
        question: 'Can the store-room staff change prices?',
        answer: 'Only if you let them. Each person gets the actions you choose, for example record deliveries and issues, but not edit products or adjust counts.',
      },
    ],
    related: [
      ['How to stop stock going missing', '/guides/how-to-stop-stock-going-missing'],
      ['FIFO for small shops', '/guides/fifo-for-small-shops'],
      ['How to do a stock count', '/guides/how-to-do-a-stock-count'],
      ['Pricing', '/pricing'],
    ],
  },
  {
    slug: 'pharmacies',
    name: 'Pharmacies',
    metaTitle: 'Pharmacy Stock Management App in Nigeria | Procurepaddy',
    metaDescription:
      'Pharmacy stock records on your phone: packs and units, who took what, low-stock levels and counts your staff can’t quietly change. Works offline.',
    eyebrow: 'For pharmacies',
    title: 'Pharmacy stock records your staff can’t quietly change.',
    lead: 'Small, valuable items in packs and strips, and a counter that never stops. Procurepaddy records every pack in and every unit out with a name on it, and only you decide who can adjust a count.',
    pains: [
      ['“A few packs go missing every month, and I can’t say who.”', 'High value in small packages is easy to lose and hard to trace.'],
      ['“We sell strips, but buy in boxes.”', 'Counting boxes and selling strips by hand means the numbers never agree.'],
      ['“We ran out of an everyday drug on a busy day.”', 'Patients go elsewhere, and some don’t come back.'],
    ],
    answers: [
      ['A name on every change', 'Every pack received, every unit sold and every count carries who did it and when. A wrong figure can be traced to the minute.'],
      ['Only you adjust the count', 'Give the counter staff stock out, the store keeper deliveries, and keep counts and product edits for yourself.'],
      ['Boxes in, units out', 'Set the pack once (“box of 10 strips”). Receive in boxes, sell in strips; one true count.'],
      ['Low-stock levels', 'Set a level for every product you can’t run out of. Those at or under it are on your first screen each morning.'],
    ],
    examples: [
      ['Paracetamol 500 mg', 'Box of 10 strips', 'strips'],
      ['Amoxicillin 500 mg', 'Box of 100 capsules', 'capsules'],
      ['ORS sachets', 'Carton of 50', 'sachets'],
      ['Hand sanitiser 500 ml', 'Carton of 24', 'bottles'],
    ],
    notYet:
      'Procurepaddy doesn’t track expiry dates or batch numbers yet. Pharmacies use it for counts, low stock and who-took-what alongside their own expiry checks. If expiry tracking is what you need most, tell us on WhatsApp: it decides what we build next.',
    faq: [
      {
        question: 'Can I stop staff from editing quantities?',
        answer: 'Yes. Counts and product edits can be kept for the owner. Staff record only the movements you allow, and every one is signed.',
      },
      {
        question: 'Does it replace my pharmacy software?',
        answer: 'Procurepaddy is stock control, not dispensing or patient records. It works alongside whatever you use at the counter.',
      },
      {
        question: 'What if the network drops during a busy hour?',
        answer: 'Keep recording. Everything is kept on the phone and sent once the network is back, each record exactly once.',
      },
    ],
    related: [
      ['How to stop stock going missing', '/guides/how-to-stop-stock-going-missing'],
      ['Bags, cartons and pieces: units without confusion', '/guides/bags-cartons-and-pieces'],
      ['How to do a stock count', '/guides/how-to-do-a-stock-count'],
      ['Procurepaddy vs Excel', '/compare/excel'],
    ],
  },
  {
    slug: 'building-materials',
    name: 'Building materials',
    metaTitle: 'Inventory App for Building Materials Shops in Nigeria | Procurepaddy',
    metaDescription:
      'Track cement, rods, tiles and paint by the bag, the piece, the carton and the litre. Record deliveries at the gate, even with no network. Know who moved what.',
    eyebrow: 'For building materials',
    title: 'Track cement, rods and tiles the way you sell them.',
    lead: 'Cement by the bag, rods by the piece, tiles by the carton, paint by the litre or the keg, and a yard where the network comes and goes. Procurepaddy records it all at the gate, on your phone.',
    pains: [
      ['“The truck count and the yard count never agree.”', 'Deliveries are counted in a hurry, and nobody writes down who counted.'],
      ['“Prices change every week.”', 'Cement bought at three different prices makes your real cost a guess.'],
      ['“Things leave the yard at night.”', 'Heavy goods in an open yard need a count you can trust, and a record of who moved what.'],
    ],
    answers: [
      ['Record at the gate, network or not', 'Record the delivery as the truck is offloaded, even with no signal. It sends itself when the phone reconnects.'],
      ['Real cost, with oldest stock first', 'Record what each delivery cost. Procurepaddy uses the oldest stock first, so the cost behind each sale is the one you actually paid.'],
      ['A name on everything that moves', 'Every bag in, every piece out, every count: who and when. Give loaders only what they need.'],
      ['Count the yard', 'Count a stack and see the difference from the record straight away.'],
    ],
    examples: [
      ['Dangote cement', 'Bag of 50 kg', 'bags'],
      ['Iron rod 12 mm', 'Bundle of 10', 'pieces'],
      ['Floor tiles 60 × 60', 'Carton of 4', 'pieces'],
      ['Emulsion paint', 'Bucket of 20 litres', 'litres'],
    ],
    faq: [
      {
        question: 'Can I sell part of a bundle or a carton?',
        answer: 'Yes. Set the pack once (“bundle of 10”), receive in bundles and sell in pieces. The count stays right.',
      },
      {
        question: 'What if two people record at the same time?',
        answer: 'They can. Each person records on their own phone; every record arrives once, with their name on it.',
      },
      {
        question: 'Can it work in a yard with no network?',
        answer: 'Yes. Procurepaddy keeps recording offline and shows how many records are waiting to send.',
      },
    ],
    related: [
      ['How to know your real cost price', '/guides/how-to-know-your-real-cost-price'],
      ['Stock records without internet', '/guides/stock-records-without-internet'],
      ['Bags, cartons and pieces: units without confusion', '/guides/bags-cartons-and-pieces'],
      ['Pricing', '/pricing'],
    ],
  },
  {
    slug: 'wholesalers',
    name: 'Wholesalers and distributors',
    metaTitle: 'Wholesale & Distribution Inventory Software in Nigeria | Procurepaddy',
    metaDescription:
      'Wholesale stock control on your phone: deliveries against what suppliers promised, every carton in and out with a name on it, 100,000 products, works offline.',
    eyebrow: 'For wholesalers and distributors',
    title: 'Every carton in and out, with a name on it.',
    lead: 'High volumes, many loaders, suppliers who deliver short, and customers who buy by the hundred. Procurepaddy keeps the warehouse count right, with every move signed.',
    pains: [
      ['“The supplier says he delivered 200; we counted 190.”', 'Short deliveries are only caught if someone checks against what was ordered.'],
      ['“Loaders, drivers, sales reps: too many hands.”', 'When everyone touches the stock, nobody is responsible for it.'],
      ['“My best-selling product ran out before the truck came.”', 'Running out of the line that pays the bills costs more than any software.'],
    ],
    answers: [
      ['Receive against what was promised', 'Record what a supplier is sending as an expected delivery, then receive against it. Short is short, on the record.'],
      ['Everyone signed, each with their own access', 'Every record has a name and a time. Give each person only the actions their job needs.'],
      ['Big lists, still fast', 'Tested with 100,000 products on a slow phone: search in under a second, offline.'],
      ['Reorder before you run out', 'Set a low-stock level for the lines that matter; they are on your first screen each morning.'],
    ],
    examples: [
      ['Indomie Onion', 'Carton of 40', 'cartons'],
      ['Golden Penny Spaghetti', 'Bale of 20', 'pieces'],
      ['Peak Milk sachet', 'Carton of 210', 'sachets'],
      ['Power Oil 3 litres', 'Carton of 6', 'bottles'],
    ],
    notYet:
      'Today each account keeps one stock location. If you run several warehouses, Procurepaddy Business is building it first with our founding Business clients; talk to us before you decide.',
    faq: [
      {
        question: 'Is there a plan for larger businesses?',
        answer: 'Yes: Procurepaddy Business, with a named person on WhatsApp who replies within an hour in working hours, setup and training, and your feature requests reviewed every month. See the pricing page.',
      },
      {
        question: 'Can we import our product list?',
        answer: 'Yes, from Excel. Names, codes, barcodes, pack sizes, suppliers, quantities and prices.',
      },
      {
        question: 'Can I see the warehouse from my office?',
        answer: 'Yes. Everything recorded in the warehouse shows on your phone or laptop as it happens, with who recorded it.',
      },
    ],
    related: [
      ['Pricing, including Business', '/pricing'],
      ['Reorder levels explained', '/guides/reorder-levels-explained'],
      ['How to stop stock going missing', '/guides/how-to-stop-stock-going-missing'],
      ['How to do a stock count', '/guides/how-to-do-a-stock-count'],
    ],
  },
]

export function TradePage({ trade }: { trade: Trade }) {
  return (
    <PageShell
      crumbs={[{ name: trade.name, path: `/for/${trade.slug}` }]}
      eyebrow={trade.eyebrow}
      title={trade.title}
      source={`for-${trade.slug}`}
      lead={<p>{trade.lead}</p>}
      hero={
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-5">
          <p className="text-sm font-semibold text-neutral-900">How {trade.name.toLowerCase()} record stock in Procurepaddy</p>
          <table className="mt-3 w-full text-left text-sm">
            <thead>
              <tr className="text-neutral-600">
                <th scope="col" className="py-1.5 pr-3 font-medium">
                  Product
                </th>
                <th scope="col" className="py-1.5 pr-3 font-medium">
                  Comes in
                </th>
                <th scope="col" className="py-1.5 font-medium">
                  Counted in
                </th>
              </tr>
            </thead>
            <tbody>
              {trade.examples.map(([product, pack, unit]) => (
                <tr key={product} className="border-t border-neutral-200">
                  <td className="py-1.5 pr-3 text-neutral-900">{product}</td>
                  <td className="py-1.5 pr-3 text-neutral-700">{pack}</td>
                  <td className="py-1.5 text-neutral-700">{unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
    >
      <Block title="Sound familiar?" tint>
        <div className="grid gap-8 sm:grid-cols-3">
          {trade.pains.map(([quote, body]) => (
            <div key={quote}>
              <p className="font-narrow text-xl font-bold text-neutral-900">{quote}</p>
              <p className="mt-2 text-neutral-700">{body}</p>
            </div>
          ))}
        </div>
      </Block>

      <Block title={`How Procurepaddy works for ${trade.name.toLowerCase()}`}>
        <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {trade.answers.map(([title, body]) => (
            <div key={title}>
              <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
              <p className="mt-2 text-neutral-700">{body}</p>
            </div>
          ))}
        </div>
        {trade.notYet && (
          <div className="mt-10 max-w-3xl rounded-lg border border-warning-200 bg-warning-50 p-5 text-warning-900">
            <p className="font-semibold">What it doesn’t do yet</p>
            <p className="mt-1">{trade.notYet}</p>
          </div>
        )}
      </Block>

      <ShopResults trade={trade.slug} title={`${trade.name} using Procurepaddy`} />

      <Block title="Questions people ask" tint>
        <div className="max-w-3xl divide-y divide-neutral-200 border-y border-neutral-200">
          {trade.faq.map((item) => (
            <div key={item.question} className="py-5">
              <h3 className="text-lg font-semibold text-neutral-900">{item.question}</h3>
              <p className="mt-2 text-neutral-700">{item.answer}</p>
            </div>
          ))}
        </div>
        <div className={prose}>
          <InTheApp>
            {FOUNDING_OFFER ? (
              <p>
                Send us your product list (Excel, CSV or photos of your book) and we load every product, pack size and opening
                stock for you. Then your staff record on their own phones from day one.
              </p>
            ) : (
              <p>
                Import your product list from Excel in minutes, with pack sizes and opening stock. Then your staff record on their
                own phones from day one.
              </p>
            )}
          </InTheApp>
          <Related links={trade.related} />
        </div>
      </Block>
    </PageShell>
  )
}
