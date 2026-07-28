import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

/**
 * Spreads a backend 400 across the form fields it belongs to.
 *
 * Bean-validation failures come back as one flat sentence — `ValidationErrors.describe` joins
 * `"<fieldName> <constraint message>"` with `"; "` — so the only way to put "must not be blank"
 * next to the right input is to split it back apart. Anything that does not match a known field
 * is returned for the form-level error, so nothing the server said is ever swallowed.
 *
 * Generalised from the copy inside ProfileDetailsForm, which predates it and is left alone.
 */
export function applyBackendFieldErrors<T extends FieldValues>(
  message: string,
  fieldKeys: readonly Path<T>[],
  setError: UseFormSetError<T>,
): string | null {
  const leftovers: string[] = []

  for (const part of message.split('; ')) {
    const field = fieldKeys.find((key) => part.startsWith(`${key} `))
    if (!field) {
      leftovers.push(part)
      continue
    }
    const detail = part.slice(String(field).length + 1)
    setError(field, { message: detail.charAt(0).toUpperCase() + detail.slice(1) })
  }

  return leftovers.length > 0 ? leftovers.join('; ') : null
}
