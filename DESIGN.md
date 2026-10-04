# Procure Paddy — Design Tokens and Foundation

Design tokens live in `src/index.css` under the Tailwind v4 `@theme` block (CSS-first config —
there is no `tailwind.config.js`). Every token below is available as a Tailwind utility, e.g.
`--color-primary-600` → `bg-primary-600` / `text-primary-600` / `border-primary-600`.

The direction behind all of it — "the Stockbook", the ruled ledger and carbon-copy receipt book a
storekeeper already keeps — is in `INVENTORY_OFFLINE_AND_CHARACTER_PLAN.md` §2 (project root).
Interaction rules that sit above tokens are in `UX_PATTERNS.md`. Before merging anything visual,
run the checklist at the end of this file.

---

## Color

> **Under team review (decision D5).** The values below are what ships today. Plan §3 proposes
> three options — warm kraft neutrals, plus a palm-oil orange action colour, plus adire indigo for
> the brand — and every one is token-only. Until the team decides, nothing here changes; when it
> does, the `--color-neutral-*`, `--color-action*` and (option 3) `--color-primary-*` values are
> the only edits. A build made with `VITE_DESIGN_PREVIEW=true` previews each option on real
> screens at `/app/design-spike`.

### Action — the one main thing to do on a screen
`--color-action` / `--color-action-hover` → `bg-action`, `hover:bg-action-hover`. Used only by
`<Button variant="action">`, and only once per screen (see Buttons below). Today it points at
`primary-600` / `primary-700`, so it looks like a primary button; it is its own token so the §3
decision can give it its own colour without touching anything else.

If palm-oil orange is chosen, the button colour is **`#C4471B`** (4.92:1 with a white label), not
§3's `#D9531E` (4.03:1, below WCAG AA for a 14px label). The brighter value is fine for fills that
carry no text. Measured in the B1 spike.

### Primary — deep navy blue
Brand color. Base is `primary-600` (`#1E3A8A`). Links, the active navigation pill, focus rings,
selected rows, and `primary` buttons that are not the screen's action.

| Token | Hex | Typical use |
|---|---|---|
| primary-50  | `#EEF2FA` | active nav pill, selected row |
| primary-100 | `#D9E2F5` | selected row hover |
| primary-200 | `#B3C5EB` | borders on tinted surfaces |
| primary-300 | `#8CA8E0` | disabled text on dark |
| primary-400 | `#5F82CC` | secondary icons |
| primary-500 | `#3D5FAE` | focus ring |
| **primary-600** | **`#1E3A8A`** | **default — links, primary buttons, RECORDED stamp** |
| primary-700 | `#172F6E` | hover/active state, link text |
| primary-800 | `#112353` | text on primary-50 (active nav) |
| primary-900 | `#0B1836` | high-contrast text on light |

### Accent — emerald green
Success and good news: a healthy empty state, "All caught up", the SYNCED stamp, success toasts.
Not a call to action — that is `action`'s job. Base is `accent-600` (`#059669`).

| Token | Hex | Typical use |
|---|---|---|
| accent-50  | `#ECFDF5` | success banner/toast background |
| accent-100 | `#D1FAE5` | success badge background |
| accent-200 | `#A7F3D0` | success badge border |
| accent-500 | `#10B981` | success icons |
| **accent-600** | **`#059669`** | **default — success text, positive numbers** |
| accent-700 | `#047857` | SYNCED stamp fill |
| accent-800 | `#046C4E` | text on accent-50 |
| accent-900 | `#033D2D` | high-contrast text on light |

### Neutral — grays
Off-black text (`neutral-900`, not `#000`) on off-white surfaces (`neutral-50`, not `#fff`).
Cards and panels are white on that ground. Healthy stock is drawn in neutrals too — most rows
carry no colour at all (plan §2, "calm by default").

| Token | Hex | Typical use |
|---|---|---|
| neutral-50  | `#F7F8FA` | app background |
| neutral-100 | `#EEF0F3` | StockBar track, hover background |
| neutral-200 | `#E2E5EA` | default border |
| neutral-300 | `#CBD0D8` | healthy StockBar fill, disabled border |
| neutral-400 | `#9AA2AF` | placeholder text, a figure of nought |
| neutral-500 | `#6B7280` | secondary/muted text, units after a figure |
| neutral-600 | `#4B5563` | body text (secondary emphasis) |
| neutral-700 | `#374151` | body text |
| neutral-800 | `#232833` | headings |
| neutral-900 | `#171A21` | primary text, stock figures |

`neutral-500` on `neutral-50` is 4.55:1 — it clears AA, narrowly. Don't go lighter for anything
someone has to read.

### Warning — amber (low stock, needs a decision)

| Token | Hex | Typical use |
|---|---|---|
| warning-50  | `#FFFBEB` | banner/stamp background |
| warning-100 | `#FEF3C7` | badge background |
| warning-200 | `#FDE68A` | banner border |
| warning-500 | `#F59E0B` | Low StockBar fill, icon |
| warning-600 | `#D97706` | CHECK stamp border |
| warning-700 | `#B45309` | darker text/border pairing |
| warning-800 | `#92400E` | text on warning-50, the word "Low" |

### Danger — red (errors, destructive actions)

| Token | Hex | Typical use |
|---|---|---|
| danger-50  | `#FEF2F2` | error banner background |
| danger-100 | `#FEE2E2` | badge background |
| danger-200 | `#FECACA` | error border |
| danger-500 | `#EF4444` | icon |
| danger-600 | `#DC2626` | destructive button — **inside a confirmation only** |
| danger-700 | `#B91C1C` | error text, the word "Out", destructive menu items |

Red is earned. A request that never reached the server is **not** an error and is not red (see
ErrorState below).

---

## Typography

Two faces, one per surface:

| Surface | Face | Why |
|---|---|---|
| The `/app` workspace | **IBM Plex Sans** (`--font-workspace`) | Decision D4, chosen on real data in the B1 spike: true tabular figures, open counters at small sizes, figures 8% narrower than Inter's, and condensed widths built into the same file. |
| Storefront, sign-in | **Inter** (`--font-sans` default) | The ProcurePal storefront keeps its own identity, as §3 scopes the colour change to `/app`. |

`AppLayout` sets `data-surface="workspace"` on `<html>` while the workspace is open, which points
`--font-sans` at Plex — on `<html>`, not a wrapper, so dialogs and toasts portaled to `<body>` get
it too. Both faces are self-hosted (`@fontsource-variable/ibm-plex-sans`, `@fontsource/inter`) and
their Latin files are precached by the service worker (`vite.config.ts`), so the workspace looks
the same offline.

- **`font-narrow`** (`font-stretch: 85%`) — Plex's condensed cut from the same variable file. For
  dense tables and quantity columns (the Inventory table uses it). A no-op on Inter.
- **`tabular-nums`** on every figure that lines up with another: stock, prices, times, counts.
- **Scale.** Stock figures are the hero (plan §2, "the number is the hero"): 40px/600 on the
  product page, 20px in summaries, 14px/600 in rows — the unit beside it a step smaller and muted.
  Headings are 600; body is 400; labels recede.
- Never Inter in the workspace, never monospace as a "techy" signal.

## Spacing

No override of Tailwind's default spacing scale (4px base unit). Multiples of `1` (4px) or `2`
(8px) for padding, margin and gap; lay sibling groups out with `flex`/`grid` and `gap`.

## Radius — modest, "corporate software"

| Token | Value | Use |
|---|---|---|
| `rounded-sm` | 4px  | checkboxes, small chips, stamps |
| `rounded-md` | 6px  | **default** — buttons, inputs, selects, toasts |
| `rounded-lg` | 8px  | cards, modals, panels |
| `rounded-xl` | 10px | the top corners of a bottom sheet |

Avoid `rounded-2xl`/`rounded-3xl`. `rounded-full` is for avatars, status dots and the StockBar.

## Elevation

One shadow, **`shadow-paper`** ("lifted paper": tight and soft) — for things that float over the
page: sheets, side panels, menus, toasts. Cards sit flat with a border. Don't use `shadow-lg` on
new work.

## Motion

150–200ms, transform and opacity only, ease-out, and only in three places (plan §2). All three
switch off under `prefers-reduced-motion`.

| Token | Where |
|---|---|
| `animate-sheet-up` / `animate-panel-in` | a sheet rising on a phone / a panel entering on a laptop |
| `animate-stamp-land` | a stamp whose state has just changed (a SYNCED that landed moments ago) |
| `animate-fade-slide-up` | toasts and auth cards (pre-existing) |

---

## Foundation components

Use these instead of hand-rolling the same thing. Each one's file carries the full reasoning.

### Buttons — `components/Button.tsx`

| Variant | Use |
|---|---|
| `action` | **The one main thing to do on this screen** — Add Product, Stock In, Create product, Submit a delivery, a sheet's Confirm. At most one per screen. |
| `primary` | An important button that isn't the screen's action (a dialog's own confirm). |
| `secondary` | Everything else, by default. |
| `quiet` | Text-weight: Cancel, Show more, actions inside rows. |
| `danger` | **Only inside a confirmation dialog.** Never on a page header. |

Destructive and rarely-used actions go in **`OverflowMenu`** ("⋯"), as red text, behind their
confirmation — e.g. Deactivate on the product page, Cancel order on an order. A red button never
sits beside the screen's action.

### Dialogs — `Sheet` and `Modal`

| Component | Use | Shape |
|---|---|---|
| `Sheet` | Task flows: stock in, stock out, count, a new supplier — anything with a form | A bottom sheet on a phone (in reach of the thumb, the page still showing above), a side panel from the right on a laptop (the product or list stays in view beside the work). Sizes `sm`–`xl` set the panel width. |
| `Modal` | Short confirmations only | Centred. |

Both use `useDialogBehaviour`: initial focus (whatever autofocused, else `[data-autofocus]`, else
the first field), a focus trap, `inert` on everything behind, Escape closes only the top dialog,
and focus returns to whatever opened it. A new dialog-like surface must use the hook too.

### Stock figures — `StockFigure` and `StockBar`

- **`StockFigure`** is the only way a stock quantity is shown: the number in tabular figures, its
  unit attached ("96 pieces", never "96 Piece"), the pack restatement under it ("= 20 bags"), and —
  with `productId` — what this phone holds and hasn't sent ("+10 kg waiting"), beside the figure,
  never added into it. `size` `sm` (rows), `md` (cards), `lg` (the product hero); `signed` for a
  movement ("+400 kg", "−100 kg"). Nought is greyed, never bolded.
- **`StockBar`** shows on-hand against the low-stock alert level: a tick at the alert line (half
  the bar), grey fill when healthy, amber when Low, empty when Out — and the word "Low"/"Out", so
  the state never rests on colour alone. It replaces the old stripe + badge + border triple: say a
  state once.

### Stamps — `components/Stamp.tsx`

The rubber stamp on a waybill, as status: **RECORDED** (outlined — saved on this phone, not sent),
**SYNCED** (solid — recorded on the server), **CHECK** (amber — needs a decision). Used wherever a
write is shown: the sync centre, the "Saved on this phone" receipt. `land` animates one that has
just changed. See Pattern C in `UX_PATTERNS.md`.

### Empty and error states — `EmptyState`, `ErrorState`

Left-aligned and set like the rest of the page: a title with a small inline icon, what is missing
or what went wrong as a sentence, then the next action. No dashed boxes, no icon in a circle above
a centred heading. `ErrorState` recognises a request that never got an answer (offline, timed out,
unreachable — `NETWORK_MESSAGES` in `createApiClient.ts`) and sets it calm: a cloud, a neutral
border, "Can't reach the server right now" when no title is given. Red is kept for real failures.

### Toasts — `useToast().showToast(message, variant, options)`

Bottom-left on a laptop, along the bottom on a phone. A toast can carry one action
(`options.action`, e.g. **Undo**); one that does stays 8s instead of 4s, pauses while hovered or
focused, and can be dismissed. After a stock write the toast carries the new figure:
"Stock in recorded · Rice now 1,350 kg · Undo" (decision D8).

---

## Before you merge — the review checklist

From the Impeccable audit (plan §1.3) and the Stockbook principles (plan §2). Go through it for any
change someone will see; each "no" needs a reason in the PR.

**Character, not template**
- [ ] No new Inter in the workspace, no monospace-as-"techy", no gradient text.
- [ ] No left-border accent stripes, no inset box-shadow stripes, no "icon in a tinted circle"
      above a heading.
- [ ] No identical card grid or row of big-number tiles unless those numbers are the point of the
      screen.
- [ ] Containers only where something really is a separate object — rules and columns first, not
      cards inside cards.
- [ ] A state is said once — not a stripe *and* a badge *and* a border.

**Hierarchy**
- [ ] At most one `action` button on the screen; danger only inside a confirmation or "⋯".
- [ ] Figures are bigger than their labels; units recede; `tabular-nums` where digits line up.
- [ ] Every stock quantity goes through `StockFigure`; every threshold through `StockBar`.
- [ ] Copy is plain and kind; errors never cute; nothing says "Something went wrong" when the
      network is the cause.

**Offline-honest** (Pattern C, `UX_PATTERNS.md`)
- [ ] Every write shows where it stands; every figure that might be old says when it was true.
- [ ] Pending is shown beside the figure, never added into it.
- [ ] Nothing the server refused is dropped silently.
- [ ] Offline, the screen only appends (stock in, stock out, count); editing a shared record
      waits for a connection and says so.

**Reach and access**
- [ ] Works at 390px wide with no sideways scroll (tables excepted, inside their own scroller).
- [ ] Task flows are a `Sheet`; dialogs use `useDialogBehaviour`; focus is visible.
- [ ] Contrast ≥ 4.5:1 for text (check `neutral-500` and anything on a tint).
- [ ] Motion is one of the three above and respects reduced motion.
