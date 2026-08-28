import { useCallback, useState } from 'react'
import { useToast } from '@/components/useToast'
import { importsApi } from '@/features/imports/api/importsApi'
import { copy } from '@/features/imports/copy'
import type {
  ImportCellValue,
  ImportRow,
  ImportSession,
  ValueMappingRequest,
} from '@/features/imports/types'
import { isAppError } from '@/types/api'

export interface RowMutationCallbacks {
  /** Put a row into the grid — used for both the optimistic guess and the server's answer. */
  applyRow: (row: ImportRow) => void
  /** A whole refreshed record, returned by the value-resolution endpoints. */
  applySession: (session: ImportSession) => void
}

/**
 * Every write the review screen makes, with the optimism policy in one place.
 *
 * A cell edit paints immediately and rolls back on failure, because the round trip is short and
 * the user is mid-thought. A bulk fix does not: it can move dozens of rows at once and a wrong
 * guess would be far more disorienting than a 300ms wait, so it shows the affected controls busy
 * and waits for the real answer.
 *
 * Rollback is always to the exact row object we started from, never to a recomputed one — the
 * server owns validation, so guessing at what the errors should revert to would be a second bug.
 */
export function useRowMutations(importId: string | undefined, callbacks: RowMutationCallbacks) {
  const { showToast } = useToast()
  const { applyRow, applySession } = callbacks
  const [busyRowIds, setBusyRowIds] = useState<string[]>([])
  const [busyValues, setBusyValues] = useState<string[]>([])

  const markBusy = useCallback((rowId: string, busy: boolean) => {
    setBusyRowIds((current) => (busy ? [...current, rowId] : current.filter((id) => id !== rowId)))
  }, [])

  const editCell = useCallback(
    async (row: ImportRow, column: string, value: ImportCellValue) => {
      if (!importId) return
      if (row.normalized[column] === value) return

      const optimistic: ImportRow = { ...row, normalized: { ...row.normalized, [column]: value } }
      applyRow(optimistic)
      markBusy(row.id, true)
      try {
        const saved = await importsApi.patchRow(importId, row.id, { [column]: value })
        applyRow(saved)
      } catch (err: unknown) {
        applyRow(row)
        showToast(isAppError(err) ? err.message : copy.review.editFailed, 'error')
      } finally {
        markBusy(row.id, false)
      }
    },
    [importId, applyRow, markBusy, showToast],
  )

  const toggleSkip = useCallback(
    async (row: ImportRow, skipped: boolean) => {
      if (!importId) return
      applyRow({ ...row, status: skipped ? 'SKIPPED' : row.errors.length > 0 ? 'ERROR' : 'VALID' })
      markBusy(row.id, true)
      try {
        const saved = await importsApi.skipRow(importId, row.id, skipped)
        applyRow(saved)
      } catch (err: unknown) {
        applyRow(row)
        showToast(isAppError(err) ? err.message : copy.review.editFailed, 'error')
      } finally {
        markBusy(row.id, false)
      }
    },
    [importId, applyRow, markBusy, showToast],
  )

  /**
   * One decision, every matching row. Used by both `[Fix all 12 "KGS" rows]` and the
   * value-resolution cards — they are the same endpoint and the same idea, so they are the same
   * code path. `affectedRows` is only ever used for the confirmation toast's count.
   */
  const resolveValue = useCallback(
    async (body: ValueMappingRequest, affectedRows: number): Promise<boolean> => {
      if (!importId) return false
      const busyKey = `${body.column}:${body.from}`
      setBusyValues((current) => [...current, busyKey])
      try {
        const saved = await importsApi.resolveValue(importId, body)
        applySession(saved)
        showToast(copy.resolve.appliedToast(affectedRows), 'success')
        return true
      } catch (err: unknown) {
        showToast(isAppError(err) ? err.message : copy.resolve.applyFailed, 'error')
        return false
      } finally {
        setBusyValues((current) => current.filter((key) => key !== busyKey))
      }
    },
    [importId, applySession, showToast],
  )

  return {
    editCell,
    toggleSkip,
    resolveValue,
    isRowBusy: (rowId: string) => busyRowIds.includes(rowId),
    isValueBusy: (column: string, from: string) => busyValues.includes(`${column}:${from}`),
  }
}
