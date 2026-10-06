import type { ReactElement } from 'react'
import type { Crumb } from '@/marketing/components'
import { GUIDES } from '@/marketing/guides'
import { MARKETING_PATHS } from '@/marketing/paths'
import { AboutPage } from '@/marketing/pages/AboutPage'
import { CompareExcelPage, CompareNotebookPage, EXCEL_FAQ, NOTEBOOK_FAQ } from '@/marketing/pages/ComparePages'
import { DEMO_MINUTES } from '@/marketing/demo'
import { DemoPage, demoJsonLd } from '@/marketing/pages/DemoPage'
import { GuidePage, GuidesIndexPage } from '@/marketing/pages/GuidePages'
import { PRICING_FAQ, PricingPage } from '@/marketing/pages/PricingPage'
import { CountSheetPage, FreeTemplatePage } from '@/marketing/pages/ToolPages'
import { TRADES, TradePage } from '@/marketing/pages/TradePages'
import { DEFAULT_SITE_URL, type HeadOptions, type PageMeta } from '@/marketing/site'

/**
 * Every marketing page besides `/` and `/founding` (LANDING_PAGE_PLAN.md, step 7): what it renders
 * and what it says about itself to search engines. `scripts/prerender.mjs` renders each into
 * `dist<path>.html` and lists it in the sitemap.
 */
export interface MarketingPageDef {
  meta: PageMeta
  /** `data-page` on <html>: styles or scripts that are only for this page key off it. */
  id: string
  crumbs: Crumb[]
  faq?: { question: string; answer: string }[]
  jsonLd?: (options: HeadOptions) => object[]
  render: () => ReactElement
}

const ORG = { '@type': 'Organization', name: 'Procurepaddy', url: DEFAULT_SITE_URL }

export const PAGES: MarketingPageDef[] = [
  {
    id: 'pricing',
    meta: {
      path: '/pricing',
      title: 'Pricing: Inventory Software for Nigerian Shops | Procurepaddy',
      description:
        'Free until 1 February 2027, then ₦10,000 a month for the whole shop, every staff member included. Business and custom plans for larger companies.',
    },
    crumbs: [{ name: 'Pricing', path: '/pricing' }],
    faq: PRICING_FAQ,
    render: () => <PricingPage />,
  },
  {
    id: 'demo',
    meta: {
      path: '/demo',
      title: `Watch Procurepaddy Work: ${DEMO_MINUTES} Demo | Procurepaddy`,
      description:
        'A real recording of the app: a delivery in bags, a sale in kilos with no network, a shelf count that shows what is missing, and who recorded what.',
    },
    crumbs: [{ name: 'Watch it work', path: '/demo' }],
    jsonLd: demoJsonLd,
    render: () => <DemoPage />,
  },
  {
    id: 'about',
    meta: {
      path: '/about',
      title: 'About Procurepaddy: Who We Are | Procurepaddy',
      description:
        'Procurepaddy is an inventory app built in Nigeria for shops and warehouses where the network drops. Co-owned with ProcurePal. Talk to a person on WhatsApp.',
    },
    crumbs: [{ name: 'About us', path: '/about' }],
    render: () => <AboutPage />,
  },
  {
    id: 'compare-excel',
    meta: {
      path: '/compare/excel',
      title: 'Excel Inventory vs Inventory App: An Honest Comparison | Procurepaddy',
      description:
        'Where an Excel stock sheet works, where it breaks, and how to move your spreadsheet into an app your staff use on their phones, without retyping.',
    },
    crumbs: [{ name: 'Procurepaddy vs Excel', path: '/compare/excel' }],
    faq: EXCEL_FAQ,
    render: () => <CompareExcelPage />,
  },
  {
    id: 'compare-notebook',
    meta: {
      path: '/compare/notebook',
      title: 'Stock Book vs Inventory App: Record Book or Phone? | Procurepaddy',
      description:
        'What an exercise book does well for stock records, where it fails you, and how to move from the book to your staff’s phones without starting again.',
    },
    crumbs: [{ name: 'Procurepaddy vs a notebook', path: '/compare/notebook' }],
    faq: NOTEBOOK_FAQ,
    render: () => <CompareNotebookPage />,
  },
  {
    id: 'template',
    meta: {
      path: '/free-inventory-template',
      title: 'Free Inventory Excel Template for Shops (Download) | Procurepaddy',
      description:
        'Free stock spreadsheet for Nigerian shops: products in bags and cartons, a stock in-and-out log with who recorded it, and a count sheet. No email needed.',
    },
    crumbs: [{ name: 'Free inventory Excel template', path: '/free-inventory-template' }],
    render: () => <FreeTemplatePage />,
  },
  {
    id: 'count-sheet',
    meta: {
      path: '/stock-count-sheet',
      title: 'Free Stock Count Sheet & Stocktaking Template | Procurepaddy',
      description:
        'Print a stock count sheet or download it for Excel: should be, counted and the difference worked out for you. How to count a shelf in minutes.',
    },
    crumbs: [{ name: 'Stock count sheet', path: '/stock-count-sheet' }],
    render: () => <CountSheetPage />,
  },
  ...TRADES.map(
    (trade): MarketingPageDef => ({
      id: `for-${trade.slug}`,
      meta: { path: `/for/${trade.slug}`, title: trade.metaTitle, description: trade.metaDescription },
      crumbs: [{ name: trade.name, path: `/for/${trade.slug}` }],
      faq: trade.faq,
      render: () => <TradePage trade={trade} />,
    }),
  ),
  {
    id: 'guides',
    meta: {
      path: '/guides',
      title: 'Stock-Keeping Guides for Nigerian Shops | Procurepaddy',
      description:
        'Practical guides: how to track stock in a shop, do a stock count, stop stock going missing, set reorder levels, FIFO, and your real cost price.',
    },
    crumbs: [{ name: 'Guides', path: '/guides' }],
    render: () => <GuidesIndexPage />,
  },
  ...GUIDES.map(
    (guide): MarketingPageDef => ({
      id: 'guide',
      meta: { path: `/guides/${guide.slug}`, title: `${guide.title} | Procurepaddy`, description: guide.description },
      crumbs: [
        { name: 'Guides', path: '/guides' },
        { name: guide.title, path: `/guides/${guide.slug}` },
      ],
      jsonLd: (options) => [
        {
          '@type': 'Article',
          headline: guide.title,
          description: guide.description,
          datePublished: guide.updated,
          dateModified: guide.updated,
          author: ORG,
          publisher: { ...ORG, url: options.siteUrl, logo: { '@type': 'ImageObject', url: `${options.siteUrl}/icons/pwa-512.png` } },
          mainEntityOfPage: `${options.siteUrl}/guides/${guide.slug}`,
          inLanguage: 'en-NG',
        },
      ],
      render: () => <GuidePage guide={guide} />,
    }),
  ),
]

/** Fails the build when the page list and `paths.ts` (which the service worker reads) disagree. */
export function checkPaths(): void {
  const rendered = new Set(['/founding', ...PAGES.map((page) => page.meta.path)])
  const listed = new Set(MARKETING_PATHS)
  const missing = [...listed].filter((path) => !rendered.has(path))
  const unlisted = [...rendered].filter((path) => !listed.has(path))
  if (missing.length || unlisted.length) {
    throw new Error(`Marketing pages out of step with paths.ts. Listed, no page: ${missing.join(', ') || '-'}. Page, not listed: ${unlisted.join(', ') || '-'}`)
  }
}
