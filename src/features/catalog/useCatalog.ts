import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { getCatalogState, queryCatalog, subscribeCatalog, toProduct, type CatalogState } from '@/features/catalog/catalogStore'
import type { CatalogQuery, CatalogQueryResult } from '@/features/catalog/types'
import type { Product } from '@/features/products/types'

export function useCatalogState(): CatalogState {
  return useSyncExternalStore(subscribeCatalog, getCatalogState, getCatalogState)
}

/** Rows fetched from the worker per request: about two screens of a phone. */
const WINDOW = 100

export type CatalogFilters = Omit<CatalogQuery, 'offset' | 'limit'>

export interface CatalogList {
  /** Matching rows; only those near the screen are loaded — see `rowAt` / `loadRange`. */
  total: number
  counts: CatalogQueryResult['counts']
  incoming: CatalogQueryResult['incoming']
  catalogSize: number
  activeCount: number
  /** The first answer for these filters has arrived. */
  ready: boolean
  /** The row at a position in the filtered, sorted list, or undefined until it is loaded. */
  rowAt: (index: number) => Product | undefined
  /** Makes sure rows `start`..`end` are loaded (the virtual list calls this as it scrolls). */
  loadRange: (start: number, end: number) => void
}

const NO_COUNTS = { all: 0, OK: 0, LOW: 0, OUT: 0 }
const NO_INCOMING = { units: 0, productCount: 0 }

/**
 * The Inventory list, answered by the on-device catalogue a window at a time. Re-asks whenever
 * the filters change or the copy itself changes (a sync, or a write from this phone), keeping
 * whichever windows the user has scrolled through.
 */
export function useCatalogList(filters: CatalogFilters, enabled: boolean): CatalogList {
  const { version } = useCatalogState()
  const key = JSON.stringify(filters)
  const [summary, setSummary] = useState<Omit<CatalogQueryResult, 'rows'> | null>(null)
  const [windows, setWindows] = useState<Map<number, Product[]>>(new Map())
  const requested = useRef<Set<number>>(new Set())
  const generation = useRef(0)
  const lastKey = useRef<string | null>(null)

  const fetchWindow = useCallback(
    (windowIndex: number, gen: number) => {
      requested.current.add(windowIndex)
      void queryCatalog({ ...filters, offset: windowIndex * WINDOW, limit: WINDOW })
        .then(({ rows, ...rest }) => {
          if (gen !== generation.current) return
          setSummary(rest)
          setWindows((current) => new Map(current).set(windowIndex, rows.map(toProduct)))
        })
        .catch(() => {
          requested.current.delete(windowIndex)
        })
    },
    // `key` stands in for `filters` (a fresh object each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  )

  // New filters: positions now mean different products, so start from the top. The copy changed
  // (a sync landed, or this phone wrote something): re-ask for the windows already loaded and swap
  // each in as it arrives, so the rows on screen never blank out in between.
  useEffect(() => {
    if (!enabled) return
    const gen = ++generation.current
    const filtersChanged = lastKey.current !== key
    lastKey.current = key
    const reload = filtersChanged || requested.current.size === 0 ? [0] : [...requested.current]
    requested.current = new Set()
    if (filtersChanged) setWindows(new Map())
    for (const windowIndex of reload) fetchWindow(windowIndex, gen)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version, enabled])

  const loadRange = useCallback(
    (start: number, end: number) => {
      if (!enabled) return
      for (let w = Math.floor(start / WINDOW); w <= Math.floor(end / WINDOW); w += 1) {
        if (!requested.current.has(w)) fetchWindow(w, generation.current)
      }
    },
    [enabled, fetchWindow],
  )

  const rowAt = useCallback(
    (index: number) => windows.get(Math.floor(index / WINDOW))?.[index % WINDOW],
    [windows],
  )

  return {
    total: summary?.total ?? 0,
    counts: summary?.counts ?? NO_COUNTS,
    incoming: summary?.incoming ?? NO_INCOMING,
    catalogSize: summary?.catalogSize ?? 0,
    activeCount: summary?.activeCount ?? 0,
    ready: summary != null,
    rowAt,
    loadRange,
  }
}
