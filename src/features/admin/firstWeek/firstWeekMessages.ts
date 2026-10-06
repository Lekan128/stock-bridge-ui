import type { FirstWeekShop, MessageKind } from '@/features/admin/firstWeek/firstWeekApi'

/**
 * The first week's WhatsApp messages (LANDING_PAGE_PLAN.md §4, LAUNCH_MATERIALS.md §3), with the
 * shop's real numbers in them. Sent by a person from the WhatsApp Business app: the admin opens the
 * chat with the message typed, and records that it went.
 *
 * | Message | Due                                                            |
 * |---------|----------------------------------------------------------------|
 * | WELCOME | at sign-up                                                     |
 * | LOADED  | once its products are in                                       |
 * | DAY_3   | 3 days in, if the shop has recorded nothing itself (else skip) |
 * | DAY_7   | 7 days in: its first week, in numbers                          |
 */
export const MESSAGES: { kind: MessageKind; label: string }[] = [
  { kind: 'WELCOME', label: 'Welcome' },
  { kind: 'LOADED', label: 'Products in' },
  { kind: 'DAY_3', label: 'Day 3' },
  { kind: 'DAY_7', label: 'Day 7' },
]

export type MessageState = 'sent' | 'due' | 'later' | 'skip'

const DAY = 24 * 60 * 60 * 1000

export function ageInDays(shop: FirstWeekShop, now: number): number {
  return (now - new Date(shop.createdAt).getTime()) / DAY
}

export function messageState(shop: FirstWeekShop, kind: MessageKind, now: number): MessageState {
  if (shop.messages[kind]) return 'sent'
  const age = ageInDays(shop, now)
  switch (kind) {
    case 'WELCOME':
      return 'due'
    case 'LOADED':
      return shop.activity.products > 0 ? 'due' : 'later'
    case 'DAY_3':
      if (shop.activity.stockChanges > 0) return 'skip'
      return age >= 3 ? 'due' : 'later'
    case 'DAY_7':
      return age >= 7 ? 'due' : 'later'
  }
}

/** The one message to send now: the first that is due, in order. */
export function nextDue(shop: FirstWeekShop, now: number): MessageKind | null {
  return MESSAGES.find((message) => messageState(shop, message.kind, now) === 'due')?.kind ?? null
}

export function messageText(shop: FirstWeekShop, kind: MessageKind): string {
  const a = shop.activity
  switch (kind) {
    case 'WELCOME':
      return `Hello ${shop.name}, welcome to Procurepaddy. Your Company ID is ${shop.companyId}: your staff type it to log in. Send your product list here (Excel, CSV or photos of your stock book) and we'll load it within 24 hours.`
    case 'LOADED':
      return `Good news, ${shop.name}: your ${a.products} ${a.products === 1 ? 'product is' : 'products are'} in Procurepaddy. Let's do your first count together, 20 minutes on a video call. Which suits you, today or tomorrow, and what time?`
    case 'DAY_3':
      return `Hello ${shop.name}, have you recorded today's first delivery? Open Procurepaddy, tap Quick mode, find the product and enter the amount. It works with no network. Reply here if anything gets in the way.`
    case 'DAY_7': {
      const changes = `${a.changesLast7Days} stock ${a.changesLast7Days === 1 ? 'change' : 'changes'} recorded`
      const low = `${a.lowStock} ${a.lowStock === 1 ? 'item' : 'items'} running low`
      const counts = `${a.counts} shelf ${a.counts === 1 ? 'count' : 'counts'}`
      const next =
        a.staff === 0
          ? 'Next: add your staff, so every change has a name. In Procurepaddy: Users, then Add user.'
          : a.counts === 0
            ? 'Next: count one shelf. Procurepaddy shows you the difference straight away.'
            : 'Keep it up. Reply here any time you need us.'
      return `${shop.name}, your first week on Procurepaddy: ${changes}, ${low}, ${counts}. ${next}`
    }
  }
}
