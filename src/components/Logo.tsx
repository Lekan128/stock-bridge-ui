export interface LogoProps {
  /** Icon height in px. The wordmark, when shown, scales proportionally. Default 32. */
  size?: number
  /** 'full' renders icon + wordmark (e.g. login screen); 'icon' renders the mark alone (e.g. header/sidebar). */
  variant?: 'full' | 'icon'
  className?: string
}

export function Logo({ size = 32, variant = 'full', className = '' }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        xmlns="http://www.w3.org/2000/svg"
        role={variant === 'icon' ? 'img' : undefined}
        aria-label={variant === 'icon' ? 'Stock Bridge' : undefined}
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
          <span className="text-neutral-900">Stock</span> <span className="text-primary-600">Bridge</span>
        </span>
      )}
    </span>
  )
}
