import { useState } from 'react'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { useToast } from '@/components/useToast'
import { productsApi } from '@/features/products/api/productsApi'
import { useSellingPolicy } from '@/features/selling/useSellingPolicy'
import { downloadBlob } from '@/utils/downloadBlob'

/**
 * "Add prices in a sheet" (`SELLING_PRICE_PLAN.md` §6.8): the fast way to price 400 products on day
 * one. Downloads the products that have no selling price - name, code, pack, what you pay, and an
 * empty "Selling price for one" - to fill in and upload back on Bulk upload.
 *
 * Only for a company that records sales and may change products; renders nothing otherwise.
 */
export function PriceSheetLink({
  children = 'Add prices in a sheet',
  lead,
  className,
}: {
  children?: string
  /** A sentence before the link; with it, the whole line is a paragraph (and goes when the link does). */
  lead?: string
  className?: string
}) {
  const { user } = useAuth()
  const { recordsSales, requiresSellingPrice } = useSellingPolicy()
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)
  const canManageProducts = user?.type === 'tenant' && user.permissions.includes(PERMISSIONS.MANAGE_PRODUCTS)
  if (!recordsSales || requiresSellingPrice || !canManageProducts) return null

  async function download() {
    setBusy(true)
    try {
      downloadBlob(await productsApi.exportPrices(), 'selling-prices.xlsx')
      showToast('Price sheet downloaded. Fill in the prices, then upload it on Bulk upload.', 'success')
    } catch {
      showToast("Couldn't download the price sheet. Try again.", 'error')
    } finally {
      setBusy(false)
    }
  }

  const button = (
    <button
      type="button"
      onClick={() => void download()}
      disabled={busy}
      className="-my-2 inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-60"
    >
      {busy ? 'Preparing the sheet…' : children}
    </button>
  )
  if (lead == null && className == null) return button
  return (
    <p className={className ?? 'text-sm text-neutral-600'}>
      {lead && `${lead} `}
      {button}
    </p>
  )
}
