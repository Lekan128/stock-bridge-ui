# Procure Paddy — Interaction Patterns

Companion to `DESIGN.md`, which covers tokens (color, type, spacing). This file covers the layer
above tokens: recurring interaction shapes, so the next screen that hits one of these problems
starts from the rule instead of rediscovering it from a bug report. Written out of
`UX_CONSISTENCY_DESIGN_PLAN.md` (project root), which has the full diagnosis and evidence behind
each pattern below; this file is the reusable rule, kept short on purpose.

---

## Pattern A — never let creating B abandon creating A

**The rule.** Any time a form lets the user pick an existing related record — a supplier, a
category, a unit, a pickup address, a buyer contact — the "or add a new one" path must never be a
full navigation away from the form in progress. React Router unmounts the page on navigation;
every field already filled in is gone, and it does not come back.

**The two shapes, pick by data complexity:**

| Shape | Use when | Reference implementation |
|---|---|---|
| **Inline swap** | The related record is simple — 1–3 fields, no sections | `CategoryField.tsx` — the select's "+ New category" option swaps it for a name input in place; Enter creates and selects it, Escape backs out |
| **Modal over the form** | The related record is a real object with its own sections (contact info, address, bank details) | `SupplierField.tsx` wrapping `VendorFormModal.tsx` — "+ Add new supplier" opens the same modal `VendorListPage` uses, over whatever screen the field is on |

Either way, the picker's options update **in memory** the instant the related record is saved —
`onCreated` appends to the hook's own state (`useCompanyCategories.upsert`,
`useVendorOptions.upsert`) — never a refetch-and-hope-it's-there. The newly created record is
selected automatically; the user never re-opens the dropdown to find what they just typed.

**Explicitly not a pattern here: a new tab with a manual reload-to-refresh step.** It solves a
state-preservation problem this app's architecture doesn't have (an SPA already holds form state
in memory — a modal preserves it for free), and it would be a second, inconsistent answer to a
question already answered twice.

**Checklist for a new "pick or add" field:**
1. Does the add-new path navigate away from the form being filled in? If yes, it fails this rule
   regardless of how good the destination screen is.
2. Simple shape → inline swap. Real object → modal.
3. Wire the picker's own hook with an `upsert`/append function; wire the create surface's
   `onCreated`/`onSaved` to call it and then select the new id.

**Known instances:**
- ✅ Category, on the product form (`ProductFormPage.tsx`) — the original, pre-existing
  reference implementation.
- ✅ Supplier, on the product form and the expected-delivery form
  (`NewExpectedDeliveryPage.tsx`) — both now share `SupplierField.tsx`.
- Checked and clear: `StockInModal.tsx`'s "different supplier" disclosure already stays in-modal.
- Not yet audited: pickup addresses, buyer contacts, any future marketplace-vendor-facing form
  referencing a company-side record.

---

## Pattern B — every alarm view needs a census view

**The rule.** Wherever the product tracks a quantity against a threshold (stock levels today;
plausibly expiring batches or overdue payments later), the UI must show the state of the whole
population, not only the subset that has crossed the threshold. The alarm view is a **filter on**
the census view, never a separate screen with its own table.

**Why it's a trap otherwise:** a dashboard card that only ever shows a problem count gives no way
to tell "the count is 0 because everything is fine" apart from "the count is 0 because the feature
is broken and nothing is loading." A well-stocked count sitting next to it is what makes the zero
legible.

**Reference implementation — stock levels:**
- `AnalyticsSummaryResponse` (backend) carries `wellStockedProductCount` and
  `outOfStockProductCount` alongside the pre-existing `lowStockProductCount`, each its own
  server-computed figure (never derived by subtracting the others client-side — see the record's
  own javadoc for why that would double-count).
- `DashboardAnalytics.tsx` renders all three as `StatCard`s — `success` / `warning` / `danger`
  variants — next to **Active Products**, so the dashboard has an answer to "what do I have," not
  only "what's about to run out."
- `GET /api/products` gained a `stockStatus=OK|LOW|OUT` filter (`StockStatus.java`), surfaced as
  filter chips on the Inventory page's own toolbar (`ProductsToolbar.tsx`) rather than as a
  second page. The dashboard's "Well Stocked" / "Out of Stock" cards deep-link here
  (`/app/products?stockStatus=OK` etc.); "Low Stock" keeps its own established route
  (`/app/products/low-stock`) and definition, untouched.

**Checklist for a new "things below a threshold" screen:**
1. Does a dashboard card for this domain show *only* the problem count? If so, it's missing its
   "everything's fine" segment.
2. Is the "problem" filter a dedicated page with its own table? Fold it into the canonical list
   page as a filter instead, the way `/app/products/low-stock`'s role was absorbed into the
   Inventory page's chips without removing its own bookmarked URL.
3. If the new filter's definition could double-count against an existing one, give the "well
   stocked" / "total" figure its own query — don't do the subtraction in two places that might
   drift apart.
