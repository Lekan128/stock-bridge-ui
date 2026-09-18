import { bannedWordProblems, formatCount } from '@/features/imports/copy'

/**
 * Every user-facing string for expected deliveries, in one file — the rule
 * `features/imports/copy.ts` sets out, followed here for the same reasons.
 *
 * The voice is that file's voice: plain, warm, short sentences, no jargon, no exclamation marks,
 * and no id ever rendered to anybody. Two habits worth naming because this feature is where they
 * are easiest to break:
 *
 *  1. **Say "ordered", never "purchase order".** Plan §3.1 decided this is *expected deliveries*
 *     and not a purchase-order module — no PO numbers, no approval step, no supplier-facing
 *     document. Copy that talks about raising a PO would promise a workflow nobody has agreed to.
 *  2. **The server writes the title.** "Tony Stores, due 22 Sep" is composed once, server-side,
 *     so there is no `title(supplier, date)` function here to drift from it.
 *
 * The banned-word guard from the import copy module runs over this one too — see
 * {@link bannedWordProblems}.
 */

/** "1 thing" / "4 things" — plural agreement for a count of lines, in one place. */
function pluralThings(count: number): string {
  return `${formatCount(count)} ${count === 1 ? 'thing' : 'things'}`
}

function pluralItems(count: number): string {
  return `${formatCount(count)} ${count === 1 ? 'item' : 'items'}`
}

export const expectedCopy = {
  list: {
    title: 'Expected deliveries',
    subtitle: 'What you have ordered from a supplier and not received yet.',
    add: 'Add what you ordered',
    filterLabel: 'Which ones to show',
    filterOpen: 'Still coming',
    filterAll: 'All',
    /** The line under each title. `outstandingLines`, said plainly. */
    outstanding: (count: number) => `${pluralThings(count)} still to come`,
    /** An expectation that is fully received or called off has nothing left owing. */
    nothingOutstanding: 'Nothing left to come',
    totalLabel: (amount: string) => `Worth ${amount}`,
    overdue: 'Overdue',
    /** Read out after the title, so the tint is not the only thing carrying it. */
    overdueAria: 'This one is late',
    statusReceived: 'All arrived',
    statusCancelled: 'Called off',
    receive: 'Receive this',
    receiveLabel: (title: string) => `Receive ${title}`,
    cancel: 'Call it off',
    cancelLabel: (title: string) => `Call off ${title}`,
    reference: (value: string) => `Their number: ${value}`,
    emptyOpenTitle: 'Nothing on its way',
    emptyOpenBody:
      'When you order from a supplier, write it down here. You will see what is coming, and receiving it later takes one tap.',
    emptyAllTitle: 'Nothing here yet',
    emptyAllBody: 'Once you write down an order, it stays here — even after it arrives.',
    loadFailed: "We couldn't load what is coming.",
  },

  cancel: {
    title: 'Call this one off?',
    body: 'It stays on the list so you can still see what was promised. Nothing in your stock changes.',
    confirm: 'Yes, call it off',
    keep: 'Keep it',
    done: 'Called off. Nothing in your stock changed.',
    failed: "We couldn't call that off. Nothing was changed.",
  },

  /*
   * "Say what you ordered" — the create screen. Same shape as Record a delivery on purpose: the
   * screen that writes down an order and the screen that receives it are the same screen with a
   * different verb, so anyone who has used one already knows this one.
   */
  create: {
    title: 'Say what you ordered',
    subtitle: 'Write down what a supplier promised you, so everyone can see what is coming.',
    supplier: 'Supplier',
    supplierAny: 'Any supplier',
    supplierHint: 'Choose one and we will show you their products first.',
    date: 'When they said it will come',
    dateHint: 'Optional — leave it blank if they did not say.',
    reference: 'Their order or invoice number',
    referenceHint: 'Optional — so you can find this order again.',
    note: 'Note',
    noteHint: 'Optional — anything worth remembering about this order.',
    linesHeading: 'What you ordered',
    quantityLabel: (productName: string, comesIn: string) =>
      `${productName}, ${comesIn} — how many you ordered`,
    submit: (count: number, total: string | null) =>
      `Save ${pluralItems(count)}${total ? ` · ${total}` : ''}`,
    submitEmpty: 'Type a quantity to add items',
    totalPartial: 'Total leaves out lines without a price',
    /** Read out politely as the total changes; the visible button says the same. */
    totalAnnounce: (count: number, total: string | null) =>
      count === 0 ? 'Nothing added yet' : `${pluralItems(count)}${total ? `, ${total} in total` : ''}`,
    saving: 'Saving…',
    failed: "We couldn't save that. Nothing was changed.",
    done: 'Saved. It is on your list of what is coming.',
    back: 'See what is coming',
  },

  /*
   * The banner on Record a delivery when it was opened from an expectation. It has one job: say
   * what is being received, so a pre-filled form full of numbers nobody typed is explained before
   * it is trusted.
   */
  receive: {
    loading: 'Getting what you ordered…',
    heading: (title: string) => `Receiving ${title}`,
    body: 'We have filled in what is still owed. Change anything that came short, or came extra.',
    reference: (value: string) => `Their number: ${value}`,
    loadFailed:
      "We couldn't load that order, so nothing is filled in. You can still record the delivery yourself.",
    seeAll: 'See what else is coming',
  },

  /**
   * The quiet second figure beside stock on hand in the product list.
   *
   * Understated on purpose: what is coming is a promise somebody made on the phone, not stock you
   * can sell today, and it must never read as part of the number beside it.
   */
  product: {
    coming: (quantity: string) => `· ${quantity} coming`,
    comingAria: (quantity: string) => `${quantity} more on an expected delivery`,
  },
} as const

if (import.meta.env.DEV) {
  const problems = bannedWordProblems(expectedCopy, 'expectedCopy')
  if (problems.length > 0) {
    // eslint-disable-next-line no-console
    console.error('[expected/copy] banned words reached user-facing copy:\n' + problems.join('\n'))
  }
}
