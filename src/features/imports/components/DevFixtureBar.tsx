import { FlaskConical } from 'lucide-react'
import type { MockFixture } from '@/features/imports/api/mockAdapter'

export interface DevFixtureBarProps {
  onPick: (file: File) => void
}

/**
 * Development-only shortcut for exercising every fixture the mock adapter carries without
 * needing five real spreadsheets on disk.
 *
 * Gated on `import.meta.env.DEV` by its caller, so it is dropped from the production bundle at
 * build time. It disappears entirely with the mock adapter when M5 wires the real API.
 */
const FIXTURES: { fixture: MockFixture; filename: string; label: string }[] = [
  { fixture: 'CLEAN', filename: 'products-jan.xlsx', label: 'Clean · 38 rows' },
  { fixture: 'MESSY', filename: 'products-messy.xlsx', label: 'Messy · errors, warnings, unknown suppliers' },
  { fixture: 'NEEDS_MAPPING', filename: 'supplier-pricelist.xlsx', label: "Someone else's column names" },
  { fixture: 'TOO_MANY_ROWS', filename: 'products-huge.xlsx', label: 'Over the row cap' },
  { fixture: 'EXPIRED', filename: 'products-expired.xlsx', label: 'Expired' },
]

export function DevFixtureBar({ onPick }: DevFixtureBarProps) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
        <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
        Development fixtures — not shipped
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {FIXTURES.map((entry) => (
          <button
            key={entry.fixture}
            type="button"
            onClick={() =>
              onPick(new File(['fixture'], entry.filename, { type: 'application/vnd.ms-excel' }))
            }
            className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            {entry.label}
          </button>
        ))}
      </div>
    </div>
  )
}
