/**
 * One question answered with one tap (STOCK_AREAS_PART_6.md): its answers as chips side by side, wrapping on a
 * phone - shorter than a list of boxes when a sheet asks it once per line. Real radios underneath, so the keyboard
 * and screen readers treat it as one choice.
 */
export function ChoiceChips<T extends string>({
  name,
  label,
  value,
  options,
  onChange,
}: {
  name: string
  /** The question, for screen readers; the sheet says it in words above. */
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const chosen = option.value === value
        return (
          <label
            key={option.value}
            className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-3 text-sm has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-primary-500 ${
              chosen ? 'border-primary-500 bg-primary-50 font-medium text-primary-900' : 'border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50'
            }`}
          >
            <input type="radio" name={name} value={option.value} checked={chosen} onChange={() => onChange(option.value)} className="sr-only" />
            {option.label}
          </label>
        )
      })}
    </div>
  )
}
