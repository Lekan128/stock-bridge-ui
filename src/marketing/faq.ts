/**
 * The questions that stop a signup, answered (LANDING_PAGE_PLAN.md §3). One list for the page and for
 * its FAQPage JSON-LD, so the two can't drift. Every answer was checked against the product on
 * 2026-10-05: one stock location per account, scanners but no phone-camera scanning.
 */
export const FAQ: { question: string; answer: string }[] = [
  {
    question: 'How is this different from just using Excel?',
    answer:
      "Excel is one file on one computer. When your staff record sales on their phones, everyone would need to update the same file, and Excel won't tell you who changed a number or when. Procurepaddy works on every staff phone, even with no network. Every change carries the name and time of whoever made it, a count shows exactly what's missing, and it understands that 2 bags of rice is 100 kg. Bring your Excel with you: we import it, and you can download your products to Excel any time.",
  },
  {
    question: 'Does it really work without internet?',
    answer:
      'Yes. Record stock in, stock out and counts with no signal. They are kept on the phone and sent the moment it reconnects, each one exactly once. The app shows how many are waiting.',
  },
  {
    question: 'What if my phone is lost, stolen or broken?',
    answer:
      'Everything already sent is safe on our servers: log in on any other phone and carry on. Records made offline and not yet sent are on that phone, which is why the app shows "3 saved on this phone" until they go.',
  },
  {
    question: 'Can I see what my staff recorded?',
    answer:
      'Yes. Every stock change shows who made it and when, and each staff member can only do what you allow, for example record deliveries but not counts. Counting a shelf shows the difference between what is there and what was recorded.',
  },
  {
    question: 'How long does setup take?',
    answer:
      'Send us your list and your products are in within 24 hours. If you would rather do it yourself, the Excel import takes minutes.',
  },
  {
    question: 'Do I need a computer?',
    answer: 'No. Procurepaddy runs on the phone you have and installs like an app. A laptop works too.',
  },
  {
    question: 'I buy in bags and cartons but sell in kilos and pieces. Does it handle that?',
    answer: 'Yes. Set the pack once ("bag of 50 kg") and record in whichever is easier. Procurepaddy converts.',
  },
  {
    question: 'Is it really free? What happens after 12 months?',
    answer:
      'Yes. Founding shops get every feature free for 12 months, with no card. After that they pay ₦5,000 a month instead of the regular ₦10,000, for as long as they stay. Shops that join after the founding offer ends pay the regular price.',
  },
  {
    question: 'Can I use a barcode scanner?',
    answer: 'Yes. A USB or Bluetooth scanner works in quick mode: scan, type the amount, done.',
  },
  {
    question: 'Can I use it for more than one shop or warehouse?',
    answer: 'Today each account keeps one stock location. If you run several, talk to us on WhatsApp.',
  },
  {
    question: 'Is this a POS or accounting software?',
    answer:
      "No. It's stock control: what came in, what went out, what it cost and what's left. It works alongside your POS and your accountant.",
  },
  {
    question: 'Can I get my data out?',
    answer: 'Yes, any time. Download your products to Excel in one tap.',
  },
  {
    question: 'Who is behind Procurepaddy?',
    answer:
      "A Nigerian team. Procurepaddy is co-owned with ProcurePal, its procurement partner, so you'll soon be able to buy stock and have it land in your records automatically.",
  },
]
