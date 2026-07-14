import { useEffect, useRef, useState } from 'react'
import { ImageUp, X } from 'lucide-react'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_SIZE_BYTES = 5 * 1024 * 1024

export interface ImageUploadFieldProps {
  file: File | null
  existingImageUrl?: string | null
  removed: boolean
  onFileSelect: (file: File | null) => void
  onRemove: () => void
}

export function ImageUploadField({ file, existingImageUrl, removed, onFileSelect, onRemove }: ImageUploadFieldProps) {
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const displayedUrl = previewUrl ?? (removed ? null : existingImageUrl)

  function validateAndSelect(candidate: File | undefined | null) {
    if (!candidate) return
    if (!ALLOWED_TYPES.has(candidate.type)) {
      setError('Unsupported file type — only JPG, PNG, and WEBP are allowed.')
      return
    }
    if (candidate.size > MAX_SIZE_BYTES) {
      setError('File exceeds the maximum size of 5MB.')
      return
    }
    setError(null)
    onFileSelect(candidate)
  }

  function handleRemove() {
    setError(null)
    onFileSelect(null)
    onRemove()
    if (inputRef.current) inputRef.current.value = ''
  }

  if (displayedUrl) {
    return (
      <div className="flex flex-col gap-2">
        <div className="relative h-40 w-40 overflow-hidden rounded-lg border border-neutral-200">
          <img src={displayedUrl} alt="Product preview" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={handleRemove}
            aria-label="Remove image"
            className="absolute top-1.5 right-1.5 rounded-full bg-neutral-900/60 p-1 text-white hover:bg-neutral-900/80"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="self-start text-sm font-medium text-primary-600 hover:underline"
        >
          Replace image
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => validateAndSelect(e.target.files?.[0])}
        />
        {error && <p className="text-xs text-danger-600">{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          validateAndSelect(e.dataTransfer.files[0])
        }}
        className={`flex h-40 w-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-center text-xs text-neutral-500 transition-colors ${
          dragOver ? 'border-primary-400 bg-primary-50' : 'border-neutral-300 bg-neutral-50 hover:bg-neutral-100'
        }`}
      >
        <ImageUp className="h-6 w-6 text-neutral-400" />
        <span className="px-3">Drag & drop or tap to select an image</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => validateAndSelect(e.target.files?.[0])}
        />
      </label>
      {error && <p className="text-xs text-danger-600">{error}</p>}
    </div>
  )
}
