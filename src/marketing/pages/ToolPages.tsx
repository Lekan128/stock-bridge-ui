import { Download, FileSpreadsheet, Printer } from 'lucide-react'
import { Block, InTheApp, PageShell, Related, prose } from '@/marketing/components'

/**
 * The two lead magnets (LANDING_PAGE_PLAN.md §5): genuinely useful on their own, and the first step
 * of the next one. The inventory template is the exact file Procurepaddy imports (built by
 * `scripts/lead-magnets/build.py` from the API's own template), so a shop that outgrows it uploads
 * it as it is. No email asked for: the file is the hook, not a form.
 */

export const TEMPLATE_FILE = '/downloads/procurepaddy-inventory-template.xlsx'
export const COUNT_SHEET_FILE = '/downloads/procurepaddy-stock-count-sheet.xlsx'

function DownloadButton({ href, label, size }: { href: string; label: string; size: string }) {
  return (
    <a
      href={href}
      download
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border-2 border-primary-900 px-5 text-base font-semibold text-primary-900 hover:bg-primary-50 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
    >
      <Download className="h-5 w-5" aria-hidden="true" />
      {label}
      <span className="text-sm font-normal text-neutral-600">({size})</span>
    </a>
  )
}

export function FreeTemplatePage() {
  return (
    <PageShell
      crumbs={[{ name: 'Free inventory Excel template', path: '/free-inventory-template' }]}
      eyebrow="Free download · no email needed"
      title="Free inventory Excel template for your shop"
      source="template"
      lead={
        <p>
          A stock spreadsheet that works the way a Nigerian shop does: products that come in bags and cartons, a log of every
          delivery and sale with who recorded it, and a count sheet that shows what is missing.
        </p>
      }
      hero={
        <div className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-6">
          <FileSpreadsheet className="h-10 w-10 text-accent-700" aria-hidden="true" />
          <p className="font-semibold text-neutral-900">procurepaddy-inventory-template.xlsx</p>
          <ul className="list-disc pl-5 text-sm text-neutral-700">
            <li>Products: name, how it comes, size of one, quantity, price, reorder level</li>
            <li>Stock in and out: date, product, in or out, how many, who recorded it</li>
            <li>Count sheet: should be, counted, and the difference worked out for you</li>
          </ul>
          <DownloadButton href={TEMPLATE_FILE} label="Download the template" size="Excel, 13 KB" />
          <p className="text-xs text-neutral-600">Works in Excel, Google Sheets and WPS Office on a phone.</p>
        </div>
      }
    >
      <Block tint>
        <div className={prose}>
          <h2>How to use it</h2>
          <ol>
            <li>
              <strong>Fill in Products once.</strong> One row per product. Say how you buy it (&ldquo;Bag&rdquo;, &ldquo;Carton&rdquo;)
              and what is inside one (&ldquo;50 kg&rdquo;, &ldquo;12 x 750 ml&rdquo;). The tab &ldquo;How to fill this in&rdquo;
              explains every column.
            </li>
            <li>
              <strong>Record every movement the same day.</strong> Each delivery and each sale or issue is one line in
              &ldquo;Stock in and out&rdquo;, with the name of whoever recorded it.
            </li>
            <li>
              <strong>Count one shelf a week.</strong> Print the count sheet, count, and type what you found. The difference
              column tells you what is missing.
            </li>
          </ol>
          <h2>Three rules that keep it right</h2>
          <ul>
            <li>A record without a name can&apos;t be checked. Always write who.</li>
            <li>Keep one copy of the file. Two copies means two different answers.</li>
            <li>Small differences found weekly are easy to explain. Big ones found at year end are not.</li>
          </ul>
          <h2>When the spreadsheet gets too much</h2>
          <p>
            A spreadsheet needs one person at one computer. When your staff need to record at the counter and the gate at the
            same time, or the network is down, it stops keeping up. This template is the exact format Procurepaddy imports:
            upload it and every product, pack size and quantity is in, then each staff member records on their own phone.
          </p>
          <InTheApp>
            <p>
              Products → Import → choose this file. Procurepaddy reads the Products tab, ignores the example rows, and shows any
              row it can&apos;t read before anything is saved.
            </p>
          </InTheApp>
          <Related
            links={[
              ['Keeping stock in Excel: how to do it properly', '/guides/keeping-stock-in-excel'],
              ['Free stock count sheet', '/stock-count-sheet'],
              ['Procurepaddy vs Excel', '/compare/excel'],
            ]}
          />
        </div>
      </Block>
    </PageShell>
  )
}

const COUNT_ROWS = 18

/** The count sheet itself, printable straight from the page (print styles hide everything else). */
function PrintableSheet() {
  return (
    <div className="count-sheet rounded-lg border border-neutral-200 bg-white p-6 print:border-0 print:p-0">
      <p className="font-narrow text-2xl font-bold text-primary-900">Stock count</p>
      <div className="mt-3 grid gap-x-6 gap-y-3 text-sm text-neutral-800 sm:grid-cols-3">
        {['Shop', 'Shelf or area', 'Date', 'Counted by', 'Checked by'].map((field) => (
          <p key={field} className="flex items-end gap-2">
            <span className="shrink-0">{field}:</span>
            <span className="h-5 flex-1 border-b border-neutral-400" aria-hidden="true" />
          </p>
        ))}
      </div>
      <div role="region" aria-label="Count sheet" tabIndex={0} className="relative mt-4 overflow-x-auto focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none">
        <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
          <thead>
            <tr className="bg-primary-900 text-white print:bg-white print:text-black">
              {['Product', 'Counted in', 'Should be', 'Counted', 'Difference', 'Note'].map((header) => (
                <th key={header} scope="col" className="border border-neutral-300 px-2 py-2 font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: COUNT_ROWS }, (_, row) => (
              <tr key={row} className="h-9">
                {Array.from({ length: 6 }, (_, cell) => (
                  <td key={cell} className="border border-neutral-300 px-2">
                    <span className="sr-only">{cell === 0 ? `Row ${row + 1}` : ''}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-neutral-600">Free from procurepaddy.com · Count one shelf a week, not the whole shop twice a year.</p>
    </div>
  )
}

export function CountSheetPage() {
  return (
    <PageShell
      crumbs={[{ name: 'Stock count sheet', path: '/stock-count-sheet' }]}
      eyebrow="Free download · print it or use it in Excel"
      title="Free stock count sheet (stocktaking template)"
      source="count-sheet"
      lead={
        <p>
          Print it, count one shelf, and see what is missing. The Excel version works out the difference for you and turns
          anything short red.
        </p>
      }
    >
      <Block>
        <div className="flex flex-wrap gap-3 print:hidden">
          <DownloadButton href={COUNT_SHEET_FILE} label="Download for Excel" size="7 KB" />
          <a
            href="#sheet"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-neutral-300 px-5 text-base font-semibold text-neutral-900 hover:bg-neutral-50"
          >
            <Printer className="h-5 w-5" aria-hidden="true" />
            Print the sheet below
          </a>
        </div>
        <p className="mt-2 text-sm text-neutral-600 print:hidden">
          To print: scroll to the sheet and use your browser&apos;s Print (Ctrl+P, or Share → Print on a phone).
        </p>
        <div id="sheet" className="mt-8">
          <PrintableSheet />
        </div>
      </Block>

      <Block tint>
        <div className={prose}>
          <h2>How to count with it</h2>
          <ol>
            <li>Pick one shelf or one area. Not the whole shop.</li>
            <li>Before you start, write what your records say should be there, in &ldquo;Should be&rdquo;.</li>
            <li>Count what is really there, in the unit you wrote (bags, cartons, pieces).</li>
            <li>Counted minus should be is the difference. A minus means something is missing.</li>
            <li>Write who counted and who checked. Then explain every difference the same day, while people remember.</li>
          </ol>
          <p>
            The full method, including what to do about a difference, is in our guide{' '}
            <a href="/guides/how-to-do-a-stock-count">how to do a stock count</a>.
          </p>
          <InTheApp>
            <p>
              Count a shelf on your phone: type what is really there, and Procurepaddy shows the difference from the record
              straight away, with your name and the time on the count. It works with no network.
            </p>
          </InTheApp>
          <Related
            links={[
              ['How to do a stock count', '/guides/how-to-do-a-stock-count'],
              ['How to stop stock going missing', '/guides/how-to-stop-stock-going-missing'],
              ['Free inventory Excel template', '/free-inventory-template'],
            ]}
          />
        </div>
      </Block>
    </PageShell>
  )
}
