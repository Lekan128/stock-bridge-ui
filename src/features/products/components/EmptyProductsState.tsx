import { PackageSearch } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, buttonClassName } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'

export interface EmptyProductsStateProps {
  canManageProducts: boolean
  onBulkUpload: () => void
}

/** The Inventory list before anything is in it — the shared v2 empty state (B2), with its actions. */
export function EmptyProductsState({ canManageProducts, onBulkUpload }: EmptyProductsStateProps) {
  return (
    <EmptyState
      icon={PackageSearch}
      title="No products yet"
      description={
        canManageProducts
          ? 'Add your first product to start tracking inventory, or bulk upload a spreadsheet of products.'
          : 'Nothing has been added to the catalog yet. Ask someone who manages products to add the first one.'
      }
      action={
        canManageProducts && (
          <>
            <Link to="/app/products/new" className={buttonClassName('action')}>
              Add your first product
            </Link>
            <Button variant="secondary" onClick={onBulkUpload}>
              Bulk upload
            </Button>
          </>
        )
      }
    />
  )
}
