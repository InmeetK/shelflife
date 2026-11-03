# ShelfLife: expiry & stock tracker for independent off-licences

> Pre-planned architecture for the Algosoup take-home (1-hour build). Planned ahead of the build window; implementation happens in the logged session.

## 1. Product

**Customer:** independent off-licence owners (1 shop, a few part-time staff).
**Pain:** stock goes past its best-before date on the shelf without anyone noticing (beer, soft drinks, snacks, dairy). That's wasted money and a bad look in front of customers. Today the shop tracks this on paper or not at all.
**Promise:** "Scan it when it arrives, glance at one screen every morning, never sell an out-of-date can again."

**Why it's more than an inventory table**
- Scan a barcode with your phone camera and the product is found instantly. If it's new, the name, brand and image are prefilled from Open Food Facts.
- The home screen shows what's **expired**, what's **expiring soon** and what's **low on stock**. It's built to be read in 5 seconds.
- Each shop's data is isolated, with manager and staff roles enforced in the database, plus a full audit trail of who changed what.

**Design principle:** staff use this on the shop floor, one-handed. Mobile first, big tap targets, and ≤ 3 taps from scan to saved.

## 2. Decisions (from requirements interview)

| Area | Decision |
|---|---|
| Stack | Next.js 16 (App Router, TypeScript, Node 20.9+) + Supabase (Postgres, Auth, RLS) + Vercel |
| UI | Tailwind v4 + shadcn/ui (use the generated `components/ui` files; don't assume Radix imports) |
| Tenancy | Multi-shop data model: all data is scoped by `shop_id` via RLS |
| Accounts | **Seeded only** for the 1-hour build: a demo manager and a demo staff member. Self-serve signup, onboarding and invites are cut for time (see §11) |
| Roles | `manager`, `staff` |
| Stock model | One `quantity` + one `expiry_date` per product |
| Stock changes | **Stock counts** (set the absolute count) and **restocks** (+N with an expiry date) |
| Restock expiry rule | Keep the **earliest** date. Counts can move the date forward (see §5) |
| Scanning | Phone camera in the browser, decoded with the `barcode-detector` ponyfill (ZXing-C++ WASM) |
| Unknown barcode | Prefill from Open Food Facts; staff confirm |
| Dashboard | Expired, expiring soon (window set per shop), low stock, recent changes |

## 3. Architecture

```
Phone / laptop browser
  │  Next.js pages (RSC) + client components (camera scanner)
  ▼
Vercel ── Next.js server
  │   ├─ Server Actions → Supabase RPCs (all stock mutations)
  │   ├─ /api/lookup/[barcode] → Open Food Facts lookup (server-side, cached)
  │   └─ proxy.ts (Next 16's replacement for middleware.ts): refresh Supabase session, route guards
  ▼
Supabase
  ├─ Auth (email + password, new signups DISABLED; users created by seed script)
  ├─ Postgres tables + RLS (shop isolation, role checks)
  └─ RPC functions (atomic mutation + audit event in one transaction)
```

**Key choice:** every write that changes stock goes through a Postgres function (`security definer`). Each function checks membership and role, applies the change, and inserts a `stock_events` row **in the same transaction**. Role rules and audit logging live in one place, and the client can't skip either. Because `security definer` bypasses RLS, each function must do its own `my_shop_id()` / `is_manager()` check and set `search_path`.

Use the `@supabase/ssr` client (server and browser variants) with the **publishable key**. The legacy `anon` / `service_role` keys are being retired, so don't use them.
- `proxy.ts` (export `proxy`, not `middleware`) refreshes the session with `supabase.auth.getClaims()`. Never trust `getSession()` on the server.
- Server Components check identity with `getClaims()`. Server Actions that write call RPCs, and the RPCs enforce auth themselves.
- There's no secret key in the app or in Vercel env vars. Only the local seed script uses it.

### Environment variables
| Variable | Where |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` + Vercel (added by hand, not via the Supabase integration) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`) | `.env.local` + Vercel |
| `SUPABASE_SECRET_KEY` (`sb_secret_…`) | `.env.local` only, used by the seed and test scripts |
| `OFF_CONTACT_EMAIL` | `.env.local` + Vercel, used in the Open Food Facts User-Agent |

## 4. Data model

```
shops
  id uuid pk, name text, expiry_window_days int default 7, created_at

memberships                       -- one shop per user
  user_id uuid pk → auth.users, shop_id → shops,
  role text check in ('manager','staff'), display_name text, created_at

products
  id uuid pk, shop_id, barcode text, name text, brand text null,
  image_url text null, quantity int ≥ 0 default 0,
  min_quantity int ≥ 0 default 0, expiry_date date null,
  created_at, updated_at
  unique (shop_id, barcode)

stock_events                      -- append-only audit log
  id bigserial pk, shop_id, product_id (on delete set null), product_name (snapshot), user_id,
  type text check in ('create','restock','count','edit','delete'),
  qty_before int, qty_after int,
  expiry_before date, expiry_after date, created_at
```

Indexes: `products(shop_id, expiry_date)`, `products(shop_id, barcode)` (from the unique constraint), `stock_events(shop_id, created_at desc)`.

### RLS
- Helpers: `my_shop_id()` and `is_manager()` (SQL, `stable`, read from `memberships` where `user_id = auth.uid()`).
- `select` on all shop tables: `shop_id = my_shop_id()`. Members can read `memberships` rows for their own shop (for display names in the activity feed).
- `products`: no direct insert, update or delete for anyone, because writes go through RPCs. Only managers can delete, via `delete_product`.
- `stock_events`: select only. Inserts happen inside RPCs.
- `shops`: update by manager only (settings), via `update_shop`. `memberships`: no client writes. Rows are created by the seed script.

### RPC contracts
| Function | Who | Behaviour |
|---|---|---|
| `create_product(barcode, name, brand, image_url, quantity, expiry_date, min_quantity)` | staff+ | Inserts the product and a `create` event. If the barcode already exists in the shop, raise a clear error (the UI opens the existing product instead) |
| `restock(product_id, add_qty, expiry_date)` | staff+ | Rejects `add_qty ≤ 0`. `qty += add_qty`. Expiry becomes `incoming` if the old qty was 0 or the old expiry was null, otherwise `least(current, incoming)`. Logs a `restock` event |
| `set_count(product_id, qty, earliest_expiry)` | staff+ | Rejects `qty < 0`. Sets the absolute qty and expiry. If qty = 0, expiry is set to null. Logs a `count` event |
| `update_product(product_id, name, brand, min_quantity)` | manager | Edits details and logs an `edit` event |
| `delete_product(product_id)` | manager | Logs a `delete` event (keeps `product_name`), then deletes; history rows get `product_id = null` |
| `update_shop(name, expiry_window_days)` | manager | Settings page. Window 1–60 days. No stock event |

SQL parameters are prefixed `p_` (e.g. `p_product_id`) to avoid clashing with column names.

## 5. The expiry rule (worth explaining in the README)
With one date per product, the date always means **"the earliest date still on the shelf."**
- **Restock** never pushes the date later. New stock can't hide old stock.
- **Count** is the only way to move the date forward. When staff count the shelf, they confirm the earliest date they can see, and the form is prefilled with the current date. Selling through old stock and then doing a count clears the alert. That's the honest trade-off of one date per product, and the README should say so. Per-batch expiry is the obvious v2.

## 6. Pages

| Route | Access | Contents |
|---|---|---|
| `/login` | public | Email + password, plus two buttons: **Use demo manager** and **Use demo staff** |
| `/` dashboard | member | 4 cards: **Expired** (red), **Expiring within N days** (amber, sorted by date), **Low stock** (qty ≤ min, min > 0), **Recent changes** (manager only, last 20 events with who/what/when). Big **Scan** button fixed at the bottom. Header shows shop name, user's role and sign out |
| `/scan` | member | Camera viewfinder. Known barcode → product sheet with **Restock** / **Count** buttons. Unknown → new-product form prefilled from OFF. Includes an "Enter barcode manually" fallback |
| `/products` | member | Search (name/barcode), filter chips (expired / expiring / low), list |
| `/products/[id]` | member | Details + event history. Manager: edit, set min qty, delete |
| `/settings` | manager | Shop name, expiry window (days) |

Route guards: `proxy.ts` sends no-session requests to `/login`; membership and role checks run in `requireMember()` (server pages/layouts) so the proxy doesn't query the DB on every request. A signed-in user with no membership sees a "This account isn't linked to a shop" message with a sign-out button (it shouldn't happen with signups disabled, but it shouldn't crash either). Staff opening `/settings` are redirected to `/`.

"Today" is calculated in `Europe/London` time so dates don't flip at 11pm UTC.

## 7. Integrations

**Camera scanning:** `getUserMedia` (rear camera, `facingMode: "environment"`) into a `<video playsInline muted>`, with frames decoded by `BarcodeDetector` imported from `barcode-detector/ponyfill`.
- Don't use the native `BarcodeDetector`: it's disabled by default in iOS Safari. Don't use `@zxing/browser` / `@zxing/library` either, because they're in maintenance mode.
- The ponyfill fetches its `.wasm` from jsDelivr at runtime by default. That's acceptable for the demo.
- Formats: `ean_13`, `ean_8`, `upc_a`, `upc_e`. These cover nearly all retail barcodes.
- The camera needs HTTPS, which Vercel provides, so test on a phone **against the deployed URL**. Stop the camera tracks when leaving `/scan`.
- Debounce repeat reads. On a successful read, show a visual flash and call `navigator.vibrate` only if it exists. iOS Safari doesn't support it.
- If camera permission is denied or unavailable, fall back to manual barcode entry.

**Open Food Facts:** server route `GET /api/lookup/[barcode]`
- Validate `^\d{8,14}$`.
- Use the **v3** product endpoint (v2 is deprecated): `https://world.openfoodfacts.org/api/v3/product/{barcode}.json?fields=product_name,brands,image_front_small_url`. **Before writing the parser, `curl` one known barcode and code against the real response shape.**
- `User-Agent: ShelfLife/0.1 (${OFF_CONTACT_EMAIL})`. OFF requires the `AppName/Version (ContactEmail)` form.
- Rate limit: 15 product reads/min per IP. Every lookup comes from Vercel, so users share that budget. Cache successful responses for a day (`fetch(..., { next: { revalidate: 86400 } })`). On HTTP 429/503, return `found: false`.
- 3s timeout. Return `{ found, name, brand, image_url }`. If nothing is found or the call fails, the form stays empty and still works.
- Show "Product data from Open Food Facts" on prefilled forms (ODbL attribution).

## 8. Seed / demo (reviewers will open this on a laptop)
- Local seed script (Node, uses `SUPABASE_SECRET_KEY` from `.env.local` only). It creates auth users with `auth.admin.createUser({ email_confirm: true })`, then shops, memberships, products and events. `email_confirm: true` is required: admin-created users without it can be blocked from signing in. The script is safe to re-run and resets the demo shops to a known state.
- **Demo Off-Licence:** a manager (`manager@shelflife.demo`) and a staff member (`staff@shelflife.demo`), ~25 realistic products (beers, ciders, mixers, crisps, milk). Use real EAN barcodes with **hardcoded** names and brands. The seed never calls Open Food Facts, because of the rate limit. Keep a few real barcodes *out* of the seed so the OFF prefill can be demoed live. Set expiry dates **relative to `current_date`** (some past, some within 7 days, some far out) so the dashboard always looks alive. ~15 historical `stock_events` so the activity feed isn't empty.
- **Second shop** ("Corner Cellar") with its own manager and a few products. It's not shown in the demo. It exists so the cross-shop isolation test has something to try to read.
- Demo credentials go in the README and behind the login buttons.

## 9. Build order (60 min, deploy first)

| Min | Step |
|---|---|
| 0–5 | `create-next-app`, shadcn init, push to GitHub, **Vercel deploy of the empty app** (env vars already set in Vercel) |
| 5–17 | Migration in `supabase/migrations/` via `supabase db push`: tables, RLS, helpers, RPCs. Seed script (users + both shops). `supabase gen types typescript --linked`. Test script for the expiry rule, cross-shop isolation and staff-vs-manager RPC access |
| 17–23 | Supabase SSR clients, `proxy.ts`, `/login` with demo buttons |
| 23–38 | `/scan`: camera + `barcode-detector`, lookup, product sheet (restock/count), new-product form + OFF route (curl OFF first) |
| 38–48 | Dashboard cards + `/products` list/search |
| 48–53 | `/products/[id]` history + manager edit/delete, `/settings` |
| 53–60 | Deploy, phone smoke test (scan → create → restock → count → dashboard updates), README with demo creds, the expiry-rule note and the scope decisions |

**Cut list if behind (in order):** `/settings` (hardcode 7 days) → product detail history → recent-changes card → `/products` search and filters (keep a plain list). **Never cut:** scan + expiry dashboard + roles enforced in the DB + deployed demo login.

## 11. Scope decisions & v2 (for the README / follow-up conversation)
**Cut for the 1-hour build:** self-serve signup, shop onboarding and invite links. The data model already supports them (`shops` + `memberships` with roles). v1 adds an `invites` table plus `create_shop` and `accept_invite` RPCs, with no changes to existing tables.

**v2 ideas:** per-batch expiry · "Reduce to clear" suggestions and a waste-£ report (needs a cost price) · morning email/WhatsApp digest of expiring items · supplier reorder drafts from low stock · multi-shop owners · offline scanning in the stockroom (PWA + sync).
