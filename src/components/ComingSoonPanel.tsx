import { Construction } from 'lucide-react'

export interface ComingSoonPanelProps {
  title: string
  /** One line on what will live here, so a placeholder route is never a mystery in review. */
  description: string
  /** The module that owns filling this in — kept visible while the build is in flight. */
  owner?: string
}

/**
 * Placeholder body for a route that exists (so links and guards can be wired and tested) but whose
 * feature is being built in a parallel workstream. Replaced wholesale by the owning module — see
 * the note in each page file.
 */
export function ComingSoonPanel({ title, description, owner }: ComingSoonPanelProps) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-500">
        <Construction className="h-6 w-6" aria-hidden="true" />
      </div>
      <h1 className="mt-4 text-lg font-semibold text-neutral-900">{title}</h1>
      <p className="mt-1 max-w-md text-sm text-neutral-500">{description}</p>
      {owner && <p className="mt-4 text-xs font-medium uppercase tracking-wide text-neutral-400">{owner}</p>}
    </div>
  )
}
