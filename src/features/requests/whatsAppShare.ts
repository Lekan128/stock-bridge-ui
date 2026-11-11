import type { ToastAction } from '@/components/ToastContext'
import { whatsAppLink } from '@/utils/whatsappNumber'

/** What an ask can be sent on WhatsApp as (owner, 2026-11-01): the message, and who can move it. */
export interface AskShare {
  text: string
  /** The Store's people who can move it and have a number; empty when there's nobody to name (or it's offline). */
  movers: { name: string; whatsapp: string }[]
}

function open(url: string) {
  window.open(url, '_blank', 'noopener')
}

/** The first name, for "Tell Amaka on WhatsApp". */
function firstName(name: string): string {
  return name.split(/\s+/)[0] || name
}

/**
 * The toast's WhatsApp button: one person who can move it - "Tell Amaka on WhatsApp", one tap; several - "Tell on
 * WhatsApp", their names in a short list, one tap each; nobody with a number - "Share on WhatsApp", WhatsApp's own
 * contact picker. The message is already typed; they press send.
 */
export function whatsAppAction(share: AskShare): ToastAction {
  if (share.movers.length === 1) {
    const mover = share.movers[0]
    return { label: `Tell ${firstName(mover.name)} on WhatsApp`, onAction: () => open(whatsAppLink(mover.whatsapp, share.text)) }
  }
  if (share.movers.length > 1) {
    return {
      label: 'Tell on WhatsApp',
      onAction: () => {},
      choices: share.movers.map((mover) => ({ label: mover.name, onSelect: () => open(whatsAppLink(mover.whatsapp, share.text)) })),
    }
  }
  return { label: 'Share on WhatsApp', onAction: () => open(`https://wa.me/?text=${encodeURIComponent(share.text)}`) }
}
