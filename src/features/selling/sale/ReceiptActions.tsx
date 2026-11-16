import { Printer, Share2 } from 'lucide-react'
import { Button } from '@/components/Button'
import { useToast } from '@/components/useToast'
import { printReceipt } from '@/features/selling/sale/printReceipt'
import { shareReceipt, type ReceiptData } from '@/features/selling/sale/receipt'
import { PrintableReceipt } from '@/features/selling/sale/SaleReceipt'

/** Print and Share, side by side (selling till Steps 1-2), with the printable copy they print. */
export function ReceiptActions({ receipt, size = 'large' }: { receipt: ReceiptData; size?: 'large' | 'small' }) {
  const { showToast } = useToast()
  async function share() {
    const outcome = await shareReceipt(receipt)
    if (outcome === 'copied') showToast('Receipt copied. Paste it into a chat or a message.', 'success')
    if (outcome === 'failed') showToast("Couldn't share the receipt. Try Print.", 'error')
  }
  const tall = size === 'large' ? 'min-h-12 text-base' : ''
  return (
    <>
      <PrintableReceipt receipt={receipt} />
      <div className="grid grid-cols-2 gap-3">
        <Button variant="action" onClick={printReceipt} className={tall}>
          <Printer className="h-5 w-5" aria-hidden="true" />
          Print
        </Button>
        <Button variant="action" onClick={() => void share()} className={tall}>
          <Share2 className="h-5 w-5" aria-hidden="true" />
          Share
        </Button>
      </div>
    </>
  )
}
