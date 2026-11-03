import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database";
import { DEMO_PASSWORD, DEMO_USERS } from "@/lib/demo";
import { addDays, londonToday } from "@/lib/dates";

export type Client = SupabaseClient<Database>;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

/** Signed-in client using the publishable key, exactly like the app. */
export async function signIn(who: keyof typeof DEMO_USERS): Promise<Client> {
  const client = createClient<Database>(url, publishable, opts);
  const { error } = await client.auth.signInWithPassword({
    email: DEMO_USERS[who].email,
    password: DEMO_PASSWORD,
  });
  if (error) throw new Error(`sign-in as ${who} failed: ${error.message}`);
  return client;
}

export function anonClient(): Client {
  return createClient<Database>(url, publishable, opts);
}

/** Secret-key client: tests only, for reading state RLS would hide. */
export function adminClient(): Client {
  return createClient<Database>(url, process.env.SUPABASE_SECRET_KEY!, opts);
}

export const today = () => londonToday();
export const day = (n: number) => addDays(londonToday(), n);

let counter = 0;
/** Unique, valid 13-digit test barcode (prefix 20 = in-store range, never real). */
export function testBarcode(): string {
  counter += 1;
  const tail = `${Date.now() % 1e8}`.padStart(8, "0") + `${counter % 1000}`.padStart(3, "0");
  return `20${tail}`;
}

/** Events for a product, oldest first. Read via the admin client so it works after delete. */
export async function eventsFor(productId: string) {
  const { data, error } = await adminClient()
    .from("stock_events")
    .select("*")
    .eq("product_id", productId)
    .order("id");
  if (error) throw error;
  return data;
}
