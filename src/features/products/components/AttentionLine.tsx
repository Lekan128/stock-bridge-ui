import { useId, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

export interface AttentionItem {
  key: string
  /** The few words that say it on the collapsed line: "3 products need a quick fix". */
  summary: string
  /** The full notice, shown when the line is opened. */
  content: ReactNode
}

/**
 * "2 things need a look ›" (C1, finding U1): the notices that used to stack as full banners above
 * the Inventory list — products needing a fix, stock on its way — folded into one line that opens
 * in place. The list starts near the top of the screen again, and nothing is hidden: each notice's
 * gist is on the line itself.
 */
export function AttentionLine({ items }: { items: AttentionItem[] }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  if (items.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 rounded-md border border-warning-200 bg-warning-50 px-3 py-2 text-left text-sm text-warning-900 hover:bg-warning-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning-500"
      >
        <span className="font-semibold whitespace-nowrap">
          {items.length === 1 ? '1 thing needs a look' : `${items.length} things need a look`}
        </span>
        <span className="min-w-0 flex-1 truncate text-warning-800">
          <span aria-hidden="true">· </span>
          {items.map((item) => item.summary).join(' · ')}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      <div id={panelId} hidden={!open} className="flex flex-col gap-3">
        {items.map((item) => (
          <div key={item.key}>{item.content}</div>
        ))}
      </div>
    </div>
  )
}
