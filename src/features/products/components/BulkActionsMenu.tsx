import { useRef, useState } from 'react'
import { Download, FileSpreadsheet, MoreVertical, Upload } from 'lucide-react'
import { useClickOutside } from '@/hooks/useClickOutside'

export interface BulkActionsMenuProps {
  onBulkUpload: () => void
  onDownloadTemplate: () => void
  onExport: () => void
}

export function BulkActionsMenu({ onBulkUpload, onDownloadTemplate, onExport }: BulkActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false))

  const items = [
    { label: 'Bulk upload', icon: Upload, onClick: onBulkUpload },
    { label: 'Download template', icon: FileSpreadsheet, onClick: onDownloadTemplate },
    { label: 'Export', icon: Download, onClick: onExport },
  ]

  return (
    <div className="relative md:hidden" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Bulk actions"
        className="inline-flex items-center justify-center rounded-md border border-neutral-200 bg-white p-2.5 text-neutral-600 hover:bg-neutral-50"
      >
        <MoreVertical className="h-4 w-4" />
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
