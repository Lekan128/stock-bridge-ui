import { Block, PageShell, Related, prose } from '@/marketing/components'
import { DEMO, DEMO_LENGTH } from '@/marketing/demo'
import type { HeadOptions } from '@/marketing/site'

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`
}

/** VideoObject, so search results can show the demo with its length and thumbnail. */
export function demoJsonLd(options: HeadOptions): object[] {
  return [
    {
      '@type': 'VideoObject',
      name: `Procurepaddy in ${DEMO_LENGTH}`,
      description:
        'A real recording of Procurepaddy on a phone: a delivery in bags, a sale with no network, a shelf count that shows what is missing, and who recorded what.',
      thumbnailUrl: `${options.siteUrl}${DEMO.poster}`,
      contentUrl: `${options.siteUrl}${DEMO.src}`,
      uploadDate: DEMO.uploadDate,
      duration: `PT${Math.floor(DEMO.durationSeconds / 60)}M${DEMO.durationSeconds % 60}S`,
      inLanguage: 'en-NG',
    },
  ]
}

/** `/demo`: "Watch it work (2 min)", ending on the same one action (LANDING_PAGE_PLAN.md §2). */
export function DemoPage() {
  return (
    <PageShell
      crumbs={[{ name: 'Watch it work', path: '/demo' }]}
      eyebrow="Watch it work"
      title={`Procurepaddy in ${DEMO_LENGTH}, on a real phone.`}
      source="demo"
      lead={
        <p>
          Not a mock-up: a recording of the app as your staff would use it. A delivery in bags, a sale with no network, a shelf
          count that shows what is missing, and who recorded what.
        </p>
      }
      hero={
        <video
          controls
          playsInline
          preload="none"
          poster={DEMO.poster}
          width={DEMO.width / 2}
          height={DEMO.height / 2}
          className="mx-auto w-full max-w-xs rounded-[2rem] border-[10px] border-neutral-900 bg-neutral-900 shadow-paper"
          aria-describedby="demo-transcript"
        >
          <source src={DEMO.src} type="video/webm" />
          Your browser can&apos;t play this video. The transcript below says what it shows.
        </video>
      }
    >
      <Block tint>
        <div className={prose}>
          <h2>What you&apos;ll see</h2>
          <ol id="demo-transcript">
            {DEMO.chapters.map((chapter) => (
              <li key={chapter.at}>
                <strong>
                  {clock(chapter.at)} {chapter.title}.
                </strong>{' '}
                {chapter.caption}
              </li>
            ))}
          </ol>
          <p>
            Everything in it is the real app on a phone-sized screen. The shop is a demo shop; the network was switched off for
            the sale exactly as it drops in a market.
          </p>
          <Related
            links={[
              ['How Procurepaddy keeps working with no internet', '/guides/stock-records-without-internet'],
              ['Pricing', '/pricing'],
              ['Questions people ask', '/#faq'],
            ]}
          />
        </div>
      </Block>
    </PageShell>
  )
}
