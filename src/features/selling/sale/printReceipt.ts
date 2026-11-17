/** Prints the `PrintableReceipt` on the page, and only it. */
export function printReceipt() {
  const root = document.documentElement
  root.dataset.page = 'sale-receipt'
  const done = () => {
    if (root.dataset.page === 'sale-receipt') delete root.dataset.page
    window.removeEventListener('afterprint', done)
  }
  window.addEventListener('afterprint', done)
  window.print()
}
