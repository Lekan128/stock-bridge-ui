import { useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import {
  applyPreview,
  DEFAULT_PREVIEW,
  FONTS,
  getPreview,
  isDefaultPreview,
  PALETTES,
  subscribePreview,
} from '@/features/designPreview/designPreviewConfig'

/**
 * "Previewing IBM Plex Sans · 2 · + Palm-oil action" (B1), pinned to the corner of every
 * workspace screen while a preview is on, so nobody mistakes the preview for a shipped change.
 */
export function DesignPreviewChip() {
  const preview = useSyncExternalStore(subscribePreview, getPreview, getPreview)
  if (isDefaultPreview(preview)) return null
  const font = FONTS.find((f) => f.id === preview.font)?.label
  const palette = PALETTES.find((p) => p.id === preview.palette)?.label
  return (
    <div className="fixed bottom-4 left-4 z-40 flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-700 shadow-md">
      <span>
        Previewing <span className="font-semibold">{font}</span>
        {preview.condensed && ' (narrow tables)'} · <span className="font-semibold">{palette}</span>
      </span>
      <Link to="/app/design-spike" className="font-medium text-primary-700 underline underline-offset-2">
        Change
      </Link>
      <button type="button" onClick={() => applyPreview(DEFAULT_PREVIEW)} className="font-medium underline underline-offset-2">
        Reset
      </button>
    </div>
  )
}
