import { lazy, Suspense, useEffect, useState } from 'react'
import { BranchProvider } from '@/features/branches/BranchProvider'
import { BranchQuestion } from '@/features/branches/BranchQuestion'
import { MoveFromLink } from '@/features/moves/MoveFromLink'
import { Outlet, useLocation } from 'react-router-dom'
import { EmailVerificationBanner } from '@/features/profile/components/EmailVerificationBanner'
import { Sidebar } from '@/layouts/Sidebar'
import { Topbar } from '@/layouts/Topbar'
import { SupportSessionBanner } from '@/features/onboarding/SupportSessionBanner'
import { IosInstallHint } from '@/pwa/IosInstallHint'
import { startServiceWorker } from '@/pwa/serviceWorker'
import { UpdatePrompt } from '@/pwa/UpdatePrompt'

// B1 spike only: absent from a normal production build (see designPreviewConfig.ts).
const DesignPreviewChip =
  import.meta.env.DEV || import.meta.env.VITE_DESIGN_PREVIEW === 'true'
    ? lazy(() => import('@/features/designPreview/DesignPreviewChip').then((m) => ({ default: m.DesignPreviewChip })))
    : null

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const list = window.matchMedia(query)
    const change = () => setMatches(list.matches)
    change()
    list.addEventListener('change', change)
    return () => list.removeEventListener('change', change)
  }, [query])
  return matches
}

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  // Record a sale is a till (selling till Step 1, owner 2026-11-16): the menu shrinks to icons and the page
  // takes the whole window on a large screen. Opening the menu there doesn't change it everywhere else.
  // Only below a full laptop width (a tablet, a small laptop) does the menu shrink by itself (owner, 2026-11-16).
  const roomy = useMediaQuery('(min-width: 1280px)')
  // ...and a table's bill (V99) is the same till.
  const onTill = ['/app/sell', '/app/sell/bill'].includes(useLocation().pathname)
  const till = onTill && !roomy
  const [tillMenuOpen, setTillMenuOpen] = useState(false)

  // The workspace is where the offline shell is installed — see `pwa/serviceWorker.ts` for why
  // the storefront never installs it.
  useEffect(() => {
    startServiceWorker({ install: true })
  }, [])

  // The workspace's own typeface (D4), on <html> so dialogs portaled to <body> share it.
  useEffect(() => {
    document.documentElement.dataset.surface = 'workspace'
    return () => {
      delete document.documentElement.dataset.surface
    }
  }, [])

  return (
    <BranchProvider>
    <div className="flex h-screen overflow-hidden bg-neutral-50">
      <Sidebar
        collapsed={till ? !tillMenuOpen : collapsed}
        onToggleCollapse={() => (till ? setTillMenuOpen((open) => !open) : setCollapsed((c) => !c))}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMobileSidebar={() => setMobileOpen(true)} />
        {/*
          Below the topbar and outside <main>, so it stays put instead of scrolling away with
          the page content - the condition it reports is standing, not incidental to whatever
          route is open. It renders null for verified users, so this costs an unaffected user
          nothing. Its own shrink-0 keeps it from being squeezed by the scroll area beneath it.
        */}
        <SupportSessionBanner />
        <EmailVerificationBanner />
        <IosInstallHint />
        {/* data-scroll-container: this is the actual scroll region in this layout (the window
            itself never scrolls, since the root is h-screen overflow-hidden) - ScrollToTop
            targets it by that attribute on every navigation. */}
        <main data-scroll-container className={`flex-1 overflow-y-auto p-6 ${onTill ? 'lg:overflow-hidden lg:p-0' : ''}`}>
          <Outlet />
        </main>
      </div>
      <UpdatePrompt />
      <BranchQuestion />
      {/* The bell's "2 items from the Store to confirm" opens the move over whatever page it lands on. */}
      <MoveFromLink />
      {DesignPreviewChip && (
        <Suspense fallback={null}>
          <DesignPreviewChip />
        </Suspense>
      )}
    </div>
    </BranchProvider>
  )
}
