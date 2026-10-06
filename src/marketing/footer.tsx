import { Logo } from '@/components/Logo'
import { WHATSAPP_NUMBER, WHATSAPP_URL } from '@/marketing/site'
import { MARKETPLACE_BASE } from '@/routes/marketplacePaths'

/**
 * The footer every marketing page shares: it links every page to every other (how search engines
 * find them, and how a reader moves on). A module of its own, with no islands in it, because the
 * early-access home page hydrates as one React tree and must not download the setup form with it.
 */
const FOOTER_GROUPS: { title: string; links: [string, string][] }[] = [
  {
    title: 'Procurepaddy',
    links: [
      ['How it works', '/#how'],
      ['Pricing', '/pricing'],
      ['Watch it work', '/demo'],
      ['About us', '/about'],
      ['Log in', '/login'],
    ],
  },
  {
    title: 'For your trade',
    links: [
      ['Provision stores', '/for/provision-stores'],
      ['Supermarkets', '/for/supermarkets'],
      ['Pharmacies', '/for/pharmacies'],
      ['Building materials', '/for/building-materials'],
      ['Wholesalers and distributors', '/for/wholesalers'],
    ],
  },
  {
    title: 'Compare',
    links: [
      ['Procurepaddy vs Excel', '/compare/excel'],
      ['Procurepaddy vs a notebook', '/compare/notebook'],
    ],
  },
  {
    title: 'Free tools',
    links: [
      ['Inventory Excel template', '/free-inventory-template'],
      ['Stock count sheet', '/stock-count-sheet'],
    ],
  },
  {
    title: 'Guides',
    links: [
      ['How to track stock in a shop', '/guides/how-to-track-stock-in-a-shop'],
      ['How to do a stock count', '/guides/how-to-do-a-stock-count'],
      ['How to stop stock going missing', '/guides/how-to-stop-stock-going-missing'],
      ['All guides', '/guides'],
    ],
  },
]

export function MarketingFooter({ focused = false }: { focused?: boolean }) {
  return (
    <footer className="border-t border-neutral-200 px-4 py-12 pb-28 sm:px-6 sm:pb-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 text-sm text-neutral-700">
        {!focused && (
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
            {FOOTER_GROUPS.map((group) => (
              <nav key={group.title} aria-label={group.title}>
                <h2 className="font-semibold text-neutral-900">{group.title}</h2>
                <ul className="mt-3 flex flex-col gap-2">
                  {group.links.map(([label, href]) => (
                    <li key={href}>
                      <a href={href} className="hover:text-neutral-900 hover:underline">
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-neutral-100 pt-6 text-neutral-600">
          <Logo size={20} />
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {focused && (
              <a href="/login" className="hover:text-neutral-900 hover:underline">
                Log in
              </a>
            )}
            <a href={WHATSAPP_URL} className="hover:text-neutral-900 hover:underline" target="_blank" rel="noreferrer">
              WhatsApp {WHATSAPP_NUMBER}
            </a>
            {!focused && (
              <>
                <a href="mailto:support@procurepaddy.com" className="hover:text-neutral-900 hover:underline">
                  support@procurepaddy.com
                </a>
                <a href={MARKETPLACE_BASE} className="hover:text-neutral-900 hover:underline">
                  Buy stock through ProcurePal
                </a>
              </>
            )}
          </div>
          <p>© 2026 Procurepaddy</p>
        </div>
      </div>
    </footer>
  )
}

