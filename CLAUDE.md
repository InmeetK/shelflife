# CLAUDE.md: ShelfLife build rules

SPEC.md is the source of truth for **what** to build. This file is **how** to build it. If they conflict, or the spec looks wrong, stop and ask. Never edit SPEC.md without saying so.

This is a timed 60-minute build. Work in the slices from SPEC.md §9 and protect the never-cut list (scan → expiry dashboard → roles in the DB → deployed demo login).

## Current tooling (follow over habit)
- Next.js 16: `proxy.ts` exporting `proxy`, not `middleware.ts`. It runs on Node.
- Supabase: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the app. `SUPABASE_SECRET_KEY` only in `scripts/` and tests. Never use the legacy `anon` / `service_role` keys.
- `@supabase/ssr`: `getClaims()` on the server. Never trust `getSession()` server-side.
- Scanning: `barcode-detector/ponyfill` + `getUserMedia`. Don't use native `BarcodeDetector` or `@zxing/*`.
- shadcn: use the generated `components/ui` files. Check the imports there; don't assume Radix.
- Open Food Facts: v3 endpoint. `curl` a real barcode before writing the parser. See SPEC.md §7 for User-Agent, caching and rate limits.

## Commands
| Command | Does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run check` | `tsc --noEmit` + `next lint` + `vitest run` (unit + DB tests) |
| `npm run e2e` | Playwright against `BASE_URL` (default `http://localhost:3000`) |
| `npm run seed` | Re-runnable seed. Resets both demo shops |
| `npm run db:push` | `supabase db push` |
| `npm run db:types` | `supabase gen types typescript --linked > lib/database.types.ts` |

Set these scripts up in the first slice.

## Test-driven where it pays off
Write the failing test **first**, show it failing, then implement:
- **RPCs and RLS** (`tests/db/*.test.ts`, Vitest + supabase-js, signed in as the seeded users against the linked project):
  - `restock`: adds to qty, keeps the earliest date, takes the incoming date when qty was 0 or the expiry was null, rejects `add_qty ≤ 0`
  - `set_count`: absolute qty, null expiry at qty 0, rejects negatives
  - Every RPC writes exactly one `stock_events` row with the correct before/after values
  - Staff calling `update_product` or deleting a product → error
  - Corner Cellar's manager can't select or mutate Demo Off-Licence rows
- **Pure helpers** (`tests/unit/*.test.ts`): London "today" across the 23:00–00:00 UTC boundary, expiry status (expired / expiring / ok), the OFF response parser (found, not found, missing fields).

Don't write TDD-style tests for UI components. Playwright covers the UI.

DB tests mutate the linked project. Run `npm run seed` after them so the demo is clean.

## Verifying the frontend (Playwright)
Use `@playwright/test` (Chromium is installed already; don't reinstall it) with the **iPhone 13 device profile (390×844)** by default.
- **Smoke spec** (`e2e/core-flow.spec.ts`), the one that must stay green:
  1. Demo staff login → dashboard shows the Expired / Expiring / Low stock cards
  2. Manual barcode entry of a seeded product → Restock +6 → dashboard reflects it
  3. Manual entry of an unknown barcode → new-product form → save → appears in `/products`
  4. Staff can't reach `/settings`. Demo manager can, and sees Recent changes
- **The camera can't be tested headlessly.** The scanner must pass decoded barcodes into **the same handler** as manual entry, so the e2e test covers everything after decoding. Test camera decoding by hand on a phone against the deployed URL.
- **Look at what you build.** After each UI slice, take full-page screenshots at 390×844 (`e2e/screenshots/`, gitignored), open them with Read and check:
  - Layout, overflow, tap targets ≥ 44px, text legibility
  - Empty states, error states and loading states
  - Red/amber status colours are visible
  
  Say what you checked and fix anything wrong before reporting done.
- After deploying, run `BASE_URL=<vercel url> npm run e2e`.

## Slice workflow
For each slice:
1. State in 1–2 lines what you'll do and which tests prove it.
2. Write tests first where the TDD section applies.
3. Implement the smallest thing that passes.
4. Run `npm run check` (and `npm run e2e` once UI exists). **Paste the real output summary.** Never say "should work".
5. Screenshot and review any UI you touched.
6. Commit: `feat(scan): restock and count sheet`.
7. Report in ≤ 5 lines: done, verified how, not verified, risks. Then wait for my go-ahead.

If the same failure happens twice, stop and explain your hypothesis instead of trying a third variation.

## Code rules
- Keep it simple. No abstractions for one call site, no state libraries, no ORM (supabase-js + generated types).
- Server Components read data. Server Actions call RPCs. Clients never write to tables directly.
- Validate inputs at the boundary (Server Action / route handler) and return friendly errors, not stack traces.
- Dates: store `date` (no time). Compute "today" in `Europe/London` in one helper and use it everywhere.
- Mobile first: one column, bottom-fixed primary action, big inputs, `inputMode="numeric"` for quantities and barcodes.

## Database rules
- Migrations live in `supabase/migrations/`. **Never edit a migration that has been pushed.** Add a new one.
- Every table has RLS enabled in the same migration that creates it.
- Every `security definer` function: `set search_path = public`, checks `my_shop_id()` / `is_manager()` first, `raise exception` with a clear message on failure.
- Regenerate types after every schema change.

## Guardrails
- **No new dependencies without asking.** Pre-approved: `@supabase/supabase-js`, `@supabase/ssr`, `barcode-detector`, `vitest`, `@playwright/test`, `tsx`, and shadcn components.
- Never print, log or commit secrets. `.env*` stays gitignored. Check before the first commit.
- Never weaken, skip or delete a test to make it pass without telling me why.
- Don't add features that aren't in SPEC.md. Suggest them in your slice report instead.
- If a slice is running long, say so and propose the next item on the cut list.

## Before calling the build done
- `npm run check` and `npm run e2e` green locally **and** e2e green against the Vercel URL
- `npm run seed` re-run so the demo is clean
- README: what it is, who it's for, demo logins, core flow, the expiry-rule trade-off, scope decisions, v2 ideas, how to run locally
- A fresh-eyes review of the full diff by a subagent: report bugs and edge cases, don't fix. I decide what to act on.
