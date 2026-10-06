import { Block, PageShell, Related, prose } from '@/marketing/components'
import { GUIDES } from '@/marketing/guides'
import type { Guide } from '@/marketing/guides/types'
import { formatDay } from '@/marketing/offer'

/** `/guides/<slug>`: the article first, the ask at the end (LANDING_PAGE_PLAN.md §5). */
export function GuidePage({ guide }: { guide: Guide }) {
  return (
    <PageShell
      crumbs={[
        { name: 'Guides', path: '/guides' },
        { name: guide.title, path: `/guides/${guide.slug}` },
      ]}
      title={guide.title}
      meta={`Updated ${formatDay(guide.updated)} · ${guide.minutes} minute read`}
      lead={<p>{guide.lead}</p>}
      source="guide"
      heroCta={false}
    >
      <section className="px-4 pb-16 sm:px-6">
        <article className="mx-auto max-w-6xl">
          <div className={prose}>
            {guide.body}
            <Related links={[...guide.related, ['All guides', '/guides']]} />
          </div>
        </article>
      </section>
    </PageShell>
  )
}

/** `/guides`: every guide, with what it answers. */
export function GuidesIndexPage() {
  return (
    <PageShell
      crumbs={[{ name: 'Guides', path: '/guides' }]}
      eyebrow="Guides"
      title="Stock-keeping guides for Nigerian shops"
      lead={
        <p>
          Plain, practical answers to the questions shop owners ask: how to track stock, count it, stop it going missing, and
          know what it really cost. They work with a book, a spreadsheet or an app.
        </p>
      }
      source="guides"
      heroCta={false}
    >
      <Block>
        <ul className="grid gap-5 md:grid-cols-2">
          {GUIDES.map((guide) => (
            <li key={guide.slug} className="rounded-lg border border-neutral-200 p-5 hover:border-primary-300">
              <h2 className="text-lg font-semibold text-neutral-900">
                <a href={`/guides/${guide.slug}`} className="hover:underline">
                  {guide.title}
                </a>
              </h2>
              <p className="mt-2 text-neutral-700">{guide.description}</p>
              <p className="mt-2 text-sm text-neutral-600">{guide.minutes} minute read</p>
            </li>
          ))}
        </ul>
        <div className={prose}>
          <Related
            title="Free tools"
            links={[
              ['Free inventory Excel template', '/free-inventory-template'],
              ['Free stock count sheet', '/stock-count-sheet'],
            ]}
          />
        </div>
      </Block>
    </PageShell>
  )
}
