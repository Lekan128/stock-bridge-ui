# Procure Paddy — Interaction Patterns

Companion to `DESIGN.md`, which covers tokens and the foundation components (buttons, sheets,
stock figures, stamps, states, toasts) and ends with the pre-merge checklist. This file covers the
layer above them: recurring interaction shapes, so the next screen that hits one of these problems
starts from the rule instead of rediscovering it from a bug report. Patterns A and B were written
out of `UX_CONSISTENCY_DESIGN_PLAN.md` and Pattern C out of `INVENTORY_OFFLINE_AND_CHARACTER_PLAN.md`
(both at the project root), which hold the full diagnosis and evidence; this file is the reusable
rule, kept short on purpose.

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

---

## Pattern C — offline-honest UI

**The rule.** The workspace works without a connection (`INVENTORY_OFFLINE_AND_CHARACTER_PLAN.md`,
Track A), and many phones write to one company at once. So the screen must never let anyone
believe something the server hasn't said. Five parts, and every inventory screen answers to all
five:

1. **Every write shows its stamp.** A stock change on screen says where it stands — RECORDED (on
   this phone), SYNCED (on the server), CHECK (needs a decision) — so nobody records it twice
   thinking the first didn't take.
2. **Every number shows its freshness.** A figure served from the phone says when it was true
   ("Offline · showing stock levels as of 10:42"). A figure with no timestamp is read as now.
3. **Pending is never merged into actual.** What this phone has recorded and not sent sits
   *beside* the confirmed figure ("+10 kg waiting"), never added into it — the same rule as usable
   vs incoming stock. The confirmed figure is the one an auditor and another phone can trust.
4. **Conflicts never vanish.** A write the server refuses once it arrives (oversold by then, the
   product gone, a permission removed) waits as CHECK until a person decides. Nothing is discarded
   automatically, and logging out with unsent work asks first.
5. **An offline phone only appends.** Offline you may record stock in, stock out and a count —
   events that add to the ledger and can't overwrite another phone's work. Anything that edits a
   shared record (a product's details, prices, suppliers) waits for a connection and says so;
   forms that create something keep a draft on the phone and submit once online.

**Why it's a trap otherwise.** Each part closes a real way to lose stock: a duplicate delivery
(no stamp), a sale against a figure from yesterday (no freshness), a phone that thinks it has 30
bags because it added its own unsent 10 (merged pending), an oversell that disappears on sync
(vanished conflict), a price edit from a stale screen erasing today's (editing offline).

**Reference implementations:**

| Part | Where |
|---|---|
| Stamps | `components/Stamp.tsx`; the sync centre's receipt lines (`SyncCentre.tsx`) and the "Saved on this phone" receipt (`QueuedReceipt.tsx`) |
| Freshness | `SavedDataNote.tsx` above any list or product served from the device (A2); the sync pill and the sync centre's "up to date as of" for the on-phone catalogue (`useSyncStatus.ts`) |
| Pending beside actual | `StockFigure`'s pending line; `PendingStockNote` on the product page; `usePendingStock` (outbox) |
| Conflicts | The outbox's `needs_attention` state with Send N instead / Try again / Discard (`outboxStore.ts`, `SyncCentre.tsx`); the logout guard (`UserMenu.tsx`); counts reconciled server-side so a late count keeps later sales (decision D1, `StockManagementService.count`) |
| Append-only offline | `submitStockWrite` queues only STOCK_IN / STOCK_OUT / COUNT; edit forms load with `requireFresh` and show the offline error instead of a stale copy; drafts for Record a delivery and New product (`features/drafts/`) |

**The one exception, online only:** Undo (decision D8) voids a write the person made moments ago —
within two minutes, while it is still the product's latest write — as if it had never been made.
It needs the server, refuses with a reason otherwise, and every void is logged. A write still
waiting on the phone is simply never sent.

**Checklist for a new inventory screen or write:**
1. Does a write it makes go through `submitStockWrite` (so it is stamped, queued offline, and sent
   once with its Idempotency-Key)? If it edits a shared record instead, is it online-only, with
   the form loaded `requireFresh`?
2. Is every figure on it either live or labelled with when it was true?
3. Does anything add a pending amount into a confirmed figure? It must sit beside it.
4. Can anything the server refuses disappear without the person deciding?
5. If a form creates something, does it keep a draft on the phone?

**Known instances and gaps:**
- ✅ Product page, Inventory list, sync centre, stock in / out / count, Record a delivery, New
  product.
- Gap (Track C2): movement history doesn't yet show pending writes as RECORDED rows.
- Gap: writes are sent while the app is open; there is no Background Sync once it is closed.
- Gap (A4): a late offline delivery absorbed by a later count still adjusts the supplier's own
  tally.
