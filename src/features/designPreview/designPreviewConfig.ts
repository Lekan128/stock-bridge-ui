/**
 * The B1 type-and-colour spike (INVENTORY_OFFLINE_AND_CHARACTER_PLAN.md, Track B).
 *
 * A preview switch, not a feature: it re-skins the WHOLE workspace with a candidate typeface and
 * one of the §3 colour options, so the team judges them on the real screens with real data rather
 * than on a mock-up. Everything is a CSS-variable override (`designPreview.css`), so turning it off
 * leaves no trace.
 *
 * Built into dev and into a build made with `VITE_DESIGN_PREVIEW=true` (staging, for the team);
 * a normal production build leaves all of it out. Each entry point (main.tsx, AppLayout, the
 * router) repeats the `import.meta.env` test inline: the bundler only drops the dead branch, and
 * with it the lazy chunk, when the test is written where it is used.
 */
export type FontId = 'inter' | 'plex' | 'instrument' | 'hanken'
export type PaletteId = 'today' | 'warm' | 'warm-action' | 'full'

export interface DesignPreview {
  font: FontId
  palette: PaletteId
  /** Set tables in the font's condensed cut (Plex Condensed, Instrument Sans at 80% width). */
  condensed: boolean
}

export interface FontCandidate {
  id: FontId
  label: string
  family: string
  /** The narrow cut for dense tables, if the family has one. */
  condensed: { family: string; stretch: string } | null
  /** Loaded only while previewing; the chosen face gets self-hosted (B2) for offline use. */
  href: string | null
  note: string
}

const FALLBACK = 'ui-sans-serif, system-ui, -apple-system, sans-serif'

export const FONTS: FontCandidate[] = [
  {
    id: 'plex',
    label: 'IBM Plex Sans',
    family: `'IBM Plex Sans Variable', ${FALLBACK}`,
    condensed: { family: `'IBM Plex Sans Variable', ${FALLBACK}`, stretch: '85%' },
    href: null,
    note: 'Chosen (D4) and self-hosted: one variable file with the condensed widths built in.',
  },
  {
    id: 'inter',
    label: 'Inter (before)',
    family: `'Inter', ${FALLBACK}`,
    condensed: null,
    href: null,
    note: 'What the workspace used before B2. Impeccable lists it as the most overused UI face.',
  },
  {
    id: 'instrument',
    label: 'Instrument Sans',
    family: `'Instrument Sans', ${FALLBACK}`,
    condensed: { family: `'Instrument Sans', ${FALLBACK}`, stretch: '80%' },
    href: 'https://fonts.googleapis.com/css2?family=Instrument+Sans:wdth,wght@75..100,400..700&display=swap',
    note: 'Alternative: warmer, one variable file with a width axis for the narrow cut.',
  },
  {
    id: 'hanken',
    label: 'Hanken Grotesk',
    family: `'Hanken Grotesk', ${FALLBACK}`,
    condensed: null,
    href: 'https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400..700&display=swap',
    note: 'Alternative: friendly grotesk, no narrow cut.',
  },
]

export interface PaletteCandidate {
  id: PaletteId
  label: string
  description: string
}

export const PALETTES: PaletteCandidate[] = [
  { id: 'today', label: 'Today', description: 'Navy, emerald and blue-grey.' },
  { id: 'warm', label: '1 · Warm neutrals', description: 'Kraft-tinted greys; navy and emerald stay.' },
  {
    id: 'warm-action',
    label: '2 · + Palm-oil action',
    description: 'Warm neutrals, and the one main action per screen in palm-oil orange.',
  },
  { id: 'full', label: '3 · Full shift', description: 'Warm neutrals, palm-oil action, and adire indigo for the brand.' },
]

export const DEFAULT_PREVIEW: DesignPreview = { font: 'plex', palette: 'today', condensed: false }

const STORAGE_KEY = 'pp.designPreview'

export function readPreview(): DesignPreview {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<DesignPreview> | null
    if (!stored) return DEFAULT_PREVIEW
    return {
      font: FONTS.some((f) => f.id === stored.font) ? (stored.font as FontId) : DEFAULT_PREVIEW.font,
      palette: PALETTES.some((p) => p.id === stored.palette) ? (stored.palette as PaletteId) : DEFAULT_PREVIEW.palette,
      condensed: stored.condensed === true,
    }
  } catch {
    return DEFAULT_PREVIEW
  }
}

const listeners = new Set<() => void>()
let current: DesignPreview = DEFAULT_PREVIEW

export function getPreview(): DesignPreview {
  return current
}

export function subscribePreview(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Loads a candidate's web font once (preview only). */
export function loadFont(font: FontCandidate): void {
  if (!font.href || document.querySelector(`link[data-pp-font="${font.id}"]`)) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = font.href
  link.dataset.ppFont = font.id
  document.head.appendChild(link)
}

export function applyPreview(preview: DesignPreview): void {
  current = preview
  const font = FONTS.find((f) => f.id === preview.font) ?? FONTS[0]
  loadFont(font)
  const root = document.documentElement
  root.dataset.ppFont = preview.font
  root.dataset.ppPalette = preview.palette
  root.dataset.ppCondensed = preview.condensed && font.condensed ? 'on' : 'off'
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preview))
  } catch {
    // Private mode: the preview still applies for this visit.
  }
  for (const listener of listeners) listener()
}

export function isDefaultPreview(preview: DesignPreview): boolean {
  return preview.font === 'plex' && preview.palette === 'today' && !preview.condensed
}
