import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/Button'
import { ProductCard } from '@/features/products/components/ProductCard'
import { ProductTable, type ProductSort } from '@/features/products/components/ProductTable'
import { StockBreakdownPanel } from '@/features/products/components/StockBreakdownPanel'
import { useProducts } from '@/features/products/hooks/useProducts'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import { packEquivalent } from '@/features/products/packEquivalent'
import type { Product } from '@/features/products/types'
import { formatNumber } from '@/features/products/unitCopy'
import { resolveUnitSymbol } from '@/features/products/unitSet'
import {
  applyPreview,
  DEFAULT_PREVIEW,
  FONTS,
  getPreview,
  loadFont,
  PALETTES,
  subscribePreview,
  type FontCandidate,
} from '@/features/designPreview/designPreviewConfig'

const SORT: ProductSort = { field: 'name', direction: 'asc' }
const NO_INCOMING = { quantity: 0, awaitingReceiptQuantity: 0, orders: [], ordersUnknown: false }

function usePreview() {
  return useSyncExternalStore(subscribePreview, getPreview, getPreview)
}

/**
 * B1 (INVENTORY_OFFLINE_AND_CHARACTER_PLAN.md, Track B): the Inventory table, the product hero and
 * the sync stamps in each candidate typeface, on this company's real products, plus the §3 colour
 * options — chosen here, applied to the whole workspace.
 */
export function DesignSpikePage() {
  const preview = usePreview()
  const { data, loading } = useProducts({ active: true, page: 0, size: 50, sort: 'name,asc' })
  const products = useMemo(() => data?.content ?? [], [data])
  // The plan's own example is a bulk line ("1,000 kg · 20 bags"): the weighed or measured product
  // with the most on hand, packed; any product otherwise.
  const hero = useMemo(() => {
    const bulk = products
      .filter((p) => p.packagingSize != null && p.quantityOnHand > 0 && ['KG', 'LITER'].includes(p.unitOfMeasure ?? ''))
      .sort((a, b) => b.quantityOnHand - a.quantityOnHand)
    return bulk[0] ?? products.find((p) => p.packagingSize != null && p.quantityOnHand > 0) ?? products[0]
  }, [products])

  // Every candidate, so the side-by-side never falls back to a system face.
  useEffect(() => FONTS.forEach(loadFont), [])

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">B1 · Type and colour spike</p>
        <h1 className="text-2xl font-semibold text-neutral-900">Choose a typeface, on your own stock</h1>
        <p className="max-w-2xl text-sm text-neutral-600">
          The choice below applies to the whole workspace until you reset it, so open{' '}
          <Link to="/app/products" className="font-medium text-primary-700 underline underline-offset-2">
            Inventory
          </Link>{' '}
          or a product to see it for real. Only this phone or browser sees it.
        </p>
      </header>

      <Controls />

      <section aria-labelledby="side-heading" className="flex flex-col gap-4">
        <SectionHead id="side-heading" title="Side by side" note="The same products, figures and stamps in each candidate." />
        {loading && products.length === 0 ? (
          <p className="text-sm text-neutral-500">Loading your products…</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {FONTS.map((font) => (
              <FontColumn key={font.id} font={font} products={products} hero={hero} chosen={preview.font === font.id} />
            ))}
          </div>
        )}
      </section>

      {hero && (
        <section aria-labelledby="hero-heading" className="flex flex-col gap-4">
          <SectionHead id="hero-heading" title="Product hero" note={`The real stock panel for ${hero.name}.`} />
          <StockBreakdownPanel
            product={hero}
            incoming={NO_INCOMING}
            actions={
              <>
                <Button variant="secondary" data-preview-action="">
                  Stock In
                </Button>
                <Button variant="secondary">Stock Out</Button>
                <Button variant="secondary">Count</Button>
              </>
            }
          />
        </section>
      )}

      <section aria-labelledby="table-heading" className="flex flex-col gap-4">
        <SectionHead
          id="table-heading"
          title="Inventory"
          note="The real table (laptop) and cards (phone) — resize the window, or open it on a phone."
        />
        <div className="hidden md:block">
          <ProductTable products={products.slice(0, 12)} sort={SORT} onSortChange={() => undefined} />
        </div>
        <div className="flex flex-col gap-2 md:hidden">
          {products.slice(0, 6).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section aria-labelledby="stamps-heading" className="flex flex-col gap-4">
        <SectionHead id="stamps-heading" title="Stamps" note="Plan §2: RECORDED on this phone, SYNCED, CHECK needs a decision." />
        <Stamps />
      </section>

      <section aria-labelledby="colour-heading" className="flex flex-col gap-4">
        <SectionHead id="colour-heading" title="Colour checks" note="Contrast for the option chosen above (WCAG AA: 4.5:1 for text)." />
        <ColourChecks palette={preview.palette} />
      </section>
    </div>
  )
}

function SectionHead({ id, title, note }: { id: string; title: string; note: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-neutral-200 pb-2">
      <h2 id={id} className="text-lg font-semibold text-neutral-900">
        {title}
      </h2>
      <p className="text-sm text-neutral-500">{note}</p>
    </div>
  )
}

// ------------------------------------------------------------------------------------ controls

function Controls() {
  const preview = usePreview()
  const font = FONTS.find((f) => f.id === preview.font) ?? FONTS[0]
  return (
    <section aria-label="Preview settings" className="flex flex-col gap-5 rounded-lg border border-neutral-200 bg-white p-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold text-neutral-900">Typeface</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {FONTS.map((candidate) => (
            <label
              key={candidate.id}
              className={`flex cursor-pointer flex-col gap-1 rounded-md border p-3 ${
                preview.font === candidate.id ? 'border-primary-600 ring-1 ring-primary-600' : 'border-neutral-200'
              }`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="pp-font"
                  checked={preview.font === candidate.id}
                  onChange={() => applyPreview({ ...preview, font: candidate.id, condensed: preview.condensed && candidate.condensed != null })}
                />
                <span className="text-base font-semibold" style={{ fontFamily: candidate.family }}>
                  {candidate.label}
                </span>
              </span>
              <span className="text-xs text-neutral-500">{candidate.note}</span>
            </label>
          ))}
        </div>
        <label className={`mt-1 flex items-center gap-2 text-sm ${font.condensed ? 'text-neutral-700' : 'text-neutral-400'}`}>
          <input
            type="checkbox"
            disabled={!font.condensed}
            checked={preview.condensed && font.condensed != null}
            onChange={(event) => applyPreview({ ...preview, condensed: event.target.checked })}
          />
          Narrow cut for tables{font.condensed ? '' : ` (${font.label} has none)`}
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold text-neutral-900">Colour (plan §3, for team review)</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {PALETTES.map((palette) => (
            <label
              key={palette.id}
              className={`flex cursor-pointer flex-col gap-2 rounded-md border p-3 ${
                preview.palette === palette.id ? 'border-primary-600 ring-1 ring-primary-600' : 'border-neutral-200'
              }`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="pp-palette"
                  checked={preview.palette === palette.id}
                  onChange={() => applyPreview({ ...preview, palette: palette.id })}
                />
                <span className="text-sm font-semibold text-neutral-900">{palette.label}</span>
              </span>
              <span className="flex gap-1" aria-hidden="true">
                {SWATCHES[palette.id].map((colour) => (
                  <span key={colour} className="h-4 w-6 rounded-sm border border-black/10" style={{ background: colour }} />
                ))}
              </span>
              <span className="text-xs text-neutral-500">{palette.description}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <Button variant="secondary" onClick={() => applyPreview(DEFAULT_PREVIEW)}>
          Back to today’s look
        </Button>
      </div>
    </section>
  )
}

/** Brand, action, surface, ink — what each option looks like at a glance. */
const SWATCHES: Record<string, string[]> = {
  today: ['#1e3a8a', '#1e3a8a', '#f7f8fa', '#171a21'],
  warm: ['#1e3a8a', '#1e3a8a', '#f6f3ee', '#1f1b16'],
  'warm-action': ['#1e3a8a', '#c4471b', '#f6f3ee', '#1f1b16'],
  full: ['#2b2f77', '#c4471b', '#f6f3ee', '#1f1b16'],
}

// ---------------------------------------------------------------------------- side by side

interface Metrics {
  tabular: boolean
  /** x-height as a share of the font size: bigger reads larger at the same size. */
  xHeight: number
  /** Width of a long product name at 14px/500, px. */
  nameWidth: number
  /** Width of "1,000 kg · 20 bags" at 14px, regular and narrow cut, px. */
  qtyWidth: number
  qtyWidthNarrow: number | null
}

const LONG_NAME = 'Royal Stallion Rice 50 kg'
const QTY = '1,000 kg · 20 bags'

function measure(text: string, style: Partial<CSSStyleDeclaration>): number {
  const span = document.createElement('span')
  span.textContent = text
  Object.assign(span.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap', ...style })
  document.body.appendChild(span)
  const width = span.getBoundingClientRect().width
  span.remove()
  return width
}

function useMetrics(font: FontCandidate): Metrics | null {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  useEffect(() => {
    let cancelled = false
    const loads = ['400', '500', '600'].map((weight) => document.fonts.load(`${weight} 16px ${font.family}`))
    if (font.condensed) loads.push(document.fonts.load(`400 16px ${font.condensed.family}`))
    void Promise.all(loads).then(() => {
      if (cancelled) return
      const base = { fontFamily: font.family, fontSize: '16px', fontVariantNumeric: 'tabular-nums' }
      const canvas = document.createElement('canvas').getContext('2d')
      let xHeight = 0
      if (canvas) {
        canvas.font = `400 100px ${font.family}`
        xHeight = canvas.measureText('x').actualBoundingBoxAscent / 100
      }
      setMetrics({
        tabular: Math.abs(measure('111111', base) - measure('000000', base)) < 0.5,
        xHeight,
        nameWidth: measure(LONG_NAME, { fontFamily: font.family, fontSize: '14px', fontWeight: '500' }),
        qtyWidth: measure(QTY, { fontFamily: font.family, fontSize: '14px', fontVariantNumeric: 'tabular-nums' }),
        qtyWidthNarrow: font.condensed
          ? measure(QTY, {
              fontFamily: font.condensed.family,
              fontStretch: font.condensed.stretch,
              fontSize: '14px',
              fontVariantNumeric: 'tabular-nums',
            })
          : null,
      })
    })
    return () => {
      cancelled = true
    }
  }, [font])
  return metrics
}

function stockLine(product: Product, symbol: string | null): string {
  return `${formatNumber(product.quantityOnHand)}${symbol ? ` ${symbol}` : ''}`
}

function FontColumn({
  font,
  products,
  hero,
  chosen,
}: {
  font: FontCandidate
  products: Product[]
  hero: Product | undefined
  chosen: boolean
}) {
  const { options } = useUnitOfMeasureOptions()
  const metrics = useMetrics(font)
  const rows = products.slice(0, 7)
  const heroUnit = hero ? resolveUnitSymbol(hero.unitOfMeasure, options) : null
  const heroPack = hero ? packEquivalent(hero, options) : null

  return (
    <article
      data-spike-font={font.id}
      className={`flex flex-col gap-4 rounded-lg border bg-white p-4 ${chosen ? 'border-primary-600 ring-1 ring-primary-600' : 'border-neutral-200'}`}
      style={{ fontFamily: font.family }}
    >
      <header>
        <h3 className="text-base font-semibold text-neutral-900">{font.label}</h3>
      </header>

      {hero && (
        <div>
          <p className="text-xs text-neutral-500">On hand — usable now</p>
          <p className="mt-1 flex items-baseline gap-1.5 tabular-nums leading-none">
            <span className="text-[40px] font-semibold text-neutral-900">{formatNumber(hero.quantityOnHand)}</span>
            <span className="text-xl text-neutral-500">{heroUnit}</span>
          </p>
          {heroPack && <p className="mt-1.5 text-sm font-medium text-neutral-700">{heroPack}</p>}
          <p className="mt-1 truncate text-xs text-neutral-500">{hero.name}</p>
        </div>
      )}

      <Ledger rows={rows} options={options} />
      {font.condensed && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-neutral-500">Narrow cut</p>
          <div style={{ fontFamily: font.condensed.family, fontStretch: font.condensed.stretch }}>
            <Ledger rows={rows} options={options} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Stamp kind="recorded" />
        <Stamp kind="synced" />
        <Stamp kind="check" />
      </div>

      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-t border-neutral-100 pt-3 text-xs text-neutral-600" data-metrics>
        <dt>Tabular figures</dt>
        <dd className="text-right font-medium text-neutral-900" data-metric="tabular">
          {metrics ? (metrics.tabular ? 'Yes' : 'No') : '…'}
        </dd>
        <dt>x-height</dt>
        <dd className="text-right font-medium tabular-nums text-neutral-900" data-metric="xheight">
          {metrics ? metrics.xHeight.toFixed(3) : '…'}
        </dd>
        <dt>“{LONG_NAME}”</dt>
        <dd className="text-right font-medium tabular-nums text-neutral-900" data-metric="name">
          {metrics ? `${metrics.nameWidth.toFixed(0)} px` : '…'}
        </dd>
        <dt>“{QTY}”</dt>
        <dd className="text-right font-medium tabular-nums text-neutral-900" data-metric="qty">
          {metrics ? `${metrics.qtyWidth.toFixed(0)} px` : '…'}
        </dd>
        {font.condensed && (
          <>
            <dt>…narrow cut</dt>
            <dd className="text-right font-medium tabular-nums text-neutral-900" data-metric="qty-narrow">
              {metrics?.qtyWidthNarrow != null ? `${metrics.qtyWidthNarrow.toFixed(0)} px` : '…'}
            </dd>
          </>
        )}
      </dl>
    </article>
  )
}

/** A few rows as the redesigned ledger would set them: name, figure, pack restatement, state. */
function Ledger({ rows, options }: { rows: Product[]; options: Parameters<typeof packEquivalent>[1] }) {
  return (
    <ul className="flex flex-col divide-y divide-neutral-100 border-y border-neutral-100">
      {rows.map((product) => {
        const symbol = resolveUnitSymbol(product.unitOfMeasure, options)
        const pack = packEquivalent(product, options)
        const tone =
          product.quantityOnHand <= 0 ? 'bg-danger-600' : product.isLowStock ? 'bg-warning-500' : 'bg-accent-600'
        return (
          <li key={product.id} className="flex items-center gap-2 py-1.5">
            <span className={`h-2 w-2 shrink-0 rounded-full ${tone}`} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900">{product.name}</span>
            <span className="shrink-0 text-right tabular-nums">
              <span className="block text-sm text-neutral-900">{stockLine(product, symbol)}</span>
              {pack && <span className="block text-[11px] text-neutral-500">{pack}</span>}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

// ---------------------------------------------------------------------------------- stamps

const STAMPS = {
  recorded: { text: 'Recorded', className: 'border-primary-600 text-primary-700 bg-transparent' },
  synced: { text: 'Synced', className: 'border-accent-700 bg-accent-700 text-white' },
  check: { text: 'Check', className: 'border-warning-600 text-warning-800 bg-warning-50' },
} as const

function Stamp({ kind }: { kind: keyof typeof STAMPS }) {
  const { text, className } = STAMPS[kind]
  return (
    <span
      className={`inline-block -rotate-2 rounded-sm border-2 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${className}`}
    >
      {text}
    </span>
  )
}

function Stamps() {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {(
        [
          ['recorded', 'Stock in · 20 bags (1,000 kg)', 'Mama Gold Rice 50 kg', 'Saved on this phone at 10:42'],
          ['synced', 'Stock out · 3 cartons (144 tins)', 'Peak Milk Evaporated 160 g', 'Recorded 10:42 · sent 10:47'],
          ['check', 'Stock out · 5 bags (250 kg)', 'Royal Stallion Rice 50 kg', 'Only 3 bags were left when this synced'],
        ] as const
      ).map(([kind, what, product, when]) => (
        <div key={kind} className="flex items-start justify-between gap-3 rounded-md border border-neutral-200 bg-white px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-neutral-900">{what}</p>
            <p className="truncate text-sm text-neutral-600">{product}</p>
            <p className="mt-0.5 text-xs tabular-nums text-neutral-500">{when}</p>
          </div>
          <Stamp kind={kind} />
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------- colour checks

function luminance(hex: string): number {
  const value = hex.replace('#', '')
  const channels = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255)
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function ColourChecks({ palette }: { palette: string }) {
  // Re-read the tokens whenever the option changes.
  const pairs = useMemo(() => {
    void palette
    const action = token('--pp-action')
    const list: [string, string, string][] = [
      ['Body text on the page', token('--color-neutral-900'), token('--color-neutral-50')],
      ['Secondary text on the page', token('--color-neutral-500'), token('--color-neutral-50')],
      ['Secondary text on a card', token('--color-neutral-500'), '#ffffff'],
      ['Link on a card', token('--color-primary-700'), '#ffffff'],
      ['Button label on brand', '#ffffff', token('--color-primary-600')],
      ['Low-stock text on its tint', token('--color-warning-800'), token('--color-warning-50')],
    ]
    if (action) {
      list.push(['Button label on palm-oil action', '#ffffff', action])
      list.push(['…on §3’s brighter #D9531E', '#ffffff', token('--pp-action-bright')])
    }
    return list
  }, [palette])

  return (
    <div className="overflow-x-auto rounded-md border border-neutral-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-neutral-200 text-left text-xs text-neutral-500">
          <tr>
            <th className="px-4 py-2 font-medium">Pair</th>
            <th className="px-4 py-2 font-medium">Sample</th>
            <th className="px-4 py-2 text-right font-medium">Contrast</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {pairs.map(([label, fg, bg]) => {
            const ratio = contrast(fg, bg)
            return (
              <tr key={label} data-contrast={label}>
                <td className="px-4 py-2 text-neutral-700">{label}</td>
                <td className="px-4 py-2">
                  <span className="rounded-sm px-2 py-1 text-sm" style={{ color: fg, background: bg }}>
                    Mama Gold · 1,000 kg
                  </span>
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  <span className={ratio >= 4.5 ? 'text-accent-700' : 'font-semibold text-danger-700'}>
                    {ratio.toFixed(2)}:1 {ratio >= 4.5 ? 'AA' : 'below AA'}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
