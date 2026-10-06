import { Block, PageShell, Related, prose } from '@/marketing/components'
import { FOUNDERS } from '@/marketing/founders'
import { WHATSAPP_NUMBER, WHATSAPP_URL } from '@/marketing/site'

/**
 * `/about` (LANDING_PAGE_PLAN.md §5: "Procurepaddy · who owns Procurepaddy", trust). Who is behind
 * it, how it is built, and how to reach a person. The founders' photo, names and note appear here as
 * soon as `founders.ts` has them; nothing about people is written until then.
 */
export function AboutPage() {
  return (
    <PageShell
      crumbs={[{ name: 'About us', path: '/about' }]}
      eyebrow="About Procurepaddy"
      title="Built in Nigeria, for shops where the network drops."
      source="about"
      lead={
        <p>
          Procurepaddy is an inventory app for Nigerian shops, supermarkets, pharmacies, building-materials stores and
          warehouses. It is co-owned with ProcurePal, its procurement partner.
        </p>
      }
    >
      {FOUNDERS && (
        <Block title="Who we are">
          <div className="grid items-center gap-8 md:grid-cols-12">
            <img
              src={FOUNDERS.photo.src}
              alt={FOUNDERS.photo.alt}
              width={FOUNDERS.photo.width}
              height={FOUNDERS.photo.height}
              loading="lazy"
              className="w-full rounded-lg md:col-span-5"
            />
            <div className="md:col-span-7">
              <p className="text-lg text-neutral-800">{FOUNDERS.note}</p>
              <ul className="mt-4 text-neutral-700">
                {FOUNDERS.people.map((person) => (
                  <li key={person.name}>
                    <strong className="text-neutral-900">{person.name}</strong>, {person.role}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Block>
      )}

      <Block tint>
        <div className={prose}>
          <h2>Why we built it</h2>
          <p>
            Stock is a shop&apos;s money. In most Nigerian shops it lives in an exercise book, an Excel file one person
            updates, or the owner&apos;s head. Books get wet, files get two versions, and nobody can say who changed a number.
            The software that exists is mostly priced in dollars, assumes an accountant, and stops working when the network
            does.
          </p>
          <p>
            So we built the opposite: an app your staff use on their own phones, that keeps working with no network, that
            understands bags and kilos, and that puts a name on every change.
          </p>
          <h2>How we build it</h2>
          <ul>
            <li>
              <strong>We try to break it.</strong> Before anything ships, automated tests close the app with deliveries still
              unsent, lose the network mid-save, and have two phones count and sell at once. Nothing recorded may be lost or
              counted twice.
            </li>
            <li>
              <strong>We set shops up by hand.</strong> Founding shops send us their product list, and a person loads it within
              24 hours, then counts the first shelf with them.
            </li>
            <li>
              <strong>We say what it doesn&apos;t do.</strong> Today each account keeps one stock location, there is no
              expiry-date tracking yet, and barcode scanning needs a USB or Bluetooth scanner, not the phone camera.
            </li>
          </ul>
          <h2>ProcurePal</h2>
          <p>
            ProcurePal is Procurepaddy&apos;s procurement partner and co-owner: a marketplace for buying stock. Soon, stock you
            buy through ProcurePal will land in your Procurepaddy records by itself.
          </p>
          <h2>Talk to a person</h2>
          <p>
            WhatsApp <a href={WHATSAPP_URL}>{WHATSAPP_NUMBER}</a>, 8am to 6pm, Monday to Saturday. We reply within 5
            minutes in those hours. Email <a href="mailto:support@procurepaddy.com">support@procurepaddy.com</a>.
          </p>
          <Related
            links={[
              ['Watch it work', '/demo'],
              ['Pricing', '/pricing'],
              ['Guides', '/guides'],
            ]}
          />
        </div>
      </Block>
    </PageShell>
  )
}
