import { SHOP_RESULTS, type ShopResult } from '@/marketing/proof'

/**
 * Real shops, in their own words, with the number that changed (step 6). Renders nothing until
 * `proof.ts` has a result with permission; on a `/for/` page, only that trade's.
 */
export function ShopResults({ trade, title = 'Shops using Procurepaddy' }: { trade?: ShopResult['trade']; title?: string }) {
  const results = trade ? SHOP_RESULTS.filter((result) => result.trade === trade) : SHOP_RESULTS
  if (results.length === 0) return null
  return (
    <section aria-label={title} className="px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <h2 className="font-narrow text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl">{title}</h2>
        <ul className="mt-10 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {results.map((result) => (
            <li key={result.shop} className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-6">
              {result.photo && (
                <img
                  src={result.photo.src}
                  alt={result.photo.alt}
                  width={result.photo.width}
                  height={result.photo.height}
                  loading="lazy"
                  className="aspect-[4/3] w-full rounded-md object-cover"
                />
              )}
              <p className="font-narrow text-xl font-bold text-neutral-900">{result.result}</p>
              <blockquote className="text-neutral-800">&ldquo;{result.quote}&rdquo;</blockquote>
              <p className="mt-auto text-sm text-neutral-600">
                <strong className="text-neutral-900">{result.person}</strong>, {result.shop}, {result.place}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
