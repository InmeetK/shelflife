import Link from "next/link";
import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { ScanBar } from "@/components/scan-bar";
import { requireMember } from "@/lib/auth";
import { londonToday } from "@/lib/dates";
import { expiryLabel, expiryStatus } from "@/lib/expiry";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Products · ShelfLife" };

const tone = { expired: "text-red-700", expiring: "text-amber-700", ok: "text-muted-foreground", none: "text-muted-foreground" };

export default async function ProductsPage() {
  const me = await requireMember();
  const today = londonToday();
  const { data: products, error } = await me.supabase
    .from("products").select("id, name, brand, quantity, min_quantity, expiry_date").order("name");

  return (
    <>
      <AppHeader shopName={me.shop.name} role={me.role} displayName={me.displayName} />
      <main className="mx-auto max-w-md px-4 pt-4 pb-28">
        <h2 className="mb-2 text-lg font-semibold">Products ({products?.length ?? 0})</h2>
        {error && <p role="alert" className="text-sm text-destructive">Couldn&apos;t load products.</p>}
        {products?.length === 0 && <p className="text-muted-foreground">No products yet. Scan one to add it.</p>}
        <ul className="divide-y rounded-xl border">
          {products?.map((p) => {
            const status = p.quantity > 0 ? expiryStatus(p.expiry_date, today, me.shop.windowDays) : "none";
            return (
              <li key={p.id}>
                <Link href={`/products/${p.id}`} className="flex min-h-14 items-center gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className={cn("block text-sm", tone[status])}>
                      {p.quantity > 0 ? expiryLabel(p.expiry_date, today) : "Out of stock"}
                    </span>
                  </span>
                  <span className={cn("text-right text-sm tabular-nums",
                    p.min_quantity > 0 && p.quantity <= p.min_quantity ? "font-semibold text-amber-700" : "text-muted-foreground")}>
                    {p.quantity}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </main>
      <ScanBar />
    </>
  );
}
