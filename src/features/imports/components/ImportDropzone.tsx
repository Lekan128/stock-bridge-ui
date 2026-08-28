import { useRef, useState, type DragEvent } from 'react'
import { FileSpreadsheet, Upload, X } from 'lucide-react'
import { ACCEPTED_EXTENSIONS, MAX_FILE_BYTES } from '@/features/imports/constants'
import { copy, formatMegabytes } from '@/features/imports/copy'

export interface ImportDropzoneProps {
  file: File | null
  disabled?: boolean
  /** 0–100 while the upload is in flight, `null` when it is not. */
  uploadPercent?: number | null
  onSelect: (file: File) => void
  /** Called with a finished sentence — the caller only has to render it. */
  onReject: (message: string) => void
  onClear: () => void
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot < 0 ? '' : name.slice(dot).toLowerCase()
}

/**
 * The upload target.
 *
 * Two things here are deliberate and easy to get wrong:
 *
 * 1. **It is a real button, not a div with an onClick.** A dropzone that only responds to a
 *    mouse is unusable by keyboard and invisible to a screen reader, and this is the first
 *    control in the flow — failing here means failing before the feature starts.
 * 2. **The limits are stated before a file is picked**, and the size check runs in the browser.
 *    Telling someone their 14 MB file is too big after a two-minute upload is the difference
 *    between a rule and an ambush. The row cap can only be checked server-side, so that message
 *    quotes the real number back (contract §6).
 */
export function ImportDropzone({
  file,
  disabled = false,
  uploadPercent = null,
  onSelect,
  onReject,
  onClear,
}: ImportDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function accept(candidate: File | undefined) {
    if (!candidate) return
    if (!ACCEPTED_EXTENSIONS.includes(extensionOf(candidate.name) as (typeof ACCEPTED_EXTENSIONS)[number])) {
      onReject(copy.upload.wrongType(candidate.name))
      return
    }
    if (candidate.size > MAX_FILE_BYTES) {
      onReject(copy.upload.tooLarge(candidate.size))
      return
    }
    if (candidate.size === 0) {
      onReject(copy.upload.empty)
      return
    }
    onSelect(candidate)
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    setDragging(false)
    if (disabled) return
    accept(event.dataTransfer.files[0])
  }

  if (file) {
    const uploading = uploadPercent !== null
    return (
      <div className="rounded-lg border border-neutral-200 bg-white px-4 py-4">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-8 w-8 shrink-0 text-primary-600" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-neutral-900">{file.name}</p>
            <p className="text-xs text-neutral-500">
              {formatMegabytes(file.size)}
              {uploading && ` · ${copy.upload.sending(uploadPercent)}`}
            </p>
          </div>
          {!uploading && (
            <button
              type="button"
              onClick={() => {
                if (inputRef.current) inputRef.current.value = ''
                onClear()
              }}
              disabled={disabled}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50 sm:min-h-0"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              {copy.upload.clear}
            </button>
          )}
        </div>

        {/* Attached to the file it is describing rather than floating under the dropzone, and
          `rounded-sm` rather than `rounded-full` — DESIGN.md reserves the pill for avatars and
          status dots, and a lozenge progress bar is the one shape that makes this app look like
          a different product. The percentage is written out as well as drawn, because a bar
          alone tells someone on a slow connection nothing they can act on. */}
        <div
          role="progressbar"
          aria-label={copy.upload.checking}
          aria-valuenow={uploading ? uploadPercent : undefined}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={uploading ? copy.upload.sending(uploadPercent) : undefined}
          aria-hidden={uploading ? undefined : true}
          className={`mt-3 h-1.5 w-full overflow-hidden rounded-sm bg-neutral-200 transition-opacity ${
            uploading ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <div
            className="h-full rounded-sm bg-primary-600 transition-all duration-200"
            style={{ width: `${uploading ? uploadPercent : 0}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS.join(',')}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => accept(event.target.files?.[0])}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        aria-describedby="dropzone-limits"
        className={`flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
          dragging
            ? 'border-primary-600 bg-primary-50'
            : 'border-neutral-300 bg-white hover:border-primary-400 hover:bg-neutral-50'
        }`}
      >
        <Upload className={`h-6 w-6 ${dragging ? 'text-primary-600' : 'text-neutral-400'}`} aria-hidden="true" />
        <span className="text-sm font-medium text-neutral-900">
          {dragging ? copy.upload.dropzoneActive : copy.upload.dropzoneHeading}
        </span>
        <span id="dropzone-limits" className="text-xs text-neutral-500">
          {copy.upload.dropzoneLimits}
        </span>
      </button>
    </>
  )
}
