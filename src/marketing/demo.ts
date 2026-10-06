import recording from '@/marketing/demo-chapters.json'

/**
 * The demo (LANDING_PAGE_PLAN.md §2: "Watch it work", step 6's proof). A real screen recording of the
 * app on a phone, made by `scripts/demo/record.mjs` against a fresh demo shop: nothing staged but the
 * shop's name. Re-record it when the screens it shows change; the length and chapters below come from
 * the recording itself (`demo-chapters.json`), so the page never claims a length the video isn't.
 *
 * WebM (VP8): Chrome and Firefox on Android and desktop, and Safari on iPhone since iOS 17.4.
 */
export const DEMO = {
  src: '/marketing/demo.webm',
  poster: '/marketing/demo-poster.jpg',
  width: 780,
  height: 1688,
  durationSeconds: recording.durationSeconds,
  uploadDate: '2026-10-06',
  chapters: recording.chapters,
}

/** "1 min", "2 min": for the "Watch it work" links. */
export const DEMO_MINUTES = `${Math.max(1, Math.round(DEMO.durationSeconds / 60))} min`

/** "under a minute", "2 minutes": for headings. */
export const DEMO_LENGTH = DEMO.durationSeconds < 60 ? 'under a minute' : `${Math.round(DEMO.durationSeconds / 60)} minutes`
