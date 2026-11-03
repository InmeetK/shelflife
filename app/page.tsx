import { AppHeader } from "@/components/app-header";
import { RecentChanges } from "@/components/recent-changes";
import { ScanBar } from "@/components/scan-bar";
import { StatusCard } from "@/components/status-card";
import { requireMember } from "@/lib/auth";
import { londonToday } from "@/lib/dates";
import { expiryLabel, expiryStatus } from "@/lib/expiry";

export default async function DashboardPage() {
  const me = await requireMember();
  const today = londonToday();
  const window = me.shop.windowDays;

  const isManager = me.role === "manager";
  const [{ data: products, error }, recent, members] = await Promise.all([
    me.supabase
      .from("products")
      .select("id, name, quantity, min_quantity, expiry_date")
      .order("expiry_date", { ascending: true, nullsFirst: false })
      .order("name"),
    isManager
      ? me.supabase.from("stock_events")
          .select("id, type, product_id, product_name, user_id, qty_before, qty_after, expiry_before, expiry_after, created_at")
          .order("created_at", { ascending: false }).limit(20)
      : null,
    isManager ? me.supabase.from("memberships").select("user_id, display_name") : null,
  ]);
  const names = new Map((members?.data ?? []).map((m) => [m.user_id, m.display_name]));

  // Expiry cards only count stock that's actually on the shelf.
  const onShelf = (products ?? []).filter((p) => p.quantity > 0);
  const byStatus = (s: "expired" | "expiring") =>
    onShelf
      .filter((p) => expiryStatus(p.expiry_date, today, window) === s)
      .map((p) => ({ id: p.id, name: p.name, detail: `${expiryLabel(p.expiry_date, today)} · ${p.quantity} on shelf` }));
  const low = (products ?? [])
    .filter((p) => p.min_quantity > 0 && p.quantity <= p.min_quantity)
    .sort((a, b) => a.quantity - b.quantity)
    .map((p) => ({ id: p.id, name: p.name, detail: `${p.quantity} left · min ${p.min_quantity}` }));

  return (
    <>
      <AppHeader shopName={me.shop.name} role={me.role} displayName={me.displayName} active="/" />
      <main className="mx-auto max-w-md space-y-4 px-4 pt-4 pb-28">
        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Couldn&apos;t load stock. Pull to refresh or try again.
          </p>
        )}
        <StatusCard title="Expired" tone="red" items={byStatus("expired")} empty="Nothing past its date. 🎉" />
        <StatusCard title={`Expiring within ${window} days`} tone="amber" items={byStatus("expiring")}
          empty={`Nothing expires in the next ${window} days.`} />
        <StatusCard title="Low stock" tone="neutral" items={low} empty="Nothing below its minimum." />
        {isManager && <RecentChanges events={recent?.data ?? []} names={names} />}
      </main>
      <ScanBar />
    </>
  );
}
