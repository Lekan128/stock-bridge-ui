import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { Button } from '@/components/Button'
import { Sheet } from '@/components/Sheet'
import { useToast } from '@/components/useToast'
import { useApiQuery } from '@/data/useApiQuery'
import { isAppError } from '@/types/api'
import { BRANCHES_KEY } from '@/features/branches/BranchProvider'
import type { Branch, BranchTable } from '@/features/branches/types'
import { tablesApi } from '@/features/selling/bills/billsApi'

/** "1 to 10 (4 is Window), VIP" - a branch's tables in one line. */
function tablesSummary(tables: BranchTable[]): string {
  const on = tables.filter((table) => table.active)
  if (on.length === 0) return 'None yet. Add them to take orders for tables.'
  const parts: string[] = []
  let run: number[] = []
  const flush = () => {
    if (run.length === 0) return
    parts.push(run.length > 2 ? `${run[0]} to ${run[run.length - 1]}` : run.join(', '))
    run = []
  }
  for (const table of on) {
    const n = /^\d+$/.test(table.name) ? Number(table.name) : null
    if (n != null && (run.length === 0 || n === run[run.length - 1] + 1)) run.push(n)
    else {
      flush()
      if (n != null) run.push(n)
      else parts.push(table.name)
    }
  }
  flush()
  return parts.join(', ')
}

/**
 * Branch → Selling (V99, selling till Step 7): its tables. Charges and taxes join it in Step 10. Changed in the app's
 * usual sheet: "Add 10" makes the next ten numbers, any table can be renamed or switched off, never deleted.
 */
export function BranchSellingPanel({ branch }: { branch: Branch }) {
  const [editing, setEditing] = useState(false)
  const tables = useApiQuery<BranchTable[]>({
    queryKey: ['branch-tables', branch.id],
    queryFn: () => tablesApi.list(branch.id),
    fallbackError: "Couldn't load the tables.",
  })
  const list = tables.data ?? []
  const on = list.filter((table) => table.active).length
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3">
        <span className="min-w-0">
          <span className="block font-semibold text-neutral-900">Tables{on ? ` · ${on}` : ''}</span>
          <span className="block text-sm text-neutral-500">{tables.data ? tablesSummary(list) : ' '}</span>
        </span>
        <Button variant="secondary" onClick={() => setEditing(true)}>
          {on ? 'Change' : 'Add tables'}
        </Button>
      </div>
      <p className="text-sm text-neutral-500">
        With tables, Record a sale opens on Tables: a bill is kept open for a table and paid later. A shop without tables
        never sees them.
      </p>
      <TablesSheet branch={branch} open={editing} tables={list} onClose={() => setEditing(false)} />
    </div>
  )
}

function TablesSheet({ branch, open, tables, onClose }: { branch: Branch; open: boolean; tables: BranchTable[]; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  // "10" to start a branch's tables; empty once it has some, so a stray tap never adds ten more.
  const [count, setCount] = useState(() => (tables.length === 0 ? '10' : ''))
  const [naming, setNaming] = useState('')
  const [names, setNames] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  async function run(change: () => Promise<BranchTable[]>, done?: string) {
    setBusy(true)
    try {
      const next = await change()
      queryClient.setQueryData(['branch-tables', branch.id], next)
      void queryClient.invalidateQueries({ queryKey: BRANCHES_KEY })
      if (done) showToast(done, 'success')
      return true
    } catch (error) {
      showToast(isAppError(error) ? error.message : "Couldn't change that. Try again.", 'error')
      return false
    } finally {
      setBusy(false)
    }
  }

  function move(index: number, by: number) {
    const ids = tables.map((table) => table.id)
    const [moved] = ids.splice(index, 1)
    ids.splice(index + by, 0, moved)
    void run(() => tablesApi.order(branch.id, ids))
  }

  const howMany = Number(count)
  return (
    <Sheet open={open} onClose={onClose} title="Tables" subtitle={branch.name}>
      <div className="flex flex-col gap-4">
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (howMany >= 1) void run(() => tablesApi.add(branch.id, { count: howMany }), `${howMany} ${howMany === 1 ? 'table' : 'tables'} added.`)
          }}
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="add-tables" className="text-sm font-medium text-neutral-800">
              Add
            </label>
            <input
              id="add-tables"
              inputMode="numeric"
              value={count}
              onChange={(event) => setCount(event.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
              className="h-11 w-20 rounded-md border border-neutral-300 px-3 text-base tabular-nums"
            />
          </div>
          <Button type="submit" variant="secondary" loading={busy} disabled={!(howMany >= 1)} className="min-h-11">
            Add {howMany >= 1 ? howMany : ''} {howMany === 1 ? 'table' : 'tables'}
          </Button>
        </form>
        <p className="-mt-2 text-xs text-neutral-500">Numbered on from the last one. Rename any of them below.</p>

        {tables.length > 0 && (
          <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200" aria-label="Tables">
            {tables.map((table, index) => {
              const typed = names[table.id] ?? table.name
              return (
                <li key={table.id} className="flex items-center gap-2 px-2 py-1.5">
                  <label htmlFor={`table-${table.id}`} className="sr-only">
                    Name of table {table.name}
                  </label>
                  <input
                    id={`table-${table.id}`}
                    value={typed}
                    maxLength={40}
                    onChange={(event) => setNames((all) => ({ ...all, [table.id]: event.target.value }))}
                    onBlur={() => {
                      if (typed.trim() && typed.trim() !== table.name) {
                        void run(() => tablesApi.update(table.id, { name: typed.trim() })).then((ok) => {
                          if (!ok) setNames((all) => ({ ...all, [table.id]: table.name }))
                        })
                      }
                    }}
                    className={`h-10 min-w-0 flex-1 rounded-md border border-neutral-200 px-2 text-sm ${table.active ? 'text-neutral-900' : 'text-neutral-400 line-through'}`}
                  />
                  <button
                    type="button"
                    aria-label={`Move ${table.name} up`}
                    disabled={index === 0 || busy}
                    onClick={() => move(index, -1)}
                    className="flex h-9 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 disabled:opacity-30"
                  >
                    <ArrowUp className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${table.name} down`}
                    disabled={index === tables.length - 1 || busy}
                    onClick={() => move(index, 1)}
                    className="flex h-9 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 disabled:opacity-30"
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={table.active}
                    aria-label={`${table.name} in use`}
                    disabled={busy}
                    onClick={() => void run(() => tablesApi.update(table.id, { active: !table.active }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${table.active ? 'bg-accent-600' : 'bg-neutral-300'}`}
                  >
                    <span aria-hidden="true" className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${table.active ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            const name = naming.trim()
            if (name) void run(() => tablesApi.add(branch.id, { name }), `${name} added.`).then((ok) => ok && setNaming(''))
          }}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label htmlFor="add-named-table" className="text-sm font-medium text-neutral-800">
              Add one with a name
            </label>
            <input
              id="add-named-table"
              value={naming}
              maxLength={40}
              placeholder="VIP, Garden 1"
              onChange={(event) => setNaming(event.target.value)}
              className="h-11 rounded-md border border-neutral-300 px-3 text-base"
            />
          </div>
          <Button type="submit" variant="secondary" loading={busy} disabled={!naming.trim()} className="min-h-11">
            Add
          </Button>
        </form>
        <p className="text-xs text-neutral-500">A table is switched off, never deleted, so old bills keep their table.</p>
      </div>
    </Sheet>
  )
}
