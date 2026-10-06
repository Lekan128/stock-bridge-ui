import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  deleteDraft,
  draftsReady,
  getDraftCount,
  loadDraft,
  saveDraft,
  subscribeDrafts,
  type StoredDraft,
} from '@/features/drafts/draftStore'

/** Typing is saved this long after it pauses — short, because a page torn down mid-wait loses it. */
const SAVE_DELAY_MS = 400

export interface DraftHandle<T> {
  /** The draft found when the form opened, or null; undefined until the phone has been checked. */
  initial: StoredDraft<T> | null | undefined
  /** When the draft was last saved, for "saved on this phone at 10:42". */
  savedAt: number | null
  save: (value: T) => void
  /** "Discard draft": the saved copy goes; anything typed afterwards is saved again. */
  clear: () => Promise<void>
  /** The form was really submitted: the saved copy goes, and nothing more is saved. */
  finish: () => Promise<void>
}

/**
 * Keeps one form's typing on the phone (A5). Reads the saved draft once when the form opens and
 * saves every change shortly after it happens. The form decides what to do with `initial` — apply
 * it, or offer it — and calls `clear` once the thing has really been submitted.
 */
export function useDraft<T>(key: string, enabled = true): DraftHandle<T> {
  const [initial, setInitial] = useState<StoredDraft<T> | null | undefined>(undefined)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef<T | null>(null)
  const finished = useRef(false)
  // Wait for the user's drafts to be open, then look once.
  const ready = useSyncExternalStore(subscribeDrafts, draftsReady, draftsReady)

  useEffect(() => {
    if (!enabled || !ready || initial !== undefined) return
    let cancelled = false
    void loadDraft<T>(key).then((draft) => {
      if (cancelled) return
      setInitial(draft)
      if (draft) setSavedAt(draft.savedAt)
    })
    return () => {
      cancelled = true
    }
  }, [enabled, ready, key, initial])

  const flush = useCallback(() => {
    if (timer.current != null) {
      clearTimeout(timer.current)
      timer.current = null
    }
    if (latest.current != null) {
      const value = latest.current
      latest.current = null
      void saveDraft(key, value).then(setSavedAt)
    }
  }, [key])

  const save = useCallback(
    (value: T) => {
      if (!enabled || finished.current) return
      latest.current = value
      if (timer.current != null) clearTimeout(timer.current)
      timer.current = setTimeout(flush, SAVE_DELAY_MS)
    },
    [enabled, flush],
  )

  // Save straight away when the page is hidden (a phone switching apps) or the form closes.
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      document.removeEventListener('visibilitychange', onHidden)
      flush()
    }
  }, [flush])

  const clear = useCallback(async () => {
    if (timer.current != null) clearTimeout(timer.current)
    timer.current = null
    latest.current = null
    setSavedAt(null)
    await deleteDraft(key)
  }, [key])

  const finish = useCallback(async () => {
    finished.current = true
    await clear()
  }, [clear])

  return { initial, savedAt, save, clear, finish }
}

export function useDraftCount(): number {
  return useSyncExternalStore(subscribeDrafts, getDraftCount, getDraftCount)
}
