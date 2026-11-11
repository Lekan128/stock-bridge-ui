import { formatDisplayName } from '@/features/users/formatters'
import type { TenantUserSummary } from '@/features/users/types'

/**
 * A phone number as sign-in compares it (the API's WhatsAppNumbers): spaces and dashes gone, +234 and 0 the same.
 */
function number(raw: string): string {
  let digits = raw.replace(/[\s().-]/g, '')
  if (digits.startsWith('+')) digits = digits.slice(1)
  else if (digits.startsWith('00')) digits = digits.slice(2)
  if (/^0\d{10}$/.test(digits)) digits = `234${digits.slice(1)}`
  return digits
}

function names(people: TenantUserSummary[]): string {
  const all = people.map(formatDisplayName)
  return all.length === 1 ? all[0] : `${all.slice(0, -1).join(', ')} and ${all[all.length - 1]}`
}

/**
 * What a shared email or number means for signing in (owner, 2026-11-01): sign-in takes an email or phone only
 * when it points at one active person - the account holder first - so if someone else here has it too, say so
 * where it's typed. Null when nobody else has it.
 *
 * @param person who this form is for: their id (absent when adding), whether they're the account holder, and
 *     their name as it will read.
 */
export function sharedSignInNote(
  kind: 'email' | 'number',
  value: string | null | undefined,
  person: { id?: string; root?: boolean; name: string },
  users: TenantUserSummary[],
): string | null {
  const typed = value?.trim()
  if (!typed) return null
  const same =
    kind === 'email'
      ? (other: TenantUserSummary) => other.email?.trim().toLowerCase() === typed.toLowerCase()
      : (other: TenantUserSummary) => other.phone != null && number(other.phone) === number(typed)
  const others = users.filter((other) => other.active && other.id !== person.id && same(other))
  if (others.length === 0) return null
  const has = others.length === 1 ? 'has' : 'have'
  const owner = others.find((other) => other.root)
  if (person.root) {
    return `${names(others)} ${has} this ${kind} too. ${person.name} can still sign in with it as the account holder; ${
      others.length === 1 ? 'they' : 'they each'
    } will need their username.`
  }
  if (owner) {
    return `This is also ${formatDisplayName(owner)}'s ${kind}, and they hold the account, so they can sign in with it. ${person.name} will need their username.`
  }
  return `${names(others)} ${has} this ${kind} too, so nobody can sign in with it. ${person.name} and ${
    others.length === 1 ? formatDisplayName(others[0]) : 'the others'
  } will each need their username.`
}
