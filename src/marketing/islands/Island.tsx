import type { ReactNode } from 'react'

export type IslandName = 'account' | 'scarcity' | 'receipt' | 'setup' | 'sticky' | 'loss'

/**
 * A part of the static landing page that comes alive in the browser. The page is prerendered HTML
 * and stays that way; only what sits inside an Island is hydrated (`../main.tsx`), with the props
 * written here. So the page's words never ship twice, once as HTML and again as JavaScript.
 */
export function Island({ name, props, children }: { name: IslandName; props?: object; children: ReactNode }) {
  return (
    <div className="contents" data-island={name} data-props={props ? JSON.stringify(props) : undefined}>
      {children}
    </div>
  )
}

/** Every CTA carries this; one listener in `../main.tsx` turns a click into the setup form. */
export const OPEN_SETUP_EVENT = 'pp:open-setup'

/** The setup form announces it is listening (it hydrates after the page's buttons are tappable). */
export const SETUP_READY_EVENT = 'pp:setup-ready'
