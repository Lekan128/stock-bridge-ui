# Stock Bridge — Design Tokens

Design tokens live in `src/index.css` under the Tailwind v4 `@theme` block (CSS-first config —
there is no `tailwind.config.js`). Every token below is available as a Tailwind utility, e.g.
`--color-primary-600` → `bg-primary-600` / `text-primary-600` / `border-primary-600`.

## Color

### Primary — deep navy blue
Brand color. Base is `primary-600` (`#1E3A8A`). Use for primary buttons, links, active nav
state, focus rings.

| Token | Hex | Typical use |
|---|---|---|
| primary-50  | `#EEF2FA` | subtle tinted backgrounds |
| primary-100 | `#D9E2F5` | selected row / hover background |
| primary-200 | `#B3C5EB` | borders on tinted surfaces |
| primary-300 | `#8CA8E0` | disabled text on dark |
| primary-400 | `#5F82CC` | secondary icons |
| primary-500 | `#3D5FAE` | secondary buttons |
| **primary-600** | **`#1E3A8A`** | **default — buttons, links, active state** |
| primary-700 | `#172F6E` | hover/active state |
| primary-800 | `#112353` | pressed state |
| primary-900 | `#0B1836` | high-contrast text on light |

### Accent — emerald green
Used for success states, positive numeric deltas, and as a primary CTA accent where the blue
would clash (e.g. a "Save" button next to a blue nav). Base is `accent-600` (`#059669`).

| Token | Hex | Typical use |
|---|---|---|
| accent-50  | `#ECFDF5` | success banner background |
| accent-100 | `#D1FAE5` | success badge background |
| accent-200 | `#A7F3D0` | success badge border |
| accent-500 | `#10B981` | success icons |
| **accent-600** | **`#059669`** | **default — success text, positive numbers, accent CTAs** |
| accent-700 | `#047857` | hover/active state |
| accent-800 | `#046C4E` | pressed state |
| accent-900 | `#033D2D` | high-contrast text on light |

### Neutral — grays
Off-black text (`neutral-900`, not `#000`) on off-white surfaces (`neutral-50`, not `#fff`) —
a softer, less clinical read than pure black/white, in the spirit of Odoo's UI.

| Token | Hex | Typical use |
|---|---|---|
| neutral-50  | `#F7F8FA` | app background |
| neutral-100 | `#EEF0F3` | card/panel background |
| neutral-200 | `#E2E5EA` | default border |
| neutral-300 | `#CBD0D8` | disabled border |
| neutral-400 | `#9AA2AF` | placeholder text |
| neutral-500 | `#6B7280` | secondary/muted text |
| neutral-600 | `#4B5563` | body text (secondary emphasis) |
| neutral-700 | `#374151` | body text |
| neutral-800 | `#232833` | headings |
| neutral-900 | `#171A21` | primary text (off-black) |

### Warning — amber (low-stock alerts)

| Token | Hex | Typical use |
|---|---|---|
| warning-50  | `#FFFBEB` | pale banner/badge background |
| warning-100 | `#FEF3C7` | badge background |
| warning-200 | `#FDE68A` | badge/banner border |
| warning-500 | `#F59E0B` | icon |
| warning-600 | `#D97706` | text on light background |
| warning-700 | `#B45309` | darker text/border pairing on banners |

Pattern for a low-stock banner: `bg-warning-50 border border-warning-200 text-warning-700`.

### Danger — red (destructive actions, errors)

| Token | Hex | Typical use |
|---|---|---|
| danger-50  | `#FEF2F2` | pale banner/badge background |
| danger-100 | `#FEE2E2` | badge background |
| danger-200 | `#FECACA` | badge/banner border |
| danger-500 | `#EF4444` | icon |
| danger-600 | `#DC2626` | destructive button background |
| danger-700 | `#B91C1C` | destructive button hover, error text |

## Typography

Font is **Inter**, self-hosted via `@fontsource/inter` (no external font CDN request at
runtime). Configured as the default `font-sans`. Weights loaded: 400, 500, 600, 700.

- Headings: 600 weight, `text-neutral-800` or `text-neutral-900`.
- Body: 400 weight, `text-neutral-700`.
- Muted/secondary text: 400 weight, `text-neutral-500`.

## Spacing

No override of Tailwind's default spacing scale (4px base unit). Stick to multiples of `1`
(4px) or `2` (8px) for padding/margin/gap — avoid odd values — to keep rhythm consistent
across the app.

## Radius — modest, "corporate software"

Tailwind's default radius scale is intentionally trimmed down so nothing reads as playful or
overly rounded:

| Token | Value | Use |
|---|---|---|
| `rounded-sm` | 4px  | checkboxes, small chips |
| `rounded-md` | 6px  | **default** — buttons, inputs, selects |
| `rounded-lg` | 8px  | cards, modals, panels |
| `rounded-xl` | 10px | large containers (rare) |

Avoid `rounded-2xl`/`rounded-3xl` entirely. `rounded-full` is reserved for circular avatars and
status dots only, not buttons or badges.

## Usage examples

```tsx
// Primary CTA
<button className="rounded-md bg-primary-600 px-4 py-2 text-white hover:bg-primary-700">
  Save changes
</button>

// Low-stock warning banner
<div className="rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-warning-700">
  3 items are running low on stock.
</div>

// Destructive action
<button className="rounded-md bg-danger-600 px-4 py-2 text-white hover:bg-danger-700">
  Delete product
</button>

// Positive delta
<span className="text-accent-600 font-medium">+12.4%</span>
```
