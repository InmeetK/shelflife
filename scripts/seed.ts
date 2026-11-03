// Re-runnable demo seed. Local only: uses SUPABASE_SECRET_KEY from .env.local.
// Resets both demo shops (delete by fixed id → cascade) and recreates them.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database";
import { addDays, londonToday } from "../lib/dates";
import { CELLAR_SHOP_ID, DEMO_PASSWORD, DEMO_SHOP_ID, DEMO_USERS } from "../lib/demo";
import { CELLAR_PRODUCTS, DEMO_PRODUCTS, type SeedProduct } from "./seed-data";

process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.local");

const db = createClient<Database>(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const today = londonToday();

function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data as T;
}

async function ensureUser(email: string): Promise<string> {
  const { data, error } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`listUsers: ${error.message}`);
  const existing = data.users.find((u) => u.email === email);
  const res = existing
    ? await db.auth.admin.updateUserById(existing.id, { password: DEMO_PASSWORD, email_confirm: true })
    : await db.auth.admin.createUser({ email, password: DEMO_PASSWORD, email_confirm: true });
  if (res.error) throw new Error(`${existing ? "reset" : "create"} ${email}: ${res.error.message}`);
  return res.data.user.id;
}

async function insertProducts(shopId: string, products: SeedProduct[]) {
  const rows = products.map((p) => ({
    shop_id: shopId,
    barcode: p.barcode,
    name: p.name,
    brand: p.brand,
    quantity: p.quantity,
    min_quantity: p.min,
    expiry_date: p.quantity === 0 || p.expires === null ? null : addDays(today, p.expires),
  }));
  return must(await db.from("products").insert(rows).select("*"), `products for ${shopId}`);
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

async function main() {
  const ids = {
    manager: await ensureUser(DEMO_USERS.manager.email),
    staff: await ensureUser(DEMO_USERS.staff.email),
    cellar: await ensureUser(DEMO_USERS.cellar.email),
  };

  must(await db.from("shops").delete().in("id", [DEMO_SHOP_ID, CELLAR_SHOP_ID]), "reset shops");
  // Users could be linked to another shop from an older run; memberships PK is user_id.
  must(await db.from("memberships").delete().in("user_id", Object.values(ids)), "reset memberships");

  must(
    await db.from("shops").insert([
      { id: DEMO_SHOP_ID, name: "Demo Off-Licence", expiry_window_days: 7 },
      { id: CELLAR_SHOP_ID, name: "Corner Cellar", expiry_window_days: 7 },
    ]),
    "shops",
  );
  must(
    await db.from("memberships").insert([
      { user_id: ids.manager, shop_id: DEMO_SHOP_ID, role: "manager", display_name: DEMO_USERS.manager.name },
      { user_id: ids.staff, shop_id: DEMO_SHOP_ID, role: "staff", display_name: DEMO_USERS.staff.name },
      { user_id: ids.cellar, shop_id: CELLAR_SHOP_ID, role: "manager", display_name: DEMO_USERS.cellar.name },
    ]),
    "memberships",
  );

  const demo = await insertProducts(DEMO_SHOP_ID, DEMO_PRODUCTS);
  const cellar = await insertProducts(CELLAR_SHOP_ID, CELLAR_PRODUCTS);

  // ~15 back-dated events that end at each product's current state.
  type EventRow = Database["public"]["Tables"]["stock_events"]["Insert"];
  const events: EventRow[] = [];
  demo.slice(0, 15).forEach((p, i) => {
    const who = i % 3 === 0 ? ids.manager : ids.staff;
    const base = { shop_id: DEMO_SHOP_ID, product_id: p.id, product_name: p.name, user_id: who, created_at: hoursAgo(3 + i * 9) };
    if (i % 2 === 0) {
      const added = Math.max(1, Math.min(6, p.quantity));
      events.push({ ...base, type: "restock", qty_before: p.quantity - added, qty_after: p.quantity,
        expiry_before: p.expiry_date, expiry_after: p.expiry_date });
    } else {
      events.push({ ...base, type: "count", qty_before: p.quantity + 2, qty_after: p.quantity,
        expiry_before: p.expiry_date, expiry_after: p.expiry_date });
    }
  });
  for (const p of cellar) {
    events.push({ shop_id: CELLAR_SHOP_ID, product_id: p.id, product_name: p.name, user_id: ids.cellar,
      type: "create", qty_before: null, qty_after: p.quantity, expiry_before: null, expiry_after: p.expiry_date,
      created_at: hoursAgo(200) });
  }
  must(await db.from("stock_events").insert(events), "stock_events");

  console.log(`Seeded: ${demo.length} demo products, ${cellar.length} Corner Cellar products, ${events.length} events (today ${today}).`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
