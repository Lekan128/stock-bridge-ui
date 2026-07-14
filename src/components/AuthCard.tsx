import type { ReactNode } from 'react'
import { Logo } from '@/components/Logo'

export interface AuthCardProps {
  title: string
  subtitle?: string
  /** Small label rendered between the logo and title — used to visually distinguish a
   * non-tenant auth context (e.g. "Super Admin") so it's never confused with tenant login. */
  eyebrow?: ReactNode
  children: ReactNode
  footer?: ReactNode
}

export function AuthCard({ title, subtitle, eyebrow, children, footer }: AuthCardProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12">
      <div className="w-full max-w-sm animate-fade-slide-up rounded-lg border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex justify-center">
          <Logo size={40} />
        </div>
        {eyebrow && <div className="mb-2 flex justify-center">{eyebrow}</div>}
        <h1 className="text-center text-xl font-semibold text-neutral-900">{title}</h1>
        {subtitle && <p className="mt-1 text-center text-sm text-neutral-500">{subtitle}</p>}
        <div className="mt-6">{children}</div>
        {footer && <div className="mt-6 text-center text-sm">{footer}</div>}
      </div>
    </div>
  )
}
