import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/Button'
import { Sheet } from '@/components/Sheet'
import { TextField } from '@/components/TextField'
import { useToast } from '@/components/useToast'
import { isAppError } from '@/types/api'
import { areasApi } from '@/features/branches/branchesApi'
import { BRANCHES_KEY } from '@/features/branches/BranchProvider'
import { AreaQuestions } from '@/features/branches/AreaQuestions'
import { AREA_KINDS, ARRIVING, hasAreas, kindFlags, suggestedKind, type AreaKind } from '@/features/branches/areas'
import type { Branch } from '@/features/branches/types'

/** The quick picks (STOCK_AREAS_PLAN.md §4.1): the places our restaurants, hotels and shops name. */
const SUGGESTIONS = ['Kitchen', 'Bar', 'Front desk', 'Shop floor', 'Housekeeping']

interface Card {
  key: number
  name: string
  kind: AreaKind
  /** Moves to it wait until someone there confirms them (Part 4). */
  confirms: boolean
  /** The answers were changed by hand: a name typed later no longer picks them. */
  answered: boolean
}

/**
 * Adding areas to a branch (STOCK_AREAS_PLAN.md §4.1; owner, 2026-11-01): a task flow, so a `Sheet` (DESIGN.md) - a
 * side panel on a laptop with the branch still in view, a bottom sheet on a phone. Each area is a card, and the
 * cards are exactly what gets added: no list to put names on first, and one button that says Add. A card is its
 * name and its two answers in a line each, already sensible; "Change" opens that card in place - not a popup - to
 * the same two questions Edit asks, and Done (or another card's Change) folds it again. Quick picks add a card
 * already named. The first time, the Store as it is, with "Rename it". Where deliveries arrive is not asked: it
 * stays the Store, and moves from the branch's Edit. Online only, like every branch change.
 */
export function AddAreasSheet({ branch, onClose }: { branch: Branch; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const first = !hasAreas(branch)
  const store = branch.areas?.find((area) => area.delivery) ?? branch.areas?.[0]
  const [storeName, setStoreName] = useState(store?.name ?? 'Store')
  const [renamingStore, setRenamingStore] = useState(false)
  const nextKey = useRef(1)
  const focusKey = useRef<number | null>(null)
  const [cards, setCards] = useState<Card[]>([blank(0)])
  const [open, setOpen] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const currentName = storeName.trim() || store?.name || 'Store'
  /** Why this card's name can't be used, if it can't: another area, or another card, has it. */
  function clash(card: Card): string | undefined {
    const name = card.name.trim().toLowerCase()
    if (!name) return undefined
    const others = [
      ...(branch.areas ?? []).filter((area) => area.id !== store?.id).map((area) => area.name),
      currentName,
      ...cards.filter((other) => other.key !== card.key).map((other) => other.name),
    ]
    return others.some((other) => other.trim().toLowerCase() === name) ? `There's already an area called ${card.name.trim()}.` : undefined
  }
  const taken = (name: string) =>
    [...(branch.areas ?? []).map((area) => area.name), currentName, ...cards.map((card) => card.name)].some(
      (other) => other.trim().toLowerCase() === name.toLowerCase(),
    )
  const named = cards.filter((card) => card.name.trim())
  const ready = named.length > 0 && cards.every((card) => !clash(card))

  function change(key: number, patch: Partial<Card>) {
    setCards((all) => all.map((card) => (card.key === key ? { ...card, ...patch } : card)))
  }

  function rename(card: Card, name: string) {
    // A typed "Kitchen" starts like the quick pick, until its answers are changed by hand.
    change(card.key, card.answered ? { name } : { name, kind: suggestedKind(name) })
  }

  function addCard(name = '') {
    const empty = name ? cards.find((card) => !card.name.trim() && !card.answered) : null
    if (empty) {
      // A quick pick fills the card still waiting for a name, rather than adding one beside it.
      change(empty.key, { name, kind: suggestedKind(name) })
      return
    }
    const card = { ...blank(nextKey.current++), name, kind: suggestedKind(name) }
    setCards((all) => [...all, card])
    setOpen(null)
    focusKey.current = name ? null : card.key
  }

  async function save() {
    setBusy(true)
    setProblem(null)
    try {
      if (first && store && currentName !== store.name) {
        await areasApi.update(store.id, { name: currentName })
      }
      await areasApi.add(
        branch.id,
        named.map((card) => ({ name: card.name.trim().replace(/\s+/g, ' '), ...kindFlags(card.kind), confirms: card.confirms })),
      )
      await queryClient.invalidateQueries({ queryKey: BRANCHES_KEY })
      const total = (branch.areas?.length ?? 1) + named.length
      showToast(
        first
          ? `${branch.name} now has ${total} areas. Everything you have is in the ${currentName}.`
          : `${named.length === 1 ? named[0].name.trim() : `${named.length} areas`} added to ${branch.name}.`,
        'success',
      )
      onClose()
    } catch (error) {
      setProblem(isAppError(error) ? error.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const saveLabel = named.length === 0 ? 'Add areas' : `Add ${named.length === 1 ? named[0].name.trim() : `${named.length} areas`}`
  const picks = SUGGESTIONS.filter((name) => !taken(name))

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Add areas to ${branch.name}`}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="action" onClick={() => void save()} loading={busy} disabled={!ready}>
            {saveLabel}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (ready) void save()
        }}
      >
        {first &&
          (renamingStore ? (
            <TextField
              id="current-area-name"
              label="Where your stock is now"
              value={storeName}
              autoFocus
              onFocus={(event) => event.target.select()}
              onChange={(event) => setStoreName(event.target.value)}
              hint="All your current stock stays here."
            />
          ) : (
            <p className="text-sm text-neutral-700">
              Your stock is in the <span className="font-medium text-neutral-900">{currentName}</span>.{' '}
              <button
                type="button"
                onClick={() => setRenamingStore(true)}
                className="inline-flex min-h-11 items-center font-medium text-primary-700 hover:underline"
              >
                Rename it
              </button>
            </p>
          ))}

        {picks.length > 0 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Quick picks">
            {picks.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => addCard(name)}
                className="inline-flex min-h-11 items-center gap-1 rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-800 hover:bg-neutral-50"
              >
                <Plus className="h-4 w-4 text-neutral-500" aria-hidden="true" />
                {name}
              </button>
            ))}
          </div>
        )}

        <ul aria-label="Areas to add" className="flex flex-col gap-3">
          {cards.map((card) => {
            const isOpen = open === card.key
            const label = card.name.trim() || 'the new area'
            return (
              <li
                key={card.key}
                data-area-card={card.name.trim()}
                className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-3"
              >
                <div className="flex items-center gap-1">
                  <div className="min-w-0 flex-1">
                    <TextField
                      id={`new-area-${card.key}`}
                      label="Area name"
                      hideLabel
                      placeholder="Area name"
                      className="font-medium"
                      value={card.name}
                      autoFocus={focusKey.current === card.key}
                      onChange={(event) => rename(card, event.target.value)}
                      error={clash(card)}
                    />
                  </div>
                  {cards.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setCards((all) => all.filter((other) => other.key !== card.key))
                        if (isOpen) setOpen(null)
                      }}
                      className="-mr-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100"
                      aria-label={`Remove ${label}`}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>

                {isOpen ? (
                  // Opened in place, the card grows (owner, 2026-11-01: no popups): the same questions as Edit.
                  <div className="flex flex-col gap-4" id={`area-answers-${card.key}`}>
                    <AreaQuestions
                      id={`new-area-${card.key}`}
                      name={card.name}
                      kind={card.kind}
                      confirms={card.confirms}
                      onKind={(kind) => change(card.key, { kind, answered: true })}
                      onConfirms={(confirms) => change(card.key, { confirms, answered: true })}
                    />
                    <button
                      type="button"
                      onClick={() => setOpen(null)}
                      aria-expanded
                      aria-controls={`area-answers-${card.key}`}
                      className="-my-2 inline-flex min-h-11 items-center self-end px-1 text-sm font-medium text-primary-700 hover:underline"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <div className="flex items-end justify-between gap-3" data-area-answers>
                    <p className="min-w-0 text-sm text-neutral-700">
                      <span className="block">{AREA_KINDS[card.kind].title}</span>
                      <span className="block">{card.confirms ? ARRIVING.CONFIRM : ARRIVING.NOW}</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => setOpen(card.key)}
                      aria-expanded={false}
                      aria-label={`Change what happens at ${label}`}
                      className="-my-2 -mr-1 inline-flex min-h-11 shrink-0 items-center px-1 text-sm font-medium text-primary-700 hover:underline"
                    >
                      Change
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>

        <button
          type="button"
          onClick={() => addCard()}
          className="-mt-1 inline-flex min-h-11 items-center gap-1 self-start px-1 text-sm font-medium text-primary-700 hover:underline"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Another area
        </button>

        {problem && (
          <p role="alert" className="text-sm text-danger-700">
            {problem}
          </p>
        )}
      </form>
    </Sheet>
  )
}

function blank(key: number): Card {
  return { key, name: '', kind: 'STORED', confirms: false, answered: false }
}
