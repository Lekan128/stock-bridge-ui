/**
 * The founding offer as the owners set it on 2026-10-05 (LANDING_PAGE_PLAN.md §1). The live counts
 * come from the API; these are the fixed terms the page states.
 */

/** The first day the offer is closed: paid plans start. Matches the API's app.founding.ends-on. */
export const OFFER_ENDS_ON = '2027-02-01'

export const REGULAR_PRICE = 10_000
export const FOUNDING_PRICE = 5_000

/** The stack, printed as a receipt. Values are what each would cost the owner elsewhere. */
export const STACK = [
  { what: 'Procurepaddy, 12 months free', why: 'Every feature, every staff member, no card. 12 × ₦10,000.', value: '₦120,000' },
  { what: 'We load your products for you', why: 'Excel, CSV or photos of your book, in within 24 hours. About two days of a data clerk.', value: '₦25,000' },
  { what: 'Your first stock count, done with you', why: '20 minutes on a WhatsApp video call. We count one shelf together.', value: '₦15,000' },
  { what: 'Staff card and 5-minute video', why: 'Stock in, stock out, a count. Print it, stick it on the wall.', value: '₦5,000' },
  { what: 'Founding price for life', why: 'After year one: ₦5,000 a month instead of ₦10,000, for as long as you stay.', value: '₦60,000/yr' },
] as const

const DAY = new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' })

/** "1 February 2027". Fixed time zone, so the prerender and the browser print the same day. */
export function formatDay(isoDate: string): string {
  return DAY.format(new Date(`${isoDate}T12:00:00Z`))
}

/** "the week of 12 October". */
export function formatWeek(isoMonday: string): string {
  return new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'long', timeZone: 'Africa/Lagos' }).format(
    new Date(`${isoMonday}T12:00:00Z`),
  )
}
