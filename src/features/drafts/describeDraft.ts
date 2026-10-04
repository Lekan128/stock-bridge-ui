import type { StoredDraft } from '@/features/drafts/draftStore'

export interface DraftSummary {
  /** "Delivery", "New product". */
  title: string
  /** "3 items · INV-204", "Ofada rice" — enough to recognise it. */
  detail: string | null
  /** Where the form lives; opening it picks the draft up. */
  to: string
}

interface DeliveryLike {
  invoiceNo?: string
  entries?: Record<string, { quantity?: string }>
}

interface ProductLike {
  values?: { name?: string }
}

/**
 * A draft as the sync centre lists it (A6). Keys are `delivery:new`, `delivery:{expectedId}` and
 * `product:new` (see `RecordDeliveryPage` and `ProductFormPage`); anything else — a key a later
 * version added — is listed plainly rather than hidden, so logout's count always matches the list.
 */
export function describeDraft(draft: StoredDraft): DraftSummary {
  const [kind, id] = splitKey(draft.key)

  if (kind === 'delivery') {
    const value = draft.value as DeliveryLike
    const lines = Object.values(value.entries ?? {}).filter((entry) => entry.quantity?.trim()).length
    const parts = [
      lines > 0 ? `${lines} ${lines === 1 ? 'item' : 'items'}` : null,
      value.invoiceNo?.trim() || null,
    ].filter(Boolean)
    return {
      title: id === 'new' ? 'Delivery' : 'Delivery for an expected order',
      detail: parts.length > 0 ? parts.join(' · ') : null,
      to: id === 'new' ? '/app/products/receive' : `/app/products/receive?expected=${encodeURIComponent(id)}`,
    }
  }

  if (kind === 'product') {
    const name = (draft.value as ProductLike).values?.name?.trim()
    return { title: 'New product', detail: name || null, to: '/app/products/new' }
  }

  return { title: 'Unfinished form', detail: null, to: '/app' }
}

function splitKey(key: string): [string, string] {
  const at = key.indexOf(':')
  return at < 0 ? [key, ''] : [key.slice(0, at), key.slice(at + 1)]
}
