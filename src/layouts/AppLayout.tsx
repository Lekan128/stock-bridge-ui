import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { EmailVerificationBanner } from '@/features/profile/components/EmailVerificationBanner'
import { Sidebar } from '@/layouts/Sidebar'
import { Topbar } from '@/layouts/Topbar'

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
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
        <EmailVerificationBanner />
        {/* data-scroll-container: this is the actual scroll region in this layout (the window
            itself never scrolls, since the root is h-screen overflow-hidden) - ScrollToTop
            targets it by that attribute on every navigation. */}
        <main data-scroll-container className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
