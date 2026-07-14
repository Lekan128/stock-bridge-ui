import { useRef, useState } from 'react'
import { FileSpreadsheet, Upload } from 'lucide-react'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { Modal } from '@/components/Modal'
import { productsApi } from '@/features/products/api/productsApi'
import { RowErrorsTable } from '@/features/products/components/RowErrorsTable'
import { isAppError } from '@/types/api'
import type { AppRowError } from '@/types/api'
import { downloadBlob } from '@/utils/downloadBlob'

export interface BulkUploadModalProps {
  open: boolean
  onClose: () => void
  onSuccess: (createdCount: number) => void
}

export function BulkUploadModal({ open, onClose, onSuccess }: BulkUploadModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [rowErrors, setRowErrors] = useState<AppRowError[] | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setFile(null)
    setRowErrors(null)
    setFormError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleDownloadTemplate() {
    try {
      const blob = await productsApi.template()
      downloadBlob(blob, 'product-import-template.xlsx')
    } catch {
      setFormError('Could not download the template. Please try again.')
    }
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setRowErrors(null)
    setFormError(null)
    try {
      const response = await productsApi.bulkUpload(file)
      onSuccess(response.createdCount)
      handleClose()
    } catch (err) {
      if (isAppError(err) && err.rowErrors?.length) {
        setRowErrors(err.rowErrors)
      } else if (isAppError(err)) {
        setFormError(err.message)
      } else {
        setFormError('Something went wrong. Please try again.')
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Bulk upload products"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={() => void handleUpload()} loading={uploading} disabled={!file}>
            <Upload className="h-4 w-4" />
            Upload
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-600">
          <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
          <p>
            Use the{' '}
            <button type="button" onClick={() => void handleDownloadTemplate()} className="font-medium text-primary-600 hover:underline">
              downloadable template
            </button>{' '}
            to format your spreadsheet before uploading.
          </p>
        </div>

        <div>
          <label htmlFor="bulk-upload-file" className="mb-1.5 block text-sm font-medium text-neutral-700">
            Spreadsheet (.xlsx)
          </label>
          <input
            ref={inputRef}
            id="bulk-upload-file"
            type="file"
            accept=".xlsx"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
              setRowErrors(null)
              setFormError(null)
            }}
            className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-md file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-700 hover:file:bg-primary-100"
          />
        </div>

        <FormError message={formError} />

        {rowErrors && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-danger-700">
              {rowErrors.length} error{rowErrors.length === 1 ? '' : 's'} found — fix these in your spreadsheet and
              try again.
            </p>
            <RowErrorsTable errors={rowErrors} />
          </div>
        )}
      </div>
    </Modal>
  )
}
