import { useState } from 'react'
import { Package } from 'lucide-react'

export interface ProductImageProps {
  src?: string | null
  alt: string
  className?: string
  iconClassName?: string
}

export function ProductImage({ src, alt, className = '', iconClassName = 'h-6 w-6' }: ProductImageProps) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-neutral-100 text-neutral-400 ${className}`}>
        <Package className={iconClassName} aria-hidden="true" />
        <span className="sr-only">No image</span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className={`bg-neutral-100 object-cover ${className}`}
    />
  )
}
