import { useEffect, useState } from 'react'

/**
 * The button that follows a phone user down the page, after the hero, and steps aside whenever
 * another "Get my free setup" is on screen, so there are never two (plan §2b).
 */
export function StickyCta() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const buttons = [...document.querySelectorAll('[data-cta]:not([data-cta="sticky"])')]
    if (buttons.length === 0) return
    const visible = new Set<Element>()
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target)
        else visible.delete(entry.target)
      }
      setShow(visible.size === 0 && window.scrollY > 300)
    })
    buttons.forEach((button) => observer.observe(button))
    const onScroll = () => setShow(visible.size === 0 && window.scrollY > 300)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return (
    <div
      hidden={!show}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur sm:hidden"
    >
      <a
        href="/signup"
        data-cta="sticky"
        className="flex min-h-12 w-full items-center justify-center rounded-md bg-action text-base font-semibold text-white hover:bg-action-hover"
      >
        Get my free setup
      </a>
    </div>
  )
}
