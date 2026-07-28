/**
 * `stockBridge` is the inventory workspace; `procurePal` is the public marketplace storefront.
 * Same platform, same mark — only the wordmark changes, because the bridge/arrow icon means the
 * same thing in both places (goods moving into stock) and two separate marks would read as two
 * unrelated products.
 */
export type LogoBrand = 'stockBridge' | 'procurePal'

export interface LogoProps {
  /** Icon height in px. The wordmark, when shown, scales proportionally. Default 32. */
  size?: number
  /** 'full' renders icon + wordmark (e.g. login screen); 'icon' renders the mark alone (e.g. header/sidebar). */
  variant?: 'full' | 'icon'
  brand?: LogoBrand
  className?: string
}

const brandNames: Record<LogoBrand, string> = {
  stockBridge: 'Stock Bridge',
  procurePal: 'ProcurePal',
}

export function Logo({ size = 32, variant = 'full', brand = 'stockBridge', className = '' }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        xmlns="http://www.w3.org/2000/svg"
        role={variant === 'icon' ? 'img' : undefined}
        aria-label={variant === 'icon' ? brandNames[brand] : undefined}
        aria-hidden={variant === 'full' ? true : undefined}
      >
        {/* pylons */}
        <rect x="4" y="17" width="4" height="12" rx="1" className="fill-primary-800" />
        <rect x="24" y="17" width="4" height="12" rx="1" className="fill-primary-800" />
        {/* deck — the "bridge" goods move across */}
        <rect x="2" y="13" width="28" height="5" rx="2.5" className="fill-primary-600" />
        {/* arrow — goods moving up into stock */}
        <path d="M16 4 L22 12 L18 12 L18 15 L14 15 L14 12 L10 12 Z" className="fill-accent-600" />
      </svg>
      {variant === 'full' && (
        <span className="font-sans font-semibold leading-none" style={{ fontSize: size * 0.5 }}>
          {brand === 'procurePal' ? (
            <>
              <span className="text-neutral-900">Procure</span>
              <span className="text-primary-600">Pal</span>
            </>
          ) : (
            <>
              <span className="text-neutral-900">Stock</span> <span className="text-primary-600">Bridge</span>
            </>
          )}
        </span>
      )}
    </span>
  )
}
