import { useEffect, useRef, useState } from 'react'
import { StockReceipt, type ReceiptState } from '@/features/products/components/StockReceipt'

/**
 * The app's own receipt, not a picture of it: a stock-in recorded on a phone with no signal, then
 * sent. It lands RECORDED and turns SYNCED once, when it scrolls into view: the page's one moment of
 * motion, and the offline promise itself. With reduced motion it simply shows SYNCED.
 */
export function HeroReceipt() {
  const [state, setState] = useState<ReceiptState>('recorded')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setState('synced')
      return
    }
    const element = ref.current
    if (!element) return
    let timer: number | undefined
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect()
          timer = window.setTimeout(() => setState('synced'), 1600)
        }
      },
      { threshold: 0.6 },
    )
    observer.observe(element)
    return () => {
      observer.disconnect()
      window.clearTimeout(timer)
    }
  }, [])

  return (
    <div ref={ref}>
      <div className="mb-3 flex items-center justify-between text-xs font-semibold text-neutral-700">
        <span>Quick mode</span>
        <span className="rounded-sm border border-neutral-300 px-1.5 py-0.5 font-normal" aria-live="polite">
          {state === 'synced' ? 'Back online · sent' : 'No signal · 1 saved'}
        </span>
      </div>
      <StockReceipt
        state={state}
        kind="Stock in"
        id="2f6c9a71-0b5e-4d1f-9c8e-4821a7d4f2b3"
        lines={[
          { label: 'Product', value: 'Rice (50 kg bag)' },
          { label: 'Quantity', value: '2 bags = 100 kg' },
          { label: 'Recorded by', value: 'Tunde' },
          { label: 'On hand now', value: '1,150 kg' },
        ]}
      />
    </div>
  )
}
