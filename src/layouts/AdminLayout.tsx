import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useSuperAdminAuth } from '@/auth/useSuperAdminAuth'
import { Logo } from '@/components/Logo'
import { ADMIN_NAV_ITEMS } from '@/layouts/adminNavConfig'

const sidebarLinkClassName = (isActive: boolean) =>
  `flex items-center gap-3 rounded-md border-l-2 px-3 py-2.5 text-sm font-medium transition-colors ${
    isActive
      ? 'border-accent-600 bg-neutral-50 text-neutral-900'
      : 'border-transparent text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
  }`

const tabLinkClassName = (isActive: boolean) =>
  `flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive ? 'bg-primary-50 text-primary-700' : 'text-neutral-600 hover:bg-neutral-50'
  }`

export function AdminLayout() {
  const { admin, logout } = useSuperAdminAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <header className="flex items-center justify-between border-b border-primary-800 bg-primary-900 px-6 py-3 text-white">
        <div className="flex items-center gap-3">
          <Logo size={28} variant="icon" />
          <span className="font-semibold">Stock Bridge</span>
          <span className="rounded-md bg-primary-700 px-2 py-0.5 text-xs font-medium uppercase tracking-wide">
            Super Admin
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {admin && <span className="text-primary-200">{admin.username ?? admin.id}</span>}
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="rounded-md border border-primary-700 px-3 py-1.5 hover:bg-primary-800"
          >
            Log out
          </button>
        </div>
      </header>

      {/* Below md: a horizontal tab row replaces the sidebar — only 2 sections, so a
          drawer/hamburger would be overkill; this keeps the section usable at tablet width. */}
      <nav className="flex gap-1 overflow-x-auto border-b border-neutral-200 bg-white px-4 py-2 md:hidden">
        {ADMIN_NAV_ITEMS.map((item) => (
          <NavLink key={item.path} to={item.path} className={({ isActive }) => tabLinkClassName(isActive)}>
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="flex flex-1">
        <aside className="hidden w-56 shrink-0 flex-col border-r border-neutral-200 bg-white md:flex">
          <nav className="flex flex-col gap-1 p-3">
            {ADMIN_NAV_ITEMS.map((item) => (
              <NavLink key={item.path} to={item.path} className={({ isActive }) => sidebarLinkClassName(isActive)}>
                <item.icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
