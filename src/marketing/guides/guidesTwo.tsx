import { InTheApp } from '@/marketing/components'
import type { Guide } from '@/marketing/guides/types'

/** Guides 6 to 10. Same rules as guidesOne.tsx: the method first, the app last, nothing invented. */

export const fifo: Guide = {
  slug: 'fifo-for-small-shops',
  title: 'FIFO for small shops: sell the oldest stock first',
  description:
    'First in, first out (FIFO) for Nigerian shops: why selling the oldest stock first protects your money, how to arrange shelves, and what it does to your cost.',
  lead: 'FIFO means first in, first out: the stock that arrived first leaves first. It keeps goods from going stale and it tells you what your stock really cost.',
  updated: '2026-10-06',
  minutes: 5,
  body: (
    <>
      <h2>Why the oldest stock should go first</h2>
      <ul>
        <li>
          <strong>Nothing gets old at the back.</strong> Milk, flour, drinks and drugs have dates. Stock that sits behind newer
          stock expires there.
        </li>
        <li>
          <strong>Packaging stays fresh.</strong> Even goods that don&apos;t expire fade, tear and gather dust.
        </li>
        <li>
          <strong>Your cost is honest.</strong> When prices rise, the old stock was cheaper. Selling it first, and costing it at
          what you actually paid, shows your true profit.
        </li>
      </ul>

      <h2>FIFO on the shelf</h2>
      <ol>
        <li>When a delivery arrives, move the old stock to the front and put the new stock behind it.</li>
        <li>Write the arrival date on cartons and bags with a marker. It takes seconds and settles every argument.</li>
        <li>In the store room, keep each product in one place, oldest at the door.</li>
        <li>Check dated goods at every count, and sell or return anything close to its date first.</li>
      </ol>

      <h2>FIFO in your records: what stock really cost</h2>
      <p>
        Say you bought 10 bags of rice at ₦40,000 and then, when the price rose, 10 more at ₦45,000. You sell 12 bags. With FIFO
        the first 10 sold cost ₦40,000 each and the next 2 cost ₦45,000:
      </p>
      <table>
        <thead>
          <tr>
            <th>Bags sold</th>
            <th>Cost each</th>
            <th>Cost</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>10</td>
            <td>₦40,000</td>
            <td>₦400,000</td>
          </tr>
          <tr>
            <td>2</td>
            <td>₦45,000</td>
            <td>₦90,000</td>
          </tr>
          <tr>
            <td>
              <strong>12</strong>
            </td>
            <td></td>
            <td>
              <strong>₦490,000</strong>
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        The 8 bags left are the ₦45,000 ones, worth ₦360,000. If you priced everything on the newest cost, you would think the
        first 12 cost ₦540,000 and understate your profit; on the oldest cost you would overstate it. FIFO gives the real
        figure. See <a href="/guides/how-to-know-your-real-cost-price">how to know your real cost price</a>.
      </p>
      <InTheApp>
        <p>
          Record what each delivery cost and who it came from. Procurepaddy uses the oldest stock first when it works out the
          cost of what you sell, so the cost behind each sale is the price you actually paid.
        </p>
      </InTheApp>
    </>
  ),
  related: [
    ['How to know your real cost price', '/guides/how-to-know-your-real-cost-price'],
    ['Reorder levels explained', '/guides/reorder-levels-explained'],
    ['For supermarkets', '/for/supermarkets'],
  ],
}

export const units: Guide = {
  slug: 'bags-cartons-and-pieces',
  title: 'Bags, cartons and pieces: stock units without confusion',
  description:
    'How to keep stock right when you buy in bags and cartons but sell by the kilo or the piece: one stock unit, a pack size, and conversions done once.',
  lead: 'You buy rice by the 50 kg bag and sell it by the kilo. Noodles come in cartons of 40 and leave one piece at a time. Mixed units are the most common reason stock records stop adding up.',
  updated: '2026-10-06',
  minutes: 5,
  body: (
    <>
      <h2>The problem</h2>
      <p>
        If one person writes &ldquo;2&rdquo; meaning bags and another writes &ldquo;2&rdquo; meaning kilos, the record is wrong by
        a factor of 50. Nobody notices until the count, and by then nobody knows which entries were which.
      </p>

      <h2>The fix: one stock unit per product</h2>
      <p>
        For every product, pick the <strong>smallest unit you sell it in</strong> and keep the stock in that unit. Rice sold by
        the kilo is kept in kilos. Noodles sold by the piece are kept in pieces. Cement sold only by the bag is kept in bags.
      </p>
      <p>
        Then write down the <strong>pack</strong> once: what one bag, carton or bundle contains.
      </p>
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Pack</th>
            <th>Stock kept in</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Rice (Mama Gold)</td>
            <td>Bag of 50 kg</td>
            <td>kg</td>
          </tr>
          <tr>
            <td>Noodles</td>
            <td>Carton of 40</td>
            <td>pieces</td>
          </tr>
          <tr>
            <td>Groundnut oil</td>
            <td>Keg of 25 litres</td>
            <td>litres</td>
          </tr>
          <tr>
            <td>Cement</td>
            <td>Bag of 50 kg</td>
            <td>bags (sold whole)</td>
          </tr>
        </tbody>
      </table>

      <h2>Recording deliveries and sales</h2>
      <ul>
        <li>
          A delivery of 10 bags of rice is recorded as 10 &times; 50 = <strong>500 kg</strong>.
        </li>
        <li>
          A sale of 3 kg is recorded as <strong>3 kg</strong>.
        </li>
        <li>
          At the count, an opened bag is weighed or estimated in kilos, and sealed bags are counted and multiplied.
        </li>
      </ul>
      <p>
        Always write the unit beside the number: &ldquo;10 bags&rdquo;, never just &ldquo;10&rdquo;. It is the one habit that
        prevents most unit mistakes.
      </p>

      <h2>When the supplier changes the pack</h2>
      <p>
        If a supplier starts sending cartons of 36 instead of 40, that is a different pack. Write it as a new line (&ldquo;carton
        of 36&rdquo;) rather than changing the old one, so last month&apos;s deliveries still add up.
      </p>
      <InTheApp>
        <p>
          Set the pack once (&ldquo;bag of 50 kg&rdquo;). Record a delivery in bags and a sale in kilos, whichever is easier;
          Procurepaddy converts, so 2 bags in means 100 kg in stock. A product can have a different pack for each supplier.
        </p>
      </InTheApp>
    </>
  ),
  related: [
    ['How to do a stock count', '/guides/how-to-do-a-stock-count'],
    ['For building materials', '/for/building-materials'],
    ['For provision stores', '/for/provision-stores'],
  ],
}

export const costPrice: Guide = {
  slug: 'how-to-know-your-real-cost-price',
  title: 'How to know your real cost price (and your real profit)',
  description:
    'Work out what your stock really cost when supplier prices change every week: record cost per delivery, include transport, and use the oldest stock first.',
  lead: 'Prices change with every delivery. If you price your goods on last month’s cost, or on a guess, your profit is a guess too. Here is how to know what each item really cost you.',
  updated: '2026-10-06',
  minutes: 6,
  body: (
    <>
      <h2>Record the cost of every delivery</h2>
      <p>
        For each delivery write: the supplier, how many, and what you paid for one pack. Not &ldquo;about ₦40,000&rdquo;: the
        exact figure on the invoice or what you transferred.
      </p>

      <h2>Include what it cost to get it here</h2>
      <p>
        Transport, loading, a market levy: if you pay it to get the goods into your shop, it is part of the cost. Spread it over
        the delivery. ₦20,000 transport on 40 bags adds ₦500 to each bag.
      </p>

      <h2>Work in the unit you sell</h2>
      <p>
        A ₦45,000 bag of rice sold by the kilo costs ₦45,000 &divide; 50 = ₦900 per kg. A ₦9,600 carton of 40 noodles costs ₦240
        per piece. Your selling price should be set against that unit cost, not the bag price.
      </p>

      <h2>When you hold stock bought at different prices</h2>
      <p>There are two common ways to cost it:</p>
      <ul>
        <li>
          <strong>Oldest first (FIFO).</strong> What you sell is costed at the price of the oldest stock still on hand, then the
          next. It matches how stock actually leaves a well-kept shelf. See{' '}
          <a href="/guides/fifo-for-small-shops">FIFO for small shops</a>.
        </li>
        <li>
          <strong>Average.</strong> Add up what all the stock on hand cost and divide by the quantity. Simpler by hand, but it
          blurs price rises.
        </li>
      </ul>
      <p>Pick one and stick to it; switching between them makes month-to-month comparisons meaningless.</p>

      <h2>Profit per item</h2>
      <p>
        Profit = selling price &minus; real unit cost. If rice costs you ₦900 a kilo landed and you sell at ₦1,100, you make ₦200 a
        kilo, before rent and salaries. Check this for your top sellers whenever a supplier changes its price: it is how
        shops lose money without noticing.
      </p>

      <h2>Compare suppliers on the real number</h2>
      <p>
        The supplier with the lowest price per bag is not always the cheapest once transport, short deliveries and credit
        terms are counted. Keep the cost per supplier and compare like for like.
      </p>
      <InTheApp>
        <p>
          Record each delivery with its supplier and what you paid. Procurepaddy keeps the cost per supplier and uses the oldest
          stock first, so the cost behind each sale is the price you actually paid, in the unit you sell it.
        </p>
      </InTheApp>
    </>
  ),
  related: [
    ['FIFO for small shops', '/guides/fifo-for-small-shops'],
    ['Bags, cartons and pieces', '/guides/bags-cartons-and-pieces'],
    ['For building materials', '/for/building-materials'],
  ],
}

export const excel: Guide = {
  slug: 'keeping-stock-in-excel',
  title: 'Keeping stock in Excel: how to do it properly',
  description:
    'How to set up an inventory spreadsheet that stays right: a product list, a movements log, a count sheet, and the habits that stop it going wrong. Free template.',
  lead: 'Excel is where many shops start, and it can work well, if it is set up properly and kept up the same way every day. Here is the setup that holds up.',
  updated: '2026-10-06',
  minutes: 6,
  body: (
    <>
      <h2>Use three tabs, not one</h2>
      <p>The most common mistake is one big sheet where quantities are typed over. Use three tabs instead:</p>
      <ol>
        <li>
          <strong>Products</strong>: one row per product, with name, pack, opening stock, cost and reorder level.
        </li>
        <li>
          <strong>Movements</strong>: one row per delivery or sale: date, product, in, out, unit, who.
        </li>
        <li>
          <strong>Counts</strong>: what should be there, what was counted, and the difference.
        </li>
      </ol>
      <p>
        On the Products tab, what is left = opening stock + the sum of that product&apos;s ins &minus; the sum of its outs. A
        SUMIF over the Movements tab does it: <code>=C2+SUMIF(Movements!B:B,A2,Movements!C:C)-SUMIF(Movements!B:B,A2,Movements!D:D)</code>.
        Never type over a quantity again; add a movement instead, so there is always a record of why it changed.
      </p>
      <p>
        Our <a href="/free-inventory-template">free inventory template</a> has all three tabs ready, with notes on every
        column.
      </p>

      <h2>Rules that keep the file right</h2>
      <ul>
        <li>
          <strong>One file, one place.</strong> Keep it in one shared folder. A copy on a laptop and a copy on a flash drive
          means two different answers.
        </li>
        <li>
          <strong>Names from a list.</strong> Use the exact product name from the Products tab every time (a drop-down
          helps), or SUMIF will miss rows.
        </li>
        <li>
          <strong>Always write who.</strong> A column for the person who recorded each line.
        </li>
        <li>
          <strong>Back it up weekly</strong>, somewhere other than the computer it lives on.
        </li>
      </ul>

      <h2>Where Excel stops keeping up</h2>
      <p>
        Excel works while one person, at one computer, can type everything the same day. It strains when staff at the counter
        and the gate need to record at the same time, when the network or the power goes and the file is on the office laptop,
        or when you need to know who changed a quantity (Excel doesn&apos;t record that). That is usually the moment to move
        to an app, and you don&apos;t have to retype anything to do it.
      </p>
      <InTheApp>
        <p>
          The free template is the exact format Procurepaddy imports. Upload it and every product, pack and quantity is in;
          then each staff member records on their own phone, even with no network, and every change carries their name.
        </p>
      </InTheApp>
    </>
  ),
  related: [
    ['Free inventory Excel template', '/free-inventory-template'],
    ['Procurepaddy vs Excel', '/compare/excel'],
    ['How to track stock in a shop', '/guides/how-to-track-stock-in-a-shop'],
  ],
}

export const offline: Guide = {
  slug: 'stock-records-without-internet',
  title: 'Keeping stock records when there’s no internet',
  description:
    'How to keep stock records right in a market, a warehouse or a yard with poor network: record at the moment, never twice, and let the records catch up.',
  lead: 'In the market, the back store or the yard, the network comes and goes. Stock doesn’t wait for it. Here is how to keep records right when the connection doesn’t.',
  updated: '2026-10-06',
  minutes: 5,
  body: (
    <>
      <h2>Record at the moment, wherever you are</h2>
      <p>
        The biggest risk in a no-network spot is not the network: it is &ldquo;I&apos;ll record it when I&apos;m back at the
        desk&rdquo;. By then the details are gone. Whatever you use, it must let you record where the stock moves: at the gate,
        in the store room, at the counter.
      </p>

      <h2>On paper</h2>
      <p>
        A notebook works anywhere. Keep one at each place stock moves, write every movement with the time and your name, and
        copy the pages into your main records the same day. Tick each line as you copy it, so nothing is entered twice or
        missed.
      </p>

      <h2>With an app</h2>
      <p>Not every app works offline. Before you trust one in a dead zone, check three things:</p>
      <ol>
        <li>
          <strong>Does it keep what you record when there is no network,</strong> and send it by itself later? Some apps just
          show an error and lose it.
        </li>
        <li>
          <strong>Does it show what is still waiting to send?</strong> You need to know, without guessing, that the three
          deliveries you recorded haven&apos;t arrived yet.
        </li>
        <li>
          <strong>Does a record ever arrive twice?</strong> If the network drops while saving and you press save again, a good
          app still records it once.
        </li>
      </ol>
      <p>
        Test it yourself: switch on airplane mode, record two things, close the app completely, open it again, switch the
        network back on, and check both arrived, once each.
      </p>

      <h2>Habits that help</h2>
      <ul>
        <li>Find the dead zones in your shop and warehouse, and make sure everyone knows where they are.</li>
        <li>Open the app once on good network each morning, so the product list on the phone is fresh.</li>
        <li>Don&apos;t record the same thing again &ldquo;to be sure&rdquo;. Check what is waiting instead.</li>
      </ul>
      <InTheApp>
        <p>
          Stock in, stock out and counts work with no network. They are kept on the phone, the app shows how many are waiting,
          and they are sent the moment it reconnects, each one exactly once, even if the app was closed in between. We test this
          on every release: the app closed with three deliveries unsent; all three arrived, once.
        </p>
      </InTheApp>
    </>
  ),
  related: [
    ['For building materials', '/for/building-materials'],
    ['How to track stock in a shop', '/guides/how-to-track-stock-in-a-shop'],
    ['Watch it work', '/demo'],
  ],
}
