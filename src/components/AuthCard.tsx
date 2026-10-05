import type { ReactNode } from 'react'
import { Logo } from '@/components/Logo'
import { ContourLines } from '@/components/brand/ContourLines'

export interface AuthCardProps {
  title: string
  subtitle?: string
  /** Small label rendered between the logo and title — used to visually distinguish a
   * non-tenant auth context (e.g. "Super Admin") so it's never confused with tenant login. */
  eyebrow?: ReactNode
  children: ReactNode
  footer?: ReactNode
  /**
   * The brand panel beside the form, on large screens only: navy, the brand's contour lines, and
   * one plain sentence about what the app is for. For the workspace's own log in and sign up — not
   * the super admin or vendor screens, where that sentence would be about the wrong product.
   * Phones keep the card alone: the form is the whole job there.
   */
  showcase?: boolean
}

export function AuthCard({ title, subtitle, eyebrow, children, footer, showcase = false }: AuthCardProps) {
  const card = (
    <div className="w-full max-w-sm animate-fade-slide-up rounded-lg border border-neutral-200 bg-white p-8 shadow-sm">
      <div className={`mb-6 flex justify-center ${showcase ? 'lg:hidden' : ''}`}>
        <Logo size={30} />
      </div>
      {eyebrow && <div className="mb-2 flex justify-center">{eyebrow}</div>}
      <h1 className="text-center text-xl font-semibold text-neutral-900">{title}</h1>
      {subtitle && <p className="mt-1 text-center text-sm text-neutral-500">{subtitle}</p>}
      <div className="mt-6">{children}</div>
      {footer && <div className="mt-6 text-center text-sm">{footer}</div>}
    </div>
  )

  if (!showcase) {
    return <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12">{card}</div>
  }

  return (
    <div className="min-h-screen bg-neutral-50 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-primary-900 text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <ContourLines className="absolute inset-0 h-full w-full text-white/[0.09]" />
        <Logo size={30} tone="inverse" className="relative" />
        <div className="relative max-w-md">
          <p className="text-3xl leading-tight font-semibold text-balance">Stock you can count on.</p>
          <p className="mt-4 text-base leading-relaxed text-primary-100">
            Record deliveries, sales and counts on the shop floor, even when the signal drops. Everything
            is sent the moment you're back online.
          </p>
        </div>
      </aside>
      <main className="flex min-h-screen items-center justify-center px-4 py-12">{card}</main>
    </div>
  )
}
