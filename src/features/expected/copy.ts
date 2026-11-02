import { bannedWordProblems, formatCount } from '@/features/imports/copy'

/**
 * Every user-facing string for expected deliveries, in one file — the rule
 * `features/imports/copy.ts` sets out, followed here for the same reasons.
 *
 * The voice is that file's voice: plain, warm, short sentences, no jargon, no exclamation marks,
 * and no id ever rendered to anybody. Two habits worth naming because this feature is where they
 * are easiest to break:
 *
 *  1. **A purchase order is "a purchase order"; one written down by phone is "what you ordered".**
 *     This feature began as expected deliveries — no numbers, nothing sent to a supplier — and in
 *     November 2026 grew purchase orders (`PURCHASE_ORDER_PLAN.md`): a number, a PDF, and something to
 *     send. They are one list and one record, so the page is called **Purchase orders**. Never plain
 *     "Orders" — that is "Marketplace orders" (bought on Procure Paddy) and must not be confused with
 *     this. There are no prices and no approval step on a purchase order: it says what is wanted, and
 *     the supplier answers with the price.
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
    title: 'Purchase orders',
    subtitle: 'Orders you send to your suppliers.',
    add: 'New purchase order',
    /** Under a purchase order's title: what became of sending it. */
    notSent: 'Not sent yet',
    emailedTo: (address: string) => `Emailed to ${address}`,
    emailProblem: 'Email did not go through',
    whatsappOpened: 'WhatsApp opened',
    messageCopied: 'Message copied',
    writtenDown: 'Written down',
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
      'When you order from a supplier, make a purchase order here. You will see what is coming, and receiving it later takes one tap.',
    emptyAllTitle: 'Nothing here yet',
    emptyAllBody: 'Once you make a purchase order, it stays here — even after it arrives.',
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
  /**
   * "New purchase order" — the same page as "Record what you ordered", in its other mode. The link
   * under the title flips between them in place, so nothing typed is lost.
   */
  order: {
    title: 'New purchase order',
    subtitle: 'Tell a supplier what you want.',
    recordLink: 'Already ordered by phone? Just record it',
    supplier: 'Supplier',
    supplierPlaceholder: 'Choose a supplier',
    supplierHint: 'Choose one and we will show you their products, and how you can send them this order.',
    needed: 'Needed by',
    neededHint: 'Optional.',
    note: 'Note for the supplier',
    noteHint: 'Optional.',
    linesHeading: 'What do you want?',
    quantityLabel: (productName: string, comesIn: string) => `${productName}, ${comesIn} — how many you want`,
    chooseSupplier: 'Choose a supplier first',
    noneLinked: (supplier: string) => `None of your products are linked to ${supplier} yet, so here is everything.`,
    submit: 'Create purchase order',
    submitAndEmail: (supplier: string) => `Create and email ${supplier}`,
    submitEmpty: 'Type a quantity to add items',
    count: (count: number) => pluralItems(count),
    creating: 'Creating…',
    failed: "We couldn't create that. Nothing was saved.",
    /** The "What happens next" box — the explanation, read before the button is pressed. */
    happens: {
      heading: 'What happens next',
      pdf: 'A PDF of this order is made',
      emailed: (address: string) => `It is emailed to ${address}`,
      // What is on offer on the next screen, said once and only for what this supplier can do.
      nextBoth: 'Next, you can email it, send it on WhatsApp or copy the message',
      nextEmail: 'Next, you can email it or copy the message',
      nextWhatsApp: 'Next, you can send it on WhatsApp or copy the message',
      nextCopy: 'Next, you can copy the message and send it yourself',
      nextAfterEmail: 'You can also send it on WhatsApp or copy the message from the next screen',
      nextAfterEmailCopyOnly: 'You can also copy the message from the next screen',
    },
    noLogo: "Your logo isn't on this yet.",
    addLogo: 'Add logo',
    noContact: (supplier: string) =>
      `No phone or email saved for ${supplier}. You can still make the order and send it yourself.`,
  },

  /** The supplier's phone and email, and the email switch, under the supplier field. */
  contact: {
    emailLabel: 'Email',
    noEmail: (supplier: string) => `No email for ${supplier}`,
    addEmail: 'Add one',
    changeEmail: 'Change',
    emailField: 'Supplier email address',
    emailPlaceholder: 'name@example.com',
    saveEmail: 'Save',
    cancelEmail: 'Cancel',
    saving: 'Saving…',
    emailHelp: (supplier: string) => `We'll use it for this order and keep it for ${supplier}.`,
    emailInvalid: "That doesn't look like an email address.",
    emailSaveFailed: "We couldn't save that email. Nothing was changed.",
    // A supplier on Procure Paddy keeps their own details; the buyer cannot edit them.
    emailLocked: (supplier: string) => `${supplier} manages their own details, so we can't add one for them.`,
    switchLabel: (address: string) => `Email this order to ${address}`,
    // Beside where the switch would be: why there is none, and the way to get one.
    noEmailToSendTo: (supplier: string) => `To email this order, ${supplier} needs an email address.`,
  },

  /**
   * One purchase order's own page — where you land after creating it, and where "did I send it?" is
   * answered a week later. Each way of sending is one line with one plain status; nothing is claimed
   * that we cannot know (WhatsApp is only ever "you opened it", never "delivered").
   */
  page: {
    ready: (poNumber: string) => `Purchase order ${poNumber} is ready`,
    readySub: 'It is saved. Here is how to get it to your supplier.',
    back: 'All purchase orders',
    receiveHint: 'When the goods arrive, tap Receive on this order.',
    sendHeading: (supplier: string) => `Send it to ${supplier}`,
    needed: (date: string) => `Needed by ${date}`,
    neededNone: 'No date asked for',
    deliverTo: (branch: string) => `Deliver to ${branch}`,
    itemsHeading: 'What you asked for',
    lines: (count: number) => pluralItems(count),
    calledOff: 'Called off',
    calledOffNote: 'This order was called off, so there is nothing to send.',
    loadFailed: "We couldn't load that purchase order.",
    notFound: "We couldn't find that purchase order.",
    revised: (revision: number) => `Revised (${revision})`,

    email: {
      label: 'Email',
      notSent: 'Not sent',
      sending: 'Sending…',
      sentTo: (address: string, when: string) => `Emailed to ${address} · ${when}`,
      send: (address: string) => `Email it to ${address}`,
      sendAgain: 'Send again',
      sendAgainAsk: 'You emailed this a moment ago. Send it again?',
      sendAgainYes: 'Yes, send again',
      sendAgainNo: 'No',
      noAddress: (supplier: string) => `No email for ${supplier}`,
      add: 'Add one',
      fix: 'Fix email',
      tryAgain: 'Try again',
      confirmMine: 'Send me the confirmation email',
      confirmSent: 'We sent you a confirmation email. Open it, then come back and send this.',
      confirmFailed: "We couldn't send the confirmation email. Try again in a moment.",
      failed: "We couldn't send that. Try again in a moment.",
    },
    whatsapp: {
      label: 'WhatsApp',
      send: 'Send on WhatsApp',
      openedAt: (when: string) => `You opened WhatsApp · ${when}`,
      again: 'Open again',
    },
    message: {
      label: 'Message',
      copy: 'Copy message',
      copied: 'Copied',
      copiedAt: (when: string) => `You copied it · ${when}`,
      copyFailed: "Couldn't copy it. Select the text and copy it yourself.",
      again: 'Copy again',
    },
    pdf: {
      label: 'Order',
      open: 'View / print PDF',
    },
    nothingToSendWith: (supplier: string) =>
      `${supplier} has no phone or email saved. Copy the message or open the PDF and send it yourself.`,
    justNow: 'just now',
  },

  create: {
    title: 'Say what you ordered',
    subtitle: 'Write down what a supplier promised you, so everyone can see what is coming.',
    makeOrderLink: 'Want to send them a purchase order instead?',
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
    back: 'All purchase orders',
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
