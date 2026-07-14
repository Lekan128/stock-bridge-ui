import { PackageSearch } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, buttonClassName } from '@/components/Button'

export function EmptyProductsState({ onBulkUpload }: { onBulkUpload: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
        <PackageSearch className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-base font-semibold text-neutral-900">No products yet</h2>
      <p className="mt-1 max-w-sm text-sm text-neutral-500">
        Add your first product to start tracking inventory, or bulk upload a spreadsheet of products.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Link to="/products/new" className={buttonClassName('primary')}>
          Add your first product
        </Link>
        <Button variant="secondary" onClick={onBulkUpload}>
          Bulk upload
        </Button>
      </div>
    </div>
  )
}
