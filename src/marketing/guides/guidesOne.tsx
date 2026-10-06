import { InTheApp } from '@/marketing/components'
import type { Guide } from '@/marketing/guides/types'

/**
 * Guides 1 to 5 (LANDING_PAGE_PLAN.md §5, "ten guides at launch"). Each answers the question in its
 * title completely, on paper or in Excel, before it says a word about the app: the reader came for
 * the method. Nigerian shops, naira, bags and cartons; no statistics we can't source.
 */

export const howToTrackStock: Guide = {
  slug: 'how-to-track-stock-in-a-shop',
  title: 'How to track stock in a shop: a simple system that works',
  description:
    'A practical way to keep stock records in a Nigerian shop: one product list, every movement written the same day with a name, and a weekly count.',
  lead: 'Most stock problems are not theft or bad luck. They are records that stopped matching the shelf weeks ago. Here is a system any shop can run, with a book, a spreadsheet or an app.',
  updated: '2026-10-06',
  minutes: 7,
  body: (
    <>
      <h2>The three things every stock system needs</h2>
      <p>Whatever you keep your records in, they only work if they have these three parts:</p>
      <ol>
        <li>
          <strong>A product list.</strong> Every item you sell, written the same way every time, with how it comes (bag,
          carton, piece) and how many you had when you started.
        </li>
        <li>
          <strong>A record of every movement.</strong> Every delivery in, every sale or issue out, written the same day, with
          the name of whoever did it.
        </li>
        <li>
          <strong>A regular count.</strong> Someone counts what is really on the shelf and compares it with what the records
          say.
        </li>
      </ol>
      <p>
        Skip any one and the other two stop meaning anything. A product list with no movements is a wish. Movements with no
        count are never checked. A count with no records has nothing to compare against.
      </p>

      <h2>Step 1: write one product list</h2>
      <p>
        Give every product one name and use it everywhere. &ldquo;Rice&rdquo; is not enough if you sell two brands and two bag
        sizes: write &ldquo;Rice (Mama Gold) 50 kg&rdquo; and &ldquo;Rice (Royal Stallion) 25 kg&rdquo;. For each product,
        write:
      </p>
      <ul>
        <li>how you buy it (bag, carton, pack) and what is inside one (50 kg, 40 pieces, 12 bottles);</li>
        <li>how you sell it, if that is different (by the piece, by the kilo);</li>
        <li>how many you have today: your opening stock.</li>
      </ul>
      <p>
        That last number matters most, and it needs a real count. Our guide on{' '}
        <a href="/guides/opening-stock-how-to-start-your-records">opening stock</a> explains how to do it without closing the
        shop.
      </p>

      <h2>Step 2: record every movement, the same day, with a name</h2>
      <p>One line for every delivery and every sale or issue:</p>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Product</th>
            <th>In</th>
            <th>Out</th>
            <th>By</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>5 Oct</td>
            <td>Rice (Mama Gold) 50 kg</td>
            <td>10 bags</td>
            <td></td>
            <td>Chidi</td>
          </tr>
          <tr>
            <td>5 Oct</td>
            <td>Rice (Mama Gold) 50 kg</td>
            <td></td>
            <td>2 bags</td>
            <td>Amaka</td>
          </tr>
        </tbody>
      </table>
      <p>
        Two rules make this work. <strong>Same day</strong>, because &ldquo;I&apos;ll write it later&rdquo; becomes never.{' '}
        <strong>With a name</strong>, because a line nobody owns can&apos;t be checked. When the count is short, the names tell
        you who to ask.
      </p>

      <h2>Step 3: count a little, often</h2>
      <p>
        Counting the whole shop twice a year means differences are months old when you find them, and nobody remembers what
        happened. Count one shelf or one area every week instead. In a month you have counted everything, and every
        difference is small and fresh enough to explain.
      </p>
      <p>
        For each product counted: what the records say should be there, what is actually there, and the difference. Our{' '}
        <a href="/stock-count-sheet">free stock count sheet</a> is laid out for exactly this, and{' '}
        <a href="/guides/how-to-do-a-stock-count">how to do a stock count</a> covers the method.
      </p>

      <h2>Step 4: know what to reorder</h2>
      <p>
        Once the records are right, give your fast movers a reorder level: the quantity at which you buy more. When a product
        reaches it, it goes on the shopping list. <a href="/guides/reorder-levels-explained">Reorder levels explained</a> shows
        how to set one.
      </p>

      <h2>Book, spreadsheet or app?</h2>
      <p>
        All three can run this system. A book is cheap and needs no network, but someone must add up every page to know what is
        left. A spreadsheet adds up for you, but only one person can use it at a time, on one computer. An app on your
        staff&apos;s phones lets everyone record at once, adds up as they go, and puts a name on every line automatically. Start
        with whichever you will actually keep up.
      </p>
      <InTheApp>
        <p>
          The product list, the movements and the counts are all one place. Each staff member records on their own phone, even
          with no network; every record carries their name and the time; and what is left is always up to date. A count shows
          the difference straight away.
        </p>
      </InTheApp>
    </>
  ),
  related: [
    ['How to do a stock count', '/guides/how-to-do-a-stock-count'],
    ['Opening stock: how to start your records', '/guides/opening-stock-how-to-start-your-records'],
    ['Free inventory Excel template', '/free-inventory-template'],
  ],
}

export const howToCount: Guide = {
  slug: 'how-to-do-a-stock-count',
  title: 'How to do a stock count (stocktaking) in your shop',
  description:
    'Step-by-step stocktaking for a shop or warehouse: count by area, compare with records, explain every difference the same day. With a free count sheet.',
  lead: 'A stock count is the only way to know whether your records are true. Done right, it takes minutes a day, not a closed weekend. Here is how.',
  updated: '2026-10-06',
  minutes: 6,
  body: (
    <>
      <h2>Count a little, often</h2>
      <p>
        The traditional stocktake closes the shop, counts everything, and finds a big difference nobody can explain. A better
        habit is the <strong>rolling count</strong>: one shelf, one aisle or one area at a time, a few times a week. Over a
        month everything is counted, the shop never closes, and each difference is small and recent.
      </p>
      <p>
        Count the expensive and the fast-moving items most often: they are where money disappears fastest.
      </p>

      <h2>Before you count</h2>
      <ol>
        <li>
          <strong>Pick the area.</strong> &ldquo;Shelf 3, provisions&rdquo;, &ldquo;the cement stack in the yard&rdquo;.
        </li>
        <li>
          <strong>Write what the records say.</strong> For each product in the area, the quantity your book or spreadsheet says
          should be there. If you use a sheet, fill this column first.
        </li>
        <li>
          <strong>Agree the unit.</strong> Bags or kilos? Cartons or pieces? Write the unit beside each product so nobody counts
          cartons while the record is in pieces.
        </li>
        <li>
          <strong>Pause movements for that area</strong> while you count it. A sale halfway through a count makes the
          difference meaningless.
        </li>
      </ol>

      <h2>Counting</h2>
      <ul>
        <li>
          Count what you can see and touch. Opened cartons count as pieces; sealed cartons count as cartons times what is inside.
        </li>
        <li>
          Have one person count and another check the high-value lines. Write both names on the sheet.
        </li>
        <li>Count anything damaged or expired separately and write it in the notes.</li>
      </ul>

      <h2>After counting: the difference</h2>
      <p>
        Difference = counted &minus; should be. A minus means something is missing; a plus usually means a delivery or a sale
        was never written down.
      </p>
      <p>Explain every difference the same day, while people remember. The usual reasons, in order:</p>
      <ol>
        <li>A sale or delivery that was not recorded.</li>
        <li>A wrong unit: cartons recorded as pieces, or the other way round.</li>
        <li>Damage or spoilage that was thrown away without a record.</li>
        <li>Stock that left without being sold.</li>
      </ol>
      <p>
        Fix what you can explain, record the rest as an adjustment with a note, and correct the records so the next count
        starts from the truth. Our guide <a href="/guides/how-to-stop-stock-going-missing">how to stop stock going missing</a>{' '}
        covers what to do when the same product keeps coming up short.
      </p>

      <h2>A count sheet that makes it easy</h2>
      <p>
        Use one sheet per area, with columns for product, unit, should be, counted, difference and a note, and space for who
        counted and who checked. Ours is free: <a href="/stock-count-sheet">download the stock count sheet</a> or print it from
        the page.
      </p>
      <InTheApp>
        <p>
          Open a product, choose Count, and type what is really on the shelf. Procurepaddy shows the difference from the record
          straight away and saves the count with your name and the time, even with no network. If two phones count and sell at
          the same moment, the count keeps the sale.
        </p>
      </InTheApp>
    </>
  ),
  related: [
    ['Free stock count sheet', '/stock-count-sheet'],
    ['How to stop stock going missing', '/guides/how-to-stop-stock-going-missing'],
    ['Opening stock: how to start your records', '/guides/opening-stock-how-to-start-your-records'],
  ],
}

export const stopMissing: Guide = {
  slug: 'how-to-stop-stock-going-missing',
  title: 'How to stop stock going missing in your shop',
  description:
    'Why stock goes missing in Nigerian shops and warehouses, how to find where, and the habits that stop it: names on every record, limited access, weekly counts.',
  lead: 'Missing stock is rarely one big theft. It is many small leaks nobody can see: an unrecorded sale, a wrong unit, a carton that walked. You can’t stop what you can’t see, so first make it visible.',
  updated: '2026-10-06',
  minutes: 7,
  body: (
    <>
      <h2>Where stock really goes</h2>
      <p>When a count comes up short, the cause is usually one of these, and most are not theft:</p>
      <ul>
        <li>
          <strong>Unrecorded sales.</strong> A busy afternoon, a customer waiting, &ldquo;I&apos;ll write it later&rdquo;.
        </li>
        <li>
          <strong>Unit mistakes.</strong> A carton of 40 recorded as 1 piece, or 2 bags sold as 2 kg.
        </li>
        <li>
          <strong>Short deliveries.</strong> The supplier&apos;s note says 200 cartons; 190 came off the truck; nobody counted.
        </li>
        <li>
          <strong>Damage thrown away.</strong> Torn bags, broken bottles, expired items removed without a record.
        </li>
        <li>
          <strong>Theft.</strong> It happens, but it is far easier to see once the other four are under control.
        </li>
      </ul>

      <h2>Habit 1: a name on every record</h2>
      <p>
        &ldquo;He says he sold it.&rdquo; Without a name and a time on each entry, you can&apos;t prove otherwise. When everyone
        knows their name is on what they record, careless mistakes drop, and the person who knows what happened is obvious.
      </p>

      <h2>Habit 2: count deliveries at the gate</h2>
      <p>
        Count every delivery before the driver leaves, against the supplier&apos;s note or what you ordered. Write what actually
        came, not what the note says. A short delivery found a week later is your loss; found at the gate it is the
        supplier&apos;s.
      </p>

      <h2>Habit 3: give each person only what their job needs</h2>
      <p>
        The person who sells should not be the person who adjusts the count. If one person can both take stock out and change
        the records, they can hide anything. Split the jobs: counter staff record sales, the storekeeper records deliveries,
        and only you (or a trusted manager) adjusts counts and prices.
      </p>

      <h2>Habit 4: count small and often</h2>
      <p>
        A weekly count of one area finds a leak in days. A yearly count finds a loss nobody can trace. See{' '}
        <a href="/guides/how-to-do-a-stock-count">how to do a stock count</a>.
      </p>

      <h2>Habit 5: look for patterns</h2>
      <p>When the same product keeps coming up short, ask:</p>
      <ul>
        <li>Is it always on the same shift, or after the same person&apos;s entries?</li>
        <li>Is it a product sold loose from a pack (where unit mistakes happen)?</li>
        <li>Is it always after deliveries from the same supplier?</li>
      </ul>
      <p>
        The answer is usually in the records, if the records have names, times and units. That is the point of keeping them
        properly.
      </p>

      <h2>What to do about a difference</h2>
      <ol>
        <li>Check the records for a missing sale or delivery, and for unit mistakes.</li>
        <li>Ask the people whose names are on the last entries. Calmly, the same day.</li>
        <li>Record what you can&apos;t explain as an adjustment with a note, so the records are true again.</li>
        <li>If it repeats, change who can do what, and count that product more often.</li>
      </ol>
      <InTheApp>
        <p>
          Every stock change carries the name and time of whoever made it, and each staff member can only do what you allow (for
          example record deliveries but not counts). Count a shelf and the difference shows straight away. A wrong entry can be
          undone within two minutes.
        </p>
      </InTheApp>
    </>
  ),
  related: [
    ['How to do a stock count', '/guides/how-to-do-a-stock-count'],
    ['Bags, cartons and pieces: units without confusion', '/guides/bags-cartons-and-pieces'],
    ['Procurepaddy vs a notebook', '/compare/notebook'],
  ],
}

export const openingStock: Guide = {
  slug: 'opening-stock-how-to-start-your-records',
  title: 'Opening stock: how to start your stock records properly',
  description:
    'How to take opening stock in a shop without closing for a day: list your products, count area by area, and start every record from a true number.',
  lead: 'Every stock record starts with one number: what you had on the day you began. Get it wrong and every figure after it is wrong too. Here is how to get it right without closing the shop.',
  updated: '2026-10-06',
  minutes: 5,
  body: (
    <>
      <h2>What opening stock is</h2>
      <p>
        Opening stock is the quantity of each product on the day your records start. From then on, what is left is simply:
        opening stock + everything in &minus; everything out. So the opening number has to be counted, not guessed.
      </p>

      <h2>Step 1: list every product first</h2>
      <p>
        Walk the shop and the store with a notebook or phone and write every product, the way you will always name it, with how
        it comes and what is inside one. Do the list before any counting: counting while listing is how products get missed.
      </p>
      <p>
        Already have a list in Excel or from a supplier? Start from it and add what is missing. Our{' '}
        <a href="/free-inventory-template">free template</a> has the columns ready.
      </p>

      <h2>Step 2: count area by area</h2>
      <p>
        You don&apos;t need to close. Split the shop into areas (each shelf, the store room, the yard) and count one area at a time,
        at quiet hours or before opening. Write the date and time of each area&apos;s count.
      </p>
      <ul>
        <li>Count sealed packs as packs (10 bags, 4 cartons) and opened ones as loose units (37 pieces).</li>
        <li>Two people for the expensive lines: one counts, one writes, then swap and check.</li>
      </ul>

      <h2>Step 3: catch what moved while you counted</h2>
      <p>
        If you sell from an area after counting it, record those sales from that moment on. If a delivery arrives before its
        area is counted, count it as part of the area (don&apos;t also record it as a delivery). The rule: every item is counted
        exactly once.
      </p>

      <h2>Step 4: write it down and start recording</h2>
      <p>
        Enter each product&apos;s count as its opening stock, and from that day record every delivery and sale with a name. Do
        your first check count of a fast mover within a week: if it matches, the system works.
      </p>
      <InTheApp>
        <p>
          Import your list with quantities and they become each product&apos;s opening stock, recorded as such (never as a
          delivery). Founding shops can send us the list, or photos of the book, and we load it within 24 hours, then do the
          first count with you on a video call.
        </p>
      </InTheApp>
    </>
  ),
  related: [
    ['How to track stock in a shop', '/guides/how-to-track-stock-in-a-shop'],
    ['How to do a stock count', '/guides/how-to-do-a-stock-count'],
    ['Free inventory Excel template', '/free-inventory-template'],
  ],
}

export const reorderLevels: Guide = {
  slug: 'reorder-levels-explained',
  title: 'Reorder levels explained: never run out of your best sellers',
  description:
    'How to set a reorder level for each product: daily sales × days until the next delivery, plus a safety margin. Worked examples for Nigerian shops.',
  lead: 'Running out of the product everyone asks for costs you the sale, and sometimes the customer. A reorder level tells you when to buy, before it’s too late.',
  updated: '2026-10-06',
  minutes: 5,
  body: (
    <>
      <h2>What a reorder level is</h2>
      <p>
        A reorder level (or low-stock level) is the quantity at which you buy more. When a product drops to it, it goes on the
        shopping list. Set it high enough that the new stock arrives before the old runs out.
      </p>

      <h2>The simple formula</h2>
      <p>
        <strong>Reorder level = what you sell in a day &times; days until a new delivery arrives + a safety margin.</strong>
      </p>
      <p>
        Example: you sell about 6 cartons of noodles a day. When you order, the supplier delivers in 3 days. 6 &times; 3 = 18
        cartons will sell while you wait. Add a margin for a busy day, say 2 days&apos; worth (12 cartons). Reorder level: 30
        cartons.
      </p>

      <h2>Working out what you sell in a day</h2>
      <p>
        Take a normal month&apos;s sales of the product from your records and divide by the days you were open. If your records
        aren&apos;t reliable yet, use a week you watched closely. Don&apos;t use a festive season; set a separate, higher level
        for December.
      </p>

      <h2>How big a safety margin?</h2>
      <ul>
        <li>Reliable supplier, steady sales: one day&apos;s worth.</li>
        <li>Supplier sometimes late, or sales jump on market days: two or three days&apos; worth.</li>
        <li>
          Products you must never run out of (the one people come for): be generous. Running out costs more than holding
          extra.
        </li>
      </ul>

      <h2>Not everything needs one</h2>
      <p>
        Set levels for your fast movers and your essentials first, perhaps 20 to 50 products. Slow items you buy once a quarter
        can be checked at your regular count.
      </p>

      <h2>Make it a habit</h2>
      <p>
        A reorder level only helps if someone looks. Check the low list every morning before you call suppliers, and review the
        levels every few months as your sales change.
      </p>
      <InTheApp>
        <p>
          Give any product a low-stock level. Every morning, the products at or under it are on your dashboard under
          &ldquo;Needs you today&rdquo;, with Stock in right beside them for when the delivery comes.
        </p>
      </InTheApp>
    </>
  ),
  related: [
    ['How to track stock in a shop', '/guides/how-to-track-stock-in-a-shop'],
    ['FIFO for small shops', '/guides/fifo-for-small-shops'],
    ['For provision stores', '/for/provision-stores'],
  ],
}
