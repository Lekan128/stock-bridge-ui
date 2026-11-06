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

  /**
   * The redesigned form (2026-11-04): supplier, items, delivery, "How will Tony get it?", one button.
   * Each title is read on its own; the line under it is only ever extra.
   */
  form: {
    newTitle: 'New purchase order',
    changeTitle: (poNumber: string) => `Change ${poNumber}`,
    changeNoteFor: (supplier: string) =>
      `${supplier} already has this order. When you save, it becomes "Revised" and you send them the update.`,
    supplierLabel: 'Supplier',
    supplierSearch: 'Search suppliers',
    supplierRecent: (when: string, products: string) => `Last order ${when}${products ? ` · ${products}` : ''}`,
    supplierNone: 'No supplier matches that.',
    supplierNew: '+ New supplier',
    supplierChange: 'Change',
    supplierChangeLabel: (supplier: string) => `Change supplier from ${supplier}`,
    supplierFirst: 'Items, delivery and sending show once you pick a supplier.',
    openOrder: (poNumber: string, supplier: string, what: string) =>
      `${poNumber} to ${supplier} hasn't all arrived yet${what ? ` (${what})` : ''}.`,
    openOrderLink: 'Open it',
    itemsHeading: 'Items',
    searchLabel: 'Search or scan a product',
    searchPlaceholder: 'Search or scan a product',
    // "Before" covers both: received from them, and asked of them on an order (never "bought").
    runningLowFrom: (supplier: string) => `Running low · from ${supplier} before`,
    usualFrom: (supplier: string) => `From ${supplier} before`,
    noMatch: (text: string) => `Nothing matches “${text}”.`,
    addProductFirst: 'Add it on the products page first',
    narrow: 'Showing the first few. Type more to narrow it down.',
    searchFailed: "We couldn't search just now.",
    add: 'Add',
    added: 'Added',
    addLabel: (product: string) => `Add ${product}`,
    remove: (product: string) => `Remove ${product}`,
    quantityLabel: (product: string) => `How many ${product}`,
    unitLabel: (product: string) => `Unit for ${product}`,
    less: (product: string) => `One less ${product}`,
    more: (product: string) => `One more ${product}`,
    left: (amount: string) => `${amount} left`,
    low: 'low',
    out: 'Out',
    coming: (amount: string) => `${amount} coming`,
    comingOther: (amount: string) => `${amount} coming on other orders`,
    lastTime: (amount: string) => `last time ${amount}`,
    noQuantity: 'How many?',
    quantityInvalid: 'Type a number above 0.',
    // Prices (plan section 11.4, owner 2026-11-06: "Purchase order comes with a price").
    pricePer: (unit: string) => `Price per ${unit}`,
    priceLabel: (product: string, unit: string) => `Price per ${unit} for ${product}`,
    pricePlaceholder: 'Price',
    priceSamePaid: 'same as last time',
    priceSameAgreed: 'as last agreed',
    priceLastPaid: (amount: string, day: string) => `last paid ${amount} on ${day}`,
    priceLastAgreed: (amount: string, day: string) => `last agreed ${amount} on ${day}`,
    priceInvalid: 'Type a price, like 45,000.',
    noAmount: '—',
    totalsLabel: 'Order total',
    itemsTotal: 'Items',
    delivery: 'Delivery',
    deliveryNotSaid: 'Not said',
    deliveryFree: 'Free',
    deliveryAdd: 'Add',
    deliveryChange: 'Change',
    deliveryLabel: (supplier: string) => `What ${supplier} charges to deliver`,
    deliveryHint: 'Type 0 if delivery is free. Leave it empty if it was not said.',
    deliveryDone: 'Done',
    deliveryInvalid: 'Type an amount, like 5,000.',
    total: 'Total',
    deliveryHeading: 'Delivery',
    deliverTo: 'Deliver to',
    deliverToNone: 'No address saved yet',
    addAddress: 'Add address',
    change: 'Change',
    chooseBranch: 'Choose a branch',
    neededBy: 'Needed by',
    anyTime: 'Any time',
    tomorrow: 'Tomorrow',
    inThreeDays: 'In 3 days',
    nextWeek: 'Next week',
    pickDay: 'Pick a day',
    pickDayLabel: 'Needed by date',
    neededInPast: 'Pick today or a day after today.',
    noteFor: (supplier: string) => `Note for ${supplier}`,
    noteNone: 'None',
    noteAdd: 'Add',
    sendHeading: (supplier: string) => `How will ${supplier} get it?`,
    viaWhatsApp: 'WhatsApp',
    viaWhatsAppHint: (phone: string) => `${phone} · we open WhatsApp with the message typed`,
    viaEmail: 'Email',
    viaEmailHint: (address: string) => `${address}, PDF attached`,
    viaSelf: "I'll send it myself",
    viaSelfHint: 'You get the PDF and the message to copy',
    viaPhone: 'Already ordered by phone',
    viaPhoneHint: "Nothing is sent. It's kept so you can receive it later.",
    addEmailToSend: (supplier: string) => `To email it, add ${supplier}'s email.`,
    addEmail: 'Add email',
    noLogo: "Your logo isn't on the PDF yet.",
    addLogo: 'Add logo',
    buttonChoose: 'Choose a supplier',
    buttonAddItems: 'Add items to order',
    buttonQuantities: 'Say how many of each',
    buttonPrices: 'Add a price for each item',
    buttonOffline: 'Make it when online',
    buttonEmail: (supplier: string) => `Make order and email ${supplier}`,
    buttonWhatsApp: 'Make order, then send on WhatsApp',
    buttonSelf: 'Make order',
    buttonPhone: 'Save order',
    buttonSave: 'Save changes',
    buttonForApproval: 'Send for approval',
    buttonSaveForApproval: 'Save and send for approval',
    approvalHeading: 'Before it goes',
    approvalSays: (supplier: string) => `Someone who can send orders checks it first. Then it goes to ${supplier}.`,
    approvalNoteLabel: 'Note for them (optional)',
    approvalNotePlaceholder: 'Anything they should know',
    making: 'Making it…',
    saving: 'Saving…',
    summary: (supplier: string, count: number, total?: string) =>
      `${supplier} · ${pluralItems(count)}${total ? ` · ${total}` : ''}`,
    offlineNote: "You're offline. This order is kept on this phone; make it once you're connected.",
    failed: "We couldn't make that order. Nothing was saved.",
    changeFailed: "We couldn't save those changes. Nothing was changed.",
    loadFailed: "We couldn't load that order.",
  },

  /** Approval on the order page (V78, plan section 11.5, mockups 3B/3C). */
  approval: {
    label: 'Approval',
    someone: 'Someone',
    wantsToSend: (asker: string, supplier: string) => `${asker} wants to send this to ${supplier}`,
    askedWhen: (when: string) => `Sent for approval ${when}`,
    approve: 'Approve and send',
    approveAnyway: 'Approve it as it is',
    askChange: 'Ask for a change',
    whatToChange: (asker: string) => `What should ${asker} change?`,
    sendTo: (asker: string) => `Send to ${asker}`,
    cancel: 'Cancel',
    waitingYou: 'Waiting for approval',
    waitingYouNote: (supplier: string) =>
      `Someone who can send orders will check it. Once they approve it, it goes to ${supplier}.`,
    changeAskedYou: (by: string) => `${by} asked for a change`,
    changeAskedWaiting: (asker: string) => `Waiting for ${asker} to change it`,
    changeOrder: 'Change order',
    failed: "That didn't go through. Try again.",
  },

  /** The order page's "Next step" box and its history (redesign 2026-11-04). */
  next: {
    made: (poNumber: string, supplier: string) => `${poNumber} is made. Now send it to ${supplier}.`,
    notSent: (supplier: string) => `Not sent to ${supplier} yet`,
    approvedSend: (supplier: string) => `Approved. Now send it to ${supplier}.`,
    changed: (supplier: string) => `You changed this order. Send ${supplier} the update.`,
    /** Only what we know: the provider took the email; the buyer opened WhatsApp or copied the message. */
    sentEmail: (supplier: string, when: string) => `Emailed to ${supplier} · ${when}`,
    sentWhatsApp: (supplier: string, when: string) => `You opened WhatsApp to ${supplier} · ${when}`,
    sentMessage: (supplier: string, when: string) => `You copied the message for ${supplier} · ${when}`,
    byPhone: (when: string) => `Ordered by phone · ${when}`,
    byPhoneNote: (supplier: string) => `Nothing was sent to ${supplier}.`,
    stillToCome: (what: string) => `${what} still to come`,
    itemsToCome: (count: number) => `${pluralItems(count)} still to come`,
    allArrived: (when: string) => (when ? `Everything arrived · ${when}` : 'Everything arrived'),
    calledOff: 'Called off',
    calledOffNote: 'Nothing in your stock changed.',
    writtenDown: (supplier: string) => `Waiting for ${supplier}`,
    sendWhatsApp: 'Send on WhatsApp',
    sendEmail: (address: string) => `Email ${address}`,
    emailIt: 'Email it',
    copy: 'Copy message',
    copied: 'Copied',
    pdf: 'View PDF',
    or: 'Or:',
    sendAgain: 'Send again',
    sendAfterAll: (supplier: string) => `Send it to ${supplier} after all`,
    receive: 'Record what arrived',
    receiveEarly: 'Goods already here? Record what arrived',
    restNotComing: "The rest isn't coming",
    closeAsk: (poNumber: string, what: string) =>
      `Close ${poNumber}? ${what} won't be expected any more. What already arrived stays in your stock.`,
    closeYes: 'Yes, close it',
    closeNo: 'No, keep waiting',
    closedShort: (when: string) => `Closed · the rest didn't come${when ? ` · ${when}` : ''}`,
    closedShortNote: 'What arrived is in your stock.',
    closedToast: 'Closed. What arrived stays in your stock.',
    receiveRest: 'Record what arrived',
    orderAgain: 'Order again',
    seeDeliveries: 'See deliveries in Purchase history',
    emailProblem: (address: string) => `Email didn't reach ${address}`,
    emailProblemNote: 'The address may be wrong. Fix it, or send another way.',
    emailNotSent: (supplier: string) => `The email to ${supplier} didn't go`,
    fixEmail: 'Fix email',
    itemsHeading: 'Items',
    product: 'Product',
    ordered: 'Ordered',
    arrived: 'Arrived',
    amount: 'Amount',
    pricePer: (price: string, unit: string) => `${price} a ${unit}`,
    deliveryRow: 'Delivery',
    deliveryFree: 'Free',
    totalRow: 'Total',
    noPrices: 'This order was made before prices, so it has none.',
    noteHeading: (supplier: string) => `Note for ${supplier}`,
    historyHeading: 'History',
    madeBy: (name: string) => `Made by ${name}`,
    madeAnon: 'Made',
    emailed: (address: string) => `Emailed to ${address}`,
    emailFailed: (address: string) => `Email to ${address} didn't go through`,
    whatsappOpened: (supplier: string) => `You opened WhatsApp to ${supplier}`,
    messageCopied: 'You copied the message',
    orderedByPhone: 'Marked as ordered by phone',
    sentForApproval: (name: string) => `Sent for approval by ${name}`,
    sentBack: (what: string, why: string) => `${what} sent back · ${why}`,
    approvedBy: (name: string) => `Approved by ${name}`,
    changeAskedBy: (name: string, note: string) => `${name} asked for a change: “${note}”`,
    received: (name: string | null, count: number) =>
      `${pluralItems(count)} received${name ? ` by ${name}` : ''}`,
    seeDelivery: 'See delivery',
    menuLabel: (poNumber: string) => `More actions for ${poNumber}`,
    menuPdf: 'View / print PDF',
    menuChange: 'Change order',
    menuAgain: 'Order again',
    menuSendAgain: 'Send again',
    menuCallOff: 'Call it off',
    sentAgainAsk: 'You sent this a moment ago. Send it again?',
    sentAgainYes: 'Yes, send again',
    sentAgainNo: 'No',
  },

  /**
   * Record a delivery, once a supplier is picked and they have orders still to come: what is on each,
   * so whoever is at the gate can compare it with the lorry before anything is filled in.
   */
  match: {
    headingOne: (poNumber: string, supplier: string) => `Is this ${poNumber} from ${supplier}?`,
    olderOrders: (count: number) => (count === 1 ? "It's an older order (1 more)" : `It's an older order (${count} more)`),
    anOrder: 'an order',
    made: (when: string, by: string | null) => (by ? `made ${when} by ${by}` : `made ${when}`),
    needed: (when: string) => `needed ${when === 'Today' || when === 'Tomorrow' ? when.toLowerCase() : when}`,
    caption: (poNumber: string) => `What is still to come on ${poNumber}`,
    alreadyArrived: (amount: string) => `${amount} already arrived`,
    showAll: (count: number) => `Show all ${count}`,
    // One answer, on purpose: whoever is at the gate goes through the numbers every time. A one-tap
    // "it all came" was tried and dropped (2026-11-05) - it invites accepting a lorry nobody counted.
    check: 'Check what came',
    checkLabel: (poNumber: string) => `Check what came on ${poNumber}`,
    somethingElse: "No, it's something else",
    stockInHint: (amount: string, poNumber: string, supplier: string) => `${amount} coming on ${poNumber} from ${supplier}.`,
    stockInLink: 'Receive that instead',
  },

  /** The list (redesign 2026-11-04): search, chips with counts, one row per order. */
  rows: {
    new: 'New purchase order',
    searchLabel: 'Search purchase orders',
    searchPlaceholder: 'PO number, supplier or product',
    chips: 'Which orders to show',
    toApprove: 'To approve',
    askingForPrices: 'Asking for prices',
    askForPrices: 'Ask for prices',
    rfqSuppliers: (count: number) => (count === 1 ? '1 supplier' : `${count} suppliers`),
    rfqReplied: (done: number, all: number) => `${done} of ${all} replied`,
    rfqBecame: (orders: string) => `Became ${orders}`,
    rfqClosed: 'Closed',
    pillAsking: 'Asking',
    pillCompare: 'Ready to compare',
    pillDone: 'Done',
    compare: 'Compare',
    open: 'Open',
    toSend: 'To send',
    waiting: 'Waiting',
    late: 'Late',
    arrived: 'Arrived',
    all: 'All',
    openToApprove: 'Check',
    approveLabel: (supplier: string) => `Check the order to ${supplier}`,
    pillToApprove: 'Waiting for approval',
    pillChangeAsked: 'Change asked for',
    pillNotSent: 'Not sent',
    pillChanged: 'Changed',
    pillSent: 'Sent',
    pillPart: 'Part arrived',
    pillLate: 'Late',
    pillArrived: 'All arrived',
    pillCalledOff: 'Called off',
    pillClosed: 'Closed',
    pillByPhone: 'By phone',
    send: 'Send',
    receive: 'Receive',
    sendLabel: (title: string) => `Send ${title}`,
    receiveLabel: (title: string) => `Receive ${title}`,
    items: (count: number) => pluralItems(count),
    needed: (when: string) => `needed ${when.toLowerCase() === 'today' || when.toLowerCase() === 'tomorrow' ? when.toLowerCase() : when}`,
    anyTime: 'any time',
    toCome: (what: string) => `${what} still to come`,
    goingTo: (branch: string) => `to ${branch}`,
    via: { EMAIL: 'emailed', WHATSAPP: 'WhatsApp', MESSAGE: 'message copied', PHONE: 'by phone' } as Record<string, string>,
    emptyTitle: {
      TO_APPROVE: 'Nothing waiting for approval',
      RFQ: 'Not asking anyone for prices',
      TO_SEND: 'Nothing to send',
      WAITING: 'Nothing on its way',
      LATE: 'Nothing late',
      ARRIVED: 'Nothing has arrived yet',
      ALL: 'No purchase orders yet',
    } as Record<string, string>,
    emptyBody: {
      TO_APPROVE: 'Orders sent for approval show here until someone who can send says yes.',
      RFQ: 'Ask a few suppliers at once, and compare their prices before you order.',
      TO_SEND: 'Every order has gone to its supplier.',
      WAITING: 'When you send an order, it waits here until it arrives.',
      LATE: 'Every order on its way is still on time.',
      ARRIVED: 'Orders that have fully arrived show here.',
      ALL: 'Make one when you order from a supplier. Receiving it later takes one tap.',
    } as Record<string, string>,
    emptySearch: (text: string) => `No purchase order matches “${text}”.`,
    writtenDown: 'Written down',
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
    poLabel: (poNumber: string) => `Purchase order ${poNumber}`,
    theSupplier: 'the supplier',
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
