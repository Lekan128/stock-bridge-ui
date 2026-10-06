import { LOCKUP_VIEWBOX, MARK_PATH, MARK_VIEWBOX, WORDMARK_PATH } from '@/components/brand/logoPaths'

/**
 * `stockBridge` is the inventory workspace — the Procurepaddy logo (the key kept its original
 * name so call sites did not churn during the 2026-08 rebrand); `procurePal` is the public
 * marketplace storefront.
 * Same platform, same mark: the Procurepaddy box sits beside both names, because two separate
 * marks would read as two unrelated products. Only Procurepaddy has a drawn wordmark; ProcurePal's
 * name is set in type.
 */
export type LogoBrand = 'stockBridge' | 'procurePal'

export interface LogoProps {
  /** Height in px, of the mark and of the whole lockup. Default 32. */
  size?: number
  /** 'full' renders the mark with its name (e.g. login screen); 'icon' renders the mark alone. */
  variant?: 'full' | 'icon'
  brand?: LogoBrand
  /** 'brand' is navy, for light surfaces; 'inverse' is white, for navy ones (the admin header). */
  tone?: 'brand' | 'inverse'
  className?: string
}

const NAMES: Record<LogoBrand, string> = {
  stockBridge: 'Procurepaddy',
  procurePal: 'ProcurePal',
}

export function Logo({ size = 32, variant = 'full', brand = 'stockBridge', tone = 'brand', className = '' }: LogoProps) {
  const fill = tone === 'inverse' ? 'fill-white' : 'fill-primary-900'
  const name = NAMES[brand]

  if (variant === 'full' && brand === 'stockBridge') {
    const [, , width, height] = LOCKUP_VIEWBOX.split(' ').map(Number)
    return (
      <svg
        viewBox={LOCKUP_VIEWBOX}
        height={size}
        width={(size * width) / height}
        role="img"
        aria-label={name}
        className={`shrink-0 ${fill} ${className}`}
      >
        <path d={MARK_PATH} />
        <path d={WORDMARK_PATH} fillRule="evenodd" />
      </svg>
    )
  }

  const mark = (
    <svg
      viewBox={MARK_VIEWBOX}
      height={size}
      width={(size * 186) / 194}
      role={variant === 'icon' ? 'img' : undefined}
      aria-label={variant === 'icon' ? name : undefined}
      aria-hidden={variant === 'full' ? true : undefined}
      className={`shrink-0 ${fill}`}
    >
      <path d={MARK_PATH} />
    </svg>
  )
  if (variant === 'icon') return <span className={`inline-flex ${className}`}>{mark}</span>

  // ProcurePal: the mark, then the name in type.
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {mark}
      <span className="font-sans font-semibold leading-none" style={{ fontSize: size * 0.56 }}>
        <span className={tone === 'inverse' ? 'text-white' : 'text-neutral-900'}>Procure</span>
        <span className={tone === 'inverse' ? 'text-primary-200' : 'text-primary-600'}>Pal</span>
      </span>
    </span>
  )
}
