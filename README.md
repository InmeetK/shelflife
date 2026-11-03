# ShelfLife

**Expiry & stock tracker for independent UK off-licences.** Staff scan a barcode with their phone, restock or count the shelf, and the dashboard shows what has expired, what is about to, and what is running low.

**Live demo:** https://shelflife-lyart.vercel.app

| Demo login | Email | Password |
|---|---|---|
| Manager (sees Recent changes) | `manager@shelflife.demo` | `shelflife-demo` |
| Staff | `staff@shelflife.demo` | `shelflife-demo` |

The login page has **Use demo manager** / **Use demo staff** buttons. The demo is public, so data can change. `npm run seed` resets it.

## Who it's for
Owners and staff of small shops with a few hundred lines of beer, cider, mixers, snacks and milk. They have no stock system, and short-dated stock quietly loses them money.

## Core flow
1. **Scan** (phone camera, or type the barcode). The camera and manual entry go through the same handler.
2. **Known product:** a sheet with stock and earliest date, and two actions:
   - **Restock** (+N, with the new stock's date)
   - **Count** (set the absolute quantity and the earliest date you can see)
3. **Unknown product:** a new-product form, prefilled from Open Food Facts when it knows the barcode (with attribution). Staff confirm and save.
4. **Dashboard:**
   - **Expired** (red)
   - **Expiring within 7 days** (amber)
   - **Low stock** (qty ≤ min)
   - **Recent changes:** who did what, managers only
5. **Products:** search by name or barcode, and filter chips (expired / expiring / low).

## The expiry rule (the main trade-off)
Each product has **one quantity and one date**, and the date always means *"the earliest date still on the shelf"*.
- **Restock never pushes the date later.** New stock can't hide old stock: the date becomes `least(current, incoming)`. If the shelf was empty, or had no date, the incoming date is taken.
- **Count is the only way to move the date forward.** Staff count the shelf and confirm the earliest date they can see. The form is prefilled with the current date.
- **The honest cost:** after selling through old stock, the alert stays until someone does a count. That's the price of one date per product. Per-batch expiry is the obvious v2.
- "Today" is London time, so dates don't flip at 11pm UTC in summer. The best-before day itself counts as *expiring*, not *expired*.

## How it's built
- **Next.js 16** (App Router, `proxy.ts`), **Supabase** (Postgres, Auth, RLS), **Vercel**, **Tailwind v4 + shadcn/ui** (Base UI).
- **Every stock write is a Postgres function** (`security definer`). It checks the caller's shop and role, applies the change, and writes one `stock_events` audit row **in the same transaction**. Role rules and logging live in one place the client can't skip.
- **Postgres functions:**
  - `create_product`, `restock`, `set_count` for staff and managers.
  - `update_product`, `delete_product`, `update_shop` for managers only. They're tested, but they have no UI yet (see scope).
- **RLS:** members can only `select` their own shop's rows. No table accepts client inserts, updates or deletes.
- **Barcode scanning:** `barcode-detector` ponyfill (ZXing WASM). Native `BarcodeDetector` is off in iOS Safari, so it can't be relied on.
- **Open Food Facts:** the v3 API, called server-side through `/api/lookup/[barcode]`. It's signed-in only, has a 3s timeout and a 1-day cache, and degrades to an empty form on 404, 429 or 503.
- **Accounts:** seeded only. The publishable key is used in the app. The secret key lives only in the local seed and test scripts, never in Vercel.

## Tests
- `npm run check`: typegen, `tsc`, `eslint`, and Vitest (51 tests).
  - **DB tests** run against the linked Supabase project, signed in as the seeded users. They cover the restock and count rules, exactly one audit event per change, staff vs manager permissions, no direct table writes, and isolation from a second shop (Corner Cellar).
  - **Unit tests** cover London "today" across the 23:00 UTC boundary, expiry status, and the Open Food Facts parser (run against real responses).
  - DB tests reseed before and after.
- `npm run e2e`: Playwright on an iPhone 13 viewport. It covers login → dashboard, scan → restock → dashboard updates, unknown barcode → create → listed, manager-only Recent changes, and search and filters. It passes locally and against the Vercel URL.
- The camera was tested by hand on a phone against the deployed URL.

## Scope decisions (60-minute build)
**Cut**, from the spec's cut list, in order:
- **`/settings`**: the expiry window stays at 7 days. The tested `update_shop` RPC is ready for it.
- **Product detail page:** event history and the manager's edit, minimum quantity and delete. The `update_product` and `delete_product` RPCs exist and are tested; there's no UI yet. Managers see history in Recent changes.

**Out of scope for v1:**
- Self-serve signup, shop onboarding and invites.
- The data model already supports these through `shops` + `memberships` with roles. They'd need an `invites` table plus `create_shop` and `accept_invite` RPCs, with no changes to existing tables.

**Changes from the original spec:**
- `delete_product` and `update_shop` are RPCs, not direct table policies.
- `stock_events` keeps a `product_name` snapshot so history survives a delete.
- Membership and role checks run in `requireMember()` in server pages, not in `proxy.ts`, so the proxy doesn't hit the DB on every request.

## v2 ideas
- Per-batch expiry dates (several dates per product, oldest first).
- The product detail page and `/settings` (the backend is already there).
- Invites and multi-staff onboarding; a daily "what's expiring" summary.
- Markdown suggestions for near-date stock.
- Batch counting mode, and offline scanning with a sync queue.

## Run locally
Needs Node 22+, the Supabase CLI (linked to a project), and a `.env.local` with:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=        # local only: seed + tests
OFF_CONTACT_EMAIL=          # Open Food Facts User-Agent contact
```
```bash
npm install
npm run db:push     # apply migrations to the linked project
npm run seed        # demo users, 2 shops, 25 products, history
npm run dev         # http://localhost:3000
npm run check       # types + lint + unit/DB tests
npm run e2e         # Playwright (reseeds first)
```
Product data from [Open Food Facts](https://world.openfoodfacts.org) (ODbL).
