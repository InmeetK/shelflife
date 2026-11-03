import Link from "next/link";
import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { ScanBar } from "@/components/scan-bar";
import { Input } from "@/components/ui/input";
import { requireMember } from "@/lib/auth";
import { londonToday } from "@/lib/dates";
import { expiryLabel, expiryStatus } from "@/lib/expiry";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Products · ShelfLife" };

const FILTERS = { expired: "Expired", expiring: "Expiring", low: "Low stock" } as const;
type Filter = keyof typeof FILTERS;
const tone = { expired: "text-red-700", expiring: "text-amber-700", ok: "text-muted-foreground", none: "text-muted-foreground" };

export default async function ProductsPage(props: PageProps<"/products">) {
  const me = await requireMember();
  const sp = await props.searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 80);
  const filter = typeof sp.filter === "string" && sp.filter in FILTERS ? (sp.filter as Filter) : null;
  const today = londonToday();
  const window = me.shop.windowDays;

  let query = me.supabase.from("products").select("id, name, brand, barcode, quantity, min_quantity, expiry_date").order("name");
  if (/^\d{8,14}$/.test(q)) query = query.eq("barcode", q);
  else if (q) query = query.ilike("name", `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  const { data, error } = await query;

  const status = (p: { quantity: number; expiry_date: string | null }) =>
    p.quantity > 0 ? expiryStatus(p.expiry_date, today, window) : "none";
  const products = (data ?? []).filter((p) =>
    filter === "low" ? p.min_quantity > 0 && p.quantity <= p.min_quantity : filter ? status(p) === filter : true);

  const href = (f: Filter | null) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (f) params.set("filter", f);
    const s = params.toString();
    return s ? `/products?${s}` : "/products";
  };

  return (
    <>
      <AppHeader shopName={me.shop.name} role={me.role} displayName={me.displayName} active="/products" />
      <main className="mx-auto max-w-md space-y-3 px-4 pt-4 pb-28">
        {/* key: reset the uncontrolled input when q changes (e.g. Clear) */}
        <form key={q} action="/products" className="flex gap-2" role="search">
          {filter && <input type="hidden" name="filter" value={filter} />}
          <Input name="q" type="search" defaultValue={q} aria-label="Search products"
            placeholder="Search name or barcode" className="h-12 flex-1 text-base" />
        </form>
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(FILTERS) as Filter[]).map((f) => (
            <Link key={f} href={href(filter === f ? null : f)} aria-current={filter === f ? "true" : undefined}
              className={cn("flex h-11 items-center rounded-full border px-4 text-sm font-medium",
                filter === f ? "border-foreground bg-foreground text-background" : "bg-background")}>
              {FILTERS[f]}
            </Link>
          ))}
          {(q || filter) && (
            <Link href="/products" className="flex h-11 items-center px-2 text-sm text-muted-foreground underline">Clear</Link>
          )}
        </div>

        {error && <p role="alert" className="text-sm text-destructive">Couldn&apos;t load products. Please try again.</p>}
        <p className="text-sm text-muted-foreground">{products.length} product{products.length === 1 ? "" : "s"}</p>
        {products.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
            {q || filter ? "No products match. Try another search or clear the filter." : "No products yet. Scan one to add it."}
          </p>
        ) : (
          <ul aria-label="Products" className="divide-y rounded-xl border">
            {products.map((p) => {
              const s = status(p);
              const low = p.min_quantity > 0 && p.quantity <= p.min_quantity;
              return (
                <li key={p.id}>
                  <div className="flex min-h-14 items-center gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{p.name}</span>
                      <span className={cn("block text-sm", tone[s])}>
                        {p.quantity > 0 ? expiryLabel(p.expiry_date, today) : "Out of stock"}
                      </span>
                    </span>
                    <span className={cn("text-right text-sm tabular-nums", low ? "font-semibold text-amber-700" : "text-muted-foreground")}>
                      {p.quantity}
                      {low && <span className="block text-xs font-normal">low</span>}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <ScanBar />
    </>
  );
}
