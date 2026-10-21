import { useEffect, useMemo, useState } from 'react'
import { useCatalogList, useCatalogState } from '@/features/catalog/useCatalog'
import { useProducts } from '@/features/products/hooks/useProducts'
import type { Product } from '@/features/products/types'

/**
 * Finding a product by name, code or barcode as someone types or scans - the on-device catalogue
 * when it is ready (works offline, a scanner needs no connection), the server otherwise. Shared by
 * quick mode and Record a sale, so a scan behaves the same in both.
 *
 * `onEnter` is what Enter does: a scanner types the code and presses Enter in the same instant -
 * before the search has answered - so an early Enter waits (up to 3 s) for the answer to the term
 * it was pressed on, then picks the exact code, or the only match.
 */
export function useProductFinder(term: string, onPick: (product: Product) => void, limit = 8) {
  const catalog = useCatalogState()
  const onDevice = catalog.phase === 'ready'
  const search = term.trim()
  const list = useCatalogList(
    { search, status: 'active', categoryId: '', stockStatus: 'all', sort: { field: 'name', direction: 'asc' } },
    onDevice && search !== '',
  )
  const server = useProducts(
    { search: search || undefined, active: true, size: limit, page: 0, sort: 'name,asc' },
    { enabled: !onDevice && search !== '' },
  )
  const { loadRange } = list
  useEffect(() => {
    if (onDevice && search) loadRange(0, limit - 1)
  }, [onDevice, search, loadRange, limit])

  const results: Product[] = useMemo(() => {
    if (!search) return []
    if (onDevice) {
      const rows: Product[] = []
      for (let i = 0; i < Math.min(limit, list.total); i++) {
        const row = list.rowAt(i)
        if (row) rows.push(row)
      }
      return rows
    }
    return server.data?.content ?? []
  }, [search, onDevice, list, server.data, limit])

  const [enterOn, setEnterOn] = useState<string | null>(null)
  const answered = onDevice ? list.ready : !server.loading
  function pickFromEnter(): boolean {
    const exact = results.find((p) => p.sku.toLowerCase() === search.toLowerCase())
    if (exact) {
      onPick(exact)
      return true
    }
    if (results.length === 1) {
      onPick(results[0])
      return true
    }
    return false
  }
  useEffect(() => {
    if (enterOn == null || enterOn !== search) return
    // Picked, or more than one match (the person taps the right one): either way, done waiting.
    if (pickFromEnter() || (answered && results.length > 1)) setEnterOn(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enterOn, search, results, answered])
  useEffect(() => {
    if (enterOn == null) return
    const timer = window.setTimeout(() => setEnterOn(null), 3000)
    return () => window.clearTimeout(timer)
  }, [enterOn])

  return {
    search,
    results,
    /** The search has answered for the current term. */
    answered: search === '' || answered,
    onEnter: () => {
      if (!pickFromEnter()) setEnterOn(search)
    },
  }
}
