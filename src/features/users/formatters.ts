const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

export function formatDate(value: string): string {
  return dateFormatter.format(new Date(value))
}

function words(code: string): string[] {
  return code.split(/[_\s]+/).filter(Boolean)
}

/**
 * Humanises a backend role code for display: PROCUREMENT_MANAGER -> "Procurement Manager".
 * Deliberately generic (underscore -> space + title case) so roles added later render correctly.
 */
export function formatRoleName(code: string): string {
  return words(code)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/** Humanises a permission code in sentence case: MANAGE_INVENTORY -> "Manage inventory". */
export function formatPermissionName(code: string): string {
  const parts = words(code).map((word) => word.toLowerCase())
  if (parts.length === 0) return ''
  return [parts[0].charAt(0).toUpperCase() + parts[0].slice(1), ...parts.slice(1)].join(' ')
}

/** Joins the name parts that are actually present; returns null when the user has neither. */
export function formatFullName(firstName?: string | null, lastName?: string | null): string | null {
  const full = [firstName, lastName]
    .map((part) => part?.trim() ?? '')
    .filter(Boolean)
    .join(' ')
  return full || null
}

/** Full name when set, otherwise the username — never blank, never "undefined". */
export function formatDisplayName(user: {
  username: string
  firstName?: string | null
  lastName?: string | null
}): string {
  return formatFullName(user.firstName, user.lastName) ?? user.username
}
