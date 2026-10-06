import { useEffect, type ReactNode } from 'react'

const BAR_HEIGHT = '4.5rem'

/**
 * The product page's stock actions on a phone (C2): pinned to the bottom, in reach of the thumb —
 * Stock in, Stock out, Count. Publishes its height so toasts rise above it.
 */
export function ProductActionBar({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--bottom-bar-height', BAR_HEIGHT)
    return () => {
      root.style.removeProperty('--bottom-bar-height')
    }
  }, [])

  return (
    <div
      role="region"
      aria-label="Stock actions"
      className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-neutral-200 bg-white/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:hidden [&>*]:flex-1 [&>*]:px-2 [&>*]:whitespace-nowrap"
    >
      {children}
    </div>
  )
}
