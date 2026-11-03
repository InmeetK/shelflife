import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "manager" | "staff";

/**
 * Server-side guard for member pages. No session → /login, no membership →
 * /no-shop, staff on a manager page → /. Identity comes from getClaims().
 */
export async function requireMember(opts: { manager?: boolean } = {}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: m } = await supabase
    .from("memberships")
    .select("role, display_name, shop_id, shops(name, expiry_window_days)")
    .eq("user_id", userId)
    .maybeSingle();
  if (!m?.shops) redirect("/no-shop");

  const role = m.role as Role;
  if (opts.manager && role !== "manager") redirect("/");

  return {
    supabase,
    userId,
    role,
    displayName: m.display_name,
    shop: { id: m.shop_id, name: m.shops.name, windowDays: m.shops.expiry_window_days },
  };
}
