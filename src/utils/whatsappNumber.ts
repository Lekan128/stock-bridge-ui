/**
 * Nigerian mobile numbers as people type them, in the one form WhatsApp links and the API use:
 * `0803 123 4567`, `2348031234567` and `+234 803 123 4567` are all `+2348031234567`. Mirrors the
 * API's `WhatsAppNumbers.normalise`, so the form can say "that isn't a mobile number" before sending.
 */
const NIGERIAN_MOBILE = /^\+234[789][01]\d{8}$/

export function normaliseWhatsApp(typed: string): string | null {
  let digits = typed.replace(/[\s().-]/g, '')
  if (digits.startsWith('+')) digits = digits.slice(1)
  else if (digits.startsWith('00')) digits = digits.slice(2)
  if (!/^\d+$/.test(digits)) return null
  if (digits.length === 11 && digits.startsWith('0')) digits = `234${digits.slice(1)}`
  const e164 = `+${digits}`
  return NIGERIAN_MOBILE.test(e164) ? e164 : null
}

/** `+2348031234567` as a Nigerian reads it: `0803 123 4567`. Anything else is returned as given. */
export function formatWhatsApp(e164: string): string {
  const match = /^\+234(\d{3})(\d{3})(\d{4})$/.exec(e164)
  return match ? `0${match[1]} ${match[2]} ${match[3]}` : e164
}

/** A wa.me link that opens a chat with this number, optionally with a message already typed. */
export function whatsAppLink(e164: string, text?: string): string {
  const base = `https://wa.me/${e164.replace(/^\+/, '')}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}

/**
 * Two letters for an avatar. An owner who signed up with a phone has `+2348031234567` as their
 * username, whose first letters are "+2"; the business name's initials stand in for it.
 */
export function avatarInitials(username: string, businessName?: string | null): string {
  if (/^\+?\d/.test(username) && businessName?.trim()) {
    const words = businessName.trim().split(/[\s-]+/)
    return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : words[0].slice(0, 2)).toUpperCase()
  }
  return username.slice(0, 2).toUpperCase()
}

/** A username as people read it: a phone number in local form, anything else as it is. */
export function displayUsername(username: string): string {
  return username.startsWith('+234') ? formatWhatsApp(username) : username
}
