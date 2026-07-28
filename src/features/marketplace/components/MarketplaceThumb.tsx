import { useState } from 'react'
import { ImageOff } from 'lucide-react'

export interface MarketplaceThumbProps {
  src?: string | null
  alt: string
  className?: string
}

/**
 * Product thumbnail with a graceful fallback. Local to this feature rather than imported from
 * `features/products` so ProcurePal's admin screens do not depend on another module's internals —
 * an order line's `imageUrl` is a checkout-time snapshot and may point at an image that has since
 * been replaced, so a broken `src` is a normal case here, not an exception.
 */
export function MarketplaceThumb({ src, alt, className = '' }: MarketplaceThumbProps) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 text-neutral-300 ${className}`}
        aria-hidden="true"
      >
        <ImageOff className="h-1/2 w-1/2" />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`rounded-md border border-neutral-200 bg-white object-cover ${className}`}
    />
  )
}
