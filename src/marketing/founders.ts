/**
 * "Who we are" (LANDING_PAGE_PLAN.md, conversion rule 8). The founders' real photo, names, roles and
 * a two-sentence note, from LAUNCH_MATERIALS.md §2. Until they arrive this is null: the section is
 * left out, and a production build with the founding offer on refuses to prerender.
 *
 * Photo: put it in `public/marketing/` and give its path here, e.g. `/marketing/founders.webp`.
 */
export interface Founders {
  photo: { src: string; alt: string; width: number; height: number }
  people: { name: string; role: string }[]
  /** Two sentences, in their own words, with the WhatsApp number in them. */
  note: string
}

export const FOUNDERS: Founders | null = null
