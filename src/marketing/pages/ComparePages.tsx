import { Block, InTheApp, PageShell, Related, prose } from '@/marketing/components'
import { FOUNDING_OFFER } from '@/marketing/config'

/**
 * The honest comparisons (LANDING_PAGE_PLAN.md §5: `/compare/excel`, `/compare/notebook`). The real
 * alternative to Procurepaddy is not another app; it is the spreadsheet or the exercise book the
 * shop already has. Each gets credit where it is due, and the table says plainly what each can and
 * can't do.
 */

type Row = [string, string, string]

function Table({ headers, rows }: { headers: [string, string, string]; rows: Row[] }) {
  return (
    <div
      role="region"
      aria-label={`${headers[1]} compared with ${headers[2]}`}
      tabIndex={0}
      className="overflow-x-auto rounded-lg border border-neutral-200 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
    >
      <table className="w-full min-w-[36rem] text-left text-base">
        <thead className="bg-neutral-50">
          <tr>
            {headers.map((header, index) => (
              <th key={header || index} scope="col" className="px-4 py-3 font-semibold text-neutral-900">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([what, theirs, ours]) => (
            <tr key={what} className="border-t border-neutral-200">
              <th scope="row" className="px-4 py-3 font-medium text-neutral-900">
                {what}
              </th>
              <td className="px-4 py-3 text-neutral-700">{theirs}</td>
              <td className="px-4 py-3 text-neutral-900">{ours}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Faq({ items }: { items: { question: string; answer: string }[] }) {
  return (
    <div className="max-w-3xl divide-y divide-neutral-200 border-y border-neutral-200">
      {items.map((item) => (
        <div key={item.question} className="py-5">
          <h3 className="text-lg font-semibold text-neutral-900">{item.question}</h3>
          <p className="mt-2 text-neutral-700">{item.answer}</p>
        </div>
      ))}
    </div>
  )
}

export const EXCEL_FAQ = [
  {
    question: 'Can I import my Excel stock list into Procurepaddy?',
    answer:
      'Yes. Upload the file, match its columns to Procurepaddy\'s (name, pack, quantity, price), check the rows it flags, and your products are in. Founding shops can send us the file and we do it for you.',
  },
  {
    question: 'Can I still get my data out to Excel?',
    answer: 'Yes, any time: download your products, quantities and prices to Excel in one tap.',
  },
  {
    question: 'Is Excel not free?',
    answer:
      "The file is free. What it costs is the stock nobody can account for, and the hours one person spends keeping it right. If Excel works for you, keep using it; our free template makes it better.",
  },
  {
    question: 'Can several people update Procurepaddy at the same time?',
    answer:
      'Yes. Every staff member records on their own phone, at the same time, even with no network. Each change is sent once, with their name and the time on it.',
  },
]

export function CompareExcelPage() {
  return (
    <PageShell
      crumbs={[{ name: 'Procurepaddy vs Excel', path: '/compare/excel' }]}
      eyebrow="Procurepaddy vs Excel"
      title="Excel is a good file. It's not a stock system."
      source="compare-excel"
      lead={
        <p>
          Many shops keep stock in a spreadsheet, and it works, until more than one person needs it, or a number changes and
          nobody knows who changed it. Here is what each does well, honestly.
        </p>
      }
    >
      <Block>
        <Table
          headers={['', 'Excel', 'Procurepaddy']}
          rows={[
            ['Cost', 'Free if you already have Office', 'Free today; ₦10,000 a month from 1 February 2027'],
            ['Who changed a number, and when', 'Not recorded', 'Every change, with a name and a time'],
            ['Several staff recording at once', 'One person, one file at a time', 'Everyone, on their own phones'],
            ['Works with no network', 'If the file is on that computer', 'Yes, on every phone; sends itself later'],
            ['Shows what is missing', 'Only if you build the formulas', 'Count a shelf; the difference is shown straight away'],
            ['Bags, cartons and kilos', 'By hand, or with formulas', 'Set the pack once; 2 bags is 100 kg'],
            ['Staff can only do what you allow', 'Anyone with the file can change anything', 'Each person gets only what you choose'],
            ['A laptop that dies or a file that corrupts', 'The records may go with it', 'Kept safe on our servers'],
            ['Flexible: any layout you like', 'Yes, its great strength', 'No: it is built for stock and nothing else'],
          ]}
        />
      </Block>

      <Block tint>
        <div className={prose}>
          <h2>Where Excel is the right answer</h2>
          <p>
            If one person keeps the stock, works at one computer, and the shop is small enough that they can count everything
            in an afternoon, a well-kept spreadsheet is fine. Use our{' '}
            <a href="/free-inventory-template">free inventory Excel template</a>: it has a product list, a stock in and out
            log, and a count sheet.
          </p>
          <h2>Where it breaks</h2>
          <p>
            The trouble starts when stock moves faster than one person can type. Sales happen at the counter, deliveries arrive at
            the gate, and the file is on the laptop in the office. Someone writes it on paper to type in later, and later
            becomes never. Two copies of the file appear. A quantity is wrong and there is no way to see who changed it, or
            when.
          </p>
          <p>
            Excel was built for numbers, not for people. It can't tell you that Chidi recorded 10 bags at 9:14 this morning, or
            stop the new sales boy from editing the price list.
          </p>
          <h2>Moving from Excel to Procurepaddy</h2>
          <p>
            You don't start again. Procurepaddy imports the spreadsheet you already have: match your columns to ours, check the
            rows it flags, and your products and quantities are in. You can download everything back to Excel whenever you like.
          </p>
          <InTheApp>
            <p>
              Upload your Excel file in Products → Import. Procurepaddy reads names, codes, pack sizes (&ldquo;Bag · 50 kg&rdquo;),
              quantities and prices, and shows any row it can't read before anything is saved.
            </p>
          </InTheApp>
          <Related
            links={[
              ['Free inventory Excel template', '/free-inventory-template'],
              ['Keeping stock in Excel: how to do it properly', '/guides/keeping-stock-in-excel'],
              ['Procurepaddy vs a notebook', '/compare/notebook'],
              ['Pricing', '/pricing'],
            ]}
          />
        </div>
      </Block>

      <Block title="Questions people ask">
        <Faq items={EXCEL_FAQ} />
      </Block>
    </PageShell>
  )
}

export const NOTEBOOK_FAQ = [
  {
    question: 'My staff are used to writing in a book. Is the app hard to learn?',
    answer:
      'Recording stock in or out is: find the product, type the amount, done. Quick mode makes it one screen with a big keypad. Most staff learn it in five minutes, and each one only sees what you allow.',
  },
  {
    question: 'Can you put my notebook records into Procurepaddy?',
    answer:
      'Yes. Take clear photos of the pages and send them. Founding shops get their products loaded for them within 24 hours.',
  },
  {
    question: 'What if the network is bad in my shop?',
    answer:
      'Procurepaddy keeps working. Everything recorded is saved on the phone and sent the moment the network comes back, each record exactly once.',
  },
]

export function CompareNotebookPage() {
  return (
    <PageShell
      crumbs={[{ name: 'Procurepaddy vs a notebook', path: '/compare/notebook' }]}
      eyebrow="Procurepaddy vs a stock book"
      title="An exercise book can't tell you what's missing."
      source="compare-notebook"
      lead={
        <p>
          The stock book is how most Nigerian shops keep records, and it has real strengths: it is cheap, everyone understands
          it, and it never needs network. Here is where it stops, and what to do about it.
        </p>
      }
    >
      <Block>
        <Table
          headers={['', 'Exercise book', 'Procurepaddy']}
          rows={[
            ['Cost', '₦200 to ₦500', 'Free today; ₦10,000 a month from 1 February 2027'],
            ['Works with no network', 'Yes', 'Yes, and sends itself when the network returns'],
            ['Everyone understands it', 'Yes', 'Staff learn the basics in five minutes'],
            ['What is left of each product', 'Add up the pages by hand', 'Always up to date'],
            ['Who wrote an entry', 'If they signed it', 'Every change has a name and a time'],
            ['Shows what is missing', 'No', 'Count a shelf; the difference is shown straight away'],
            ['Survives water, fire or a lost book', 'No', 'Kept safe on our servers'],
            ['See your stock from home', 'Only if the book is with you', 'From any phone you log in on'],
          ]}
        />
      </Block>

      <Block tint>
        <div className={prose}>
          <h2>What the book does well</h2>
          <p>
            Nothing is faster than a pen when a customer is waiting, a book never runs out of battery, and an old storekeeper
            trusts what they wrote with their own hand. If your shop is small and you are always there, a book can be enough.
            Our free <a href="/stock-count-sheet">stock count sheet</a> makes a monthly count in the book much easier.
          </p>
          <h2>Where it fails you</h2>
          <ul>
            <li>
              <strong>It can't add up.</strong> To know what is left, someone has to total every page since the last count.
              Nobody does it until something is short.
            </li>
            <li>
              <strong>It can't say who.</strong> &ldquo;He says he sold it.&rdquo; Without a name and a time on each entry,
              you can't prove otherwise.
            </li>
            <li>
              <strong>It can be lost in a day.</strong> Rain through the roof, a fire, a book that walks away: months of
              records gone.
            </li>
            <li>
              <strong>It stays in the shop.</strong> You can't check it from the market, from home, or from another town.
            </li>
          </ul>
          <h2>Moving from the book to your phone</h2>
          <p>
            {FOUNDING_OFFER
              ? "Take photos of your product list and the last count, and send them. We type them in for you, so you don't start from zero."
              : "Type your product list in once, or import it from Excel, starting from your last count, so you don't start from zero."}{' '}
            Your staff then record on their phones instead of the book: same work, but every entry adds itself up, carries their
            name, and is safe.
          </p>
          <InTheApp>
            <p>
              Quick mode is the closest thing to the book: one screen, find the product, tap the amount on a big keypad, next.
              It works with no network, and the app shows how many records are waiting to send.
            </p>
          </InTheApp>
          <Related
            links={[
              ['How to keep stock records in a shop', '/guides/how-to-track-stock-in-a-shop'],
              ['How to stop stock going missing', '/guides/how-to-stop-stock-going-missing'],
              ['Free stock count sheet', '/stock-count-sheet'],
              ['Procurepaddy vs Excel', '/compare/excel'],
            ]}
          />
        </div>
      </Block>

      <Block title="Questions people ask">
        <Faq items={NOTEBOOK_FAQ} />
      </Block>
    </PageShell>
  )
}
