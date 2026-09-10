import { MODE_OPTIONS, copy } from '@/features/imports/copy'
import type { ImportMode } from '@/features/imports/types'

export interface ImportModeChoiceProps {
  value: ImportMode
  onChange: (mode: ImportMode) => void
  disabled?: boolean
}

/**
 * The duplicate-SKU decision, asked before upload.
 *
 * It has to be here rather than on the review screen because it changes what counts as an error
 * during validation — "this product already exists" is a blocker under one answer and the whole
 * point under another. Asking afterwards would mean re-validating the file to change your mind.
 *
 * The enum spellings never appear. `CREATE_ONLY` is a database value; "Skip it" is an answer to
 * a question a person actually asked themselves.
 */
export function ImportModeChoice({ value, onChange, disabled = false }: ImportModeChoiceProps) {
  return (
    <fieldset disabled={disabled}>
      <legend className="text-sm font-medium text-neutral-800">{copy.upload.modeQuestion}</legend>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {MODE_OPTIONS.map((option) => {
          const active = option.value === value
          return (
            <label
              key={option.value}
              className={`flex cursor-pointer flex-col gap-1 rounded-md border p-3 transition-colors focus-within:ring-2 focus-within:ring-primary-500 ${
                active ? 'border-primary-600 bg-primary-50' : 'border-neutral-200 bg-white hover:bg-neutral-50'
              } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="import-mode"
                  value={option.value}
                  checked={active}
                  onChange={() => onChange(option.value)}
                  className="h-4 w-4 accent-primary-600 focus:outline-none"
                />
                <span className="text-sm font-medium text-neutral-900">{option.label}</span>
              </span>
              <span className="pl-6 text-xs text-neutral-500">{option.hint}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
