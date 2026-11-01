import { useRef, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { useClickOutside } from '@/hooks/useClickOutside'
import { whatsAppAction, type AskShare } from '@/features/requests/whatsAppShare'

/**
 * "Tell Amaka on WhatsApp" as a small button on quick mode's session line (owner, 2026-11-01) - its stamp only
 * shows for a moment. Several people who can move it: their names in a short list under it, one tap each.
 */
export function WhatsAppTell({ share }: { share: AskShare }) {
  const action = whatsAppAction(share)
  const [menuOpen, setMenuOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setMenuOpen(false))
  return (
    <div className="relative" ref={ref} data-whatsapp-tell>
      <button
        type="button"
        aria-haspopup={action.choices ? 'menu' : undefined}
        aria-expanded={action.choices ? menuOpen : undefined}
        onClick={() => (action.choices ? setMenuOpen((was) => !was) : action.onAction())}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-1 text-sm font-medium text-primary-700 hover:underline"
      >
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
        {action.label}
      </button>
      {menuOpen && action.choices && (
        <div role="menu" className="absolute top-full left-0 z-10 mt-1 flex min-w-[12rem] flex-col rounded-md border border-neutral-200 bg-white p-1 shadow-lg">
          {action.choices.map((choice) => (
            <button
              key={choice.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false)
                choice.onSelect()
              }}
              className="flex min-h-11 items-center rounded-md px-3 text-left text-sm text-neutral-800 hover:bg-neutral-50"
            >
              {choice.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
