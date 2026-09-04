/**
 * Client-side mirror of the backend's token grammar (`SkuPatternRenderer`/`SkuPatternValidator`)
 * for the Simple/Advanced pattern editor in {@link ProductSkuSettingsPage}. This file exists for
 * fast UI feedback only — the server (`ProductSkuSettingsService.update`) remains the sole
 * authority on whether a pattern is actually valid.
 */

export interface SimpleShapeParts {
  prefix: string
  separator: string
  digits: number
}

/** Simple's exact editable shape: literal prefix, one optional separator, {SEQ:N} at the end, nothing else. */
const SIMPLE_SHAPE = /^([^{}]*?)([-_./ ]?)\{SEQ:(\d+)\}$/
const TOKEN = /\{([A-Z]+)(?::(\d+))?\}/g

/**
 * Recognizes whether `pattern` fits the Simple tab's editable shape. Returns null for anything
 * with a date or `{NAME:N}` token, or any shape Simple cannot express — the caller falls back to
 * Advanced and does not attempt a lossy round-trip. See `ProductSkuSettingsPage`.
 */
export function parseAsSimple(pattern: string): SimpleShapeParts | null {
  const match = SIMPLE_SHAPE.exec(pattern)
  if (!match) return null
  return { prefix: match[1], separator: match[2], digits: Number(match[3]) }
}

export function composeSimplePattern(prefix: string, separator: string, digits: number): string {
  return `${prefix}${separator}{SEQ:${digits}}`
}

/** Fast mirror of the server's one non-negotiable rule: a pattern with no {SEQ:N} can never be saved. */
export function hasSequenceToken(pattern: string): boolean {
  return /\{SEQ:\d+\}/.test(pattern)
}

/**
 * Renders a pattern given a concrete sequence value and (optionally) a product name — the same
 * substitution `SkuPatternRenderer` does server-side, mirrored here so the create-product form
 * can update the displayed SKU on every keystroke of the name field without a network call.
 *
 * `sequenceValue` has to come from the server (`productsApi.previewSku().nextSequence`) — it is
 * the one thing about the pattern the client cannot know on its own, since the counter lives in
 * `product_sku_settings` and nowhere else. Everything else here (the pattern string, the current
 * date, the typed name) the client already has. This function only ever produces a DISPLAY value;
 * the server renders and reserves the real SKU itself at save time regardless of what this shows
 * or what the client sends — see `SkuGenerationService.generateAndReserveOne`.
 */
export function renderSku(pattern: string, sequenceValue: number, name?: string, now: Date = new Date()): string {
  return pattern.replace(TOKEN, (match, tokenName: string, param?: string) => {
    switch (tokenName) {
      case 'SEQ':
        return String(sequenceValue).padStart(Number(param ?? '0'), '0')
      case 'NAME':
        return (name ?? '').trim().slice(0, Number(param ?? '0')).toUpperCase()
      case 'YYYY':
        return String(now.getFullYear())
      case 'YY':
        return String(now.getFullYear() % 100).padStart(2, '0')
      case 'MM':
        return String(now.getMonth() + 1).padStart(2, '0')
      case 'DD':
        return String(now.getDate()).padStart(2, '0')
      default:
        return match
    }
  })
}

/**
 * An illustrative rendering for the settings screen, seeded with sequence value 1 and a
 * placeholder name — NOT the real next SKU (the settings page has no product to render a real
 * `{NAME:N}` from, and doesn't fetch the counter just to show an example). Labelled "Example"
 * wherever it's shown, never "Next SKU". See {@link renderSku} for the version the
 * create-product form uses with the server's actual counter value.
 */
export function renderExample(pattern: string, now: Date = new Date()): string {
  return renderSku(pattern, 1, 'PRODUCT', now)
}
