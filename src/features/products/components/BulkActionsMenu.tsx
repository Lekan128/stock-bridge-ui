import { useRef, useState } from 'react'
import { CalendarClock, Download, MoreHorizontal, Settings, Tags, Truck, Upload } from 'lucide-react'
import { useClickOutside } from '@/hooks/useClickOutside'

export interface BulkActionsMenuProps {
  /** Bulk upload and SKU settings need MANAGE_PRODUCTS; export only needs VIEW_PRODUCTS. */
  canManageProducts: boolean
  /** "Record a delivery" needs MANAGE_INVENTORY. */
  canRecordDelivery: boolean
  onBulkUpload: () => void
  onRecordDelivery: () => void
  /** Opens the list of what has been ordered and not yet received (task 3.1). */
  onExpectedDeliveries: () => void
  onExport: () => void
  onSkuSettings: () => void
  /** Opens the categories dialog. MANAGE_PRODUCTS, like the other catalog writes here. */
  onManageCategories: () => void
}

export function BulkActionsMenu({
  canManageProducts,
  canRecordDelivery,
  onBulkUpload,
  onRecordDelivery,
  onExpectedDeliveries,
  onExport,
  onSkuSettings,
  onManageCategories,
}: BulkActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false))

  const items = [
    ...(canRecordDelivery ? [{ label: 'Record a delivery', icon: Truck, onClick: onRecordDelivery }] : []),
    // Seeing what is coming is a question about the catalog, so it needs only what this page
    // already needed to open (VIEW_PRODUCTS). Recording one is gated on the page it leads to,
    // which is where the backend draws the same line.
    { label: 'Expected deliveries', icon: CalendarClock, onClick: onExpectedDeliveries },
    ...(canManageProducts
      ? [
          { label: 'Bulk upload', icon: Upload, onClick: onBulkUpload },
          { label: 'Manage categories', icon: Tags, onClick: onManageCategories },
          { label: 'SKU settings', icon: Settings, onClick: onSkuSettings },
        ]
      : []),
    { label: 'Download my products', icon: Download, onClick: onExport },
  ]

  return (
    // At every width, not just on a phone. This used to be mobile-only, which forced the desktop
    // toolbar to show every action as its own button - seven of them by the end of Phase 3, most
    // wrapping onto two lines. The occasional actions live here now and the toolbar keeps the
    // daily one.
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More actions"
        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-200 bg-white p-2.5 text-neutral-600 hover:bg-neutral-50 md:px-3 md:py-2 md:text-sm md:font-medium md:text-neutral-700"
      >
        <MoreHorizontal className="h-4 w-4" />
        <span className="hidden md:inline">More</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-48 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                item.onClick()
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
