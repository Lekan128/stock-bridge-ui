import type { AppRowError } from '@/types/api'

export function RowErrorsTable({ errors }: { errors: AppRowError[] }) {
  return (
    <div className="max-h-64 overflow-y-auto rounded-md border border-danger-200">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-danger-50">
          <tr>
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-danger-700">
              Row
            </th>
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-danger-700">
              Column
            </th>
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-danger-700">
              Error
            </th>
          </tr>
        </thead>
        <tbody>
          {errors.map((error, i) => (
            <tr key={i} className="border-t border-danger-100">
              <td className="px-3 py-2 text-neutral-700">{error.row === 0 ? 'File' : error.row}</td>
              <td className="px-3 py-2 text-neutral-700">{error.column || '—'}</td>
              <td className="px-3 py-2 text-neutral-700">{error.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
