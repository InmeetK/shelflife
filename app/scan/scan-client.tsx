"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { Scanner } from "@/components/scanner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/dates";
import { expiryLabel, expiryStatus } from "@/lib/expiry";
import type { OffResult } from "@/lib/off";
import { cn } from "@/lib/utils";
import { countProduct, createProduct, findByBarcode, restockProduct, type Product } from "./actions";

type View =
  | { kind: "idle" }
  | { kind: "loading"; code: string }
  | { kind: "product"; product: Product; panel: "restock" | "count" | null }
  | { kind: "new"; barcode: string; prefill: OffResult | null };

const big = "h-12 text-base";
const statusTone = { expired: "text-red-700", expiring: "text-amber-700", ok: "text-muted-foreground", none: "text-muted-foreground" };

function intField(form: FormData, name: string): number {
  const raw = String(form.get(name) ?? "").trim();
  return /^\d+$/.test(raw) ? Number(raw) : NaN;
}
const dateField = (form: FormData, name: string) => String(form.get(name) ?? "").trim() || null;

export function ScanClient({ today, windowDays }: { today: string; windowDays: number }) {
  const [view, setView] = useState<View>({ kind: "idle" });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // The single entry point for both camera decodes and manual entry.
  async function handleBarcode(raw: string) {
    const code = raw.trim();
    setError(null);
    if (!/^\d{8,14}$/.test(code)) {
      setError("Barcode must be 8 to 14 digits.");
      return;
    }
    setView({ kind: "loading", code });
    const res = await findByBarcode(code);
    if ("error" in res) {
      setError(res.error);
      setView({ kind: "idle" });
    } else if (res.product) {
      setView({ kind: "product", product: res.product, panel: null });
    } else {
      setView({ kind: "new", barcode: code, prefill: null });
      const prefill: OffResult = await fetch(`/api/lookup/${code}`)
        .then((r) => (r.ok ? r.json() : { found: false, name: null, brand: null, image_url: null }))
        .catch(() => ({ found: false, name: null, brand: null, image_url: null }));
      setView((v) => (v.kind === "new" && v.barcode === code ? { ...v, prefill } : v));
    }
  }

  function run(action: () => Promise<{ product?: Product; error?: string }>, success: (p: Product) => string) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (res.error || !res.product) {
        setError(res.error ?? "Something went wrong.");
        return;
      }
      toast.success(success(res.product));
      setView({ kind: "product", product: res.product, panel: null });
    });
  }

  const scanning = view.kind === "idle" || view.kind === "loading";

  return (
    <div className="space-y-4">
      {/* Kept mounted so the camera doesn't restart between products. */}
      <div className={cn(!scanning && "hidden")}>
        <Scanner paused={!scanning || view.kind === "loading"} onDetected={handleBarcode} />
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      {scanning && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleBarcode(String(new FormData(e.currentTarget).get("barcode") ?? ""));
          }}
        >
          <Label htmlFor="manual-barcode">Barcode</Label>
          <div className="flex gap-2">
            <Input id="manual-barcode" name="barcode" inputMode="numeric" autoComplete="off" pattern="\d{8,14}"
              placeholder="Enter barcode manually" className={cn(big, "flex-1")} />
            <Button type="submit" disabled={view.kind === "loading"} className={cn(big, "px-5")}>
              {view.kind === "loading" ? "Looking…" : "Look up"}
            </Button>
          </div>
        </form>
      )}

      {view.kind === "product" && (
        <ProductSheet
          product={view.product}
          panel={view.panel}
          today={today}
          windowDays={windowDays}
          pending={pending}
          setPanel={(panel) => { setError(null); setView({ ...view, panel }); }}
          onRestock={(qty, expiry) =>
            run(() => restockProduct(view.product.id, qty, expiry), (p) => `Restocked +${qty} · ${p.quantity} on shelf`)}
          onCount={(qty, expiry) =>
            run(() => countProduct(view.product.id, qty, expiry), (p) => `Count saved · ${p.quantity} on shelf`)}
          onDone={() => { setError(null); setView({ kind: "idle" }); }}
        />
      )}

      {view.kind === "new" && (
        view.prefill === null ? (
          <p className="py-8 text-center text-muted-foreground" aria-live="polite">Checking Open Food Facts…</p>
        ) : (
          <NewProductForm
            barcode={view.barcode}
            prefill={view.prefill}
            pending={pending}
            onCancel={() => { setError(null); setView({ kind: "idle" }); }}
            onSave={(input) => run(() => createProduct(input), (p) => `Added ${p.name}`)}
          />
        )
      )}
    </div>
  );
}

function ProductSheet({ product: p, panel, today, windowDays, pending, setPanel, onRestock, onCount, onDone }: {
  product: Product; panel: "restock" | "count" | null; today: string; windowDays: number; pending: boolean;
  setPanel: (p: "restock" | "count" | null) => void;
  onRestock: (qty: number, expiry: string | null) => void;
  onCount: (qty: number, expiry: string | null) => void;
  onDone: () => void;
}) {
  const status = expiryStatus(p.expiry_date, today, windowDays);

  function submit(e: FormEvent<HTMLFormElement>, kind: "restock" | "count") {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const qty = intField(form, "qty");
    const expiry = dateField(form, "expiry");
    if (kind === "restock") onRestock(qty, expiry);
    else onCount(qty, expiry);
  }

  return (
    <section className="space-y-4 rounded-xl border p-4">
      <div className="flex gap-3">
        {p.image_url && (
          // eslint-disable-next-line @next/next/no-img-element -- OFF thumbnail, any host size
          <img src={p.image_url} alt="" className="size-16 shrink-0 rounded-md bg-muted object-contain" />
        )}
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-tight">{p.name}</h2>
          <p className="text-sm text-muted-foreground">{[p.brand, p.barcode].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-muted p-3">
          <dt className="text-muted-foreground">Stock</dt>
          <dd className="text-base font-semibold">{p.quantity} on shelf</dd>
          {p.min_quantity > 0 && <dd className="text-xs text-muted-foreground">min {p.min_quantity}</dd>}
        </div>
        <div className="rounded-lg bg-muted p-3">
          <dt className="text-muted-foreground">Earliest date</dt>
          <dd className={cn("text-base font-semibold", statusTone[status])}>{p.expiry_date ? formatDate(p.expiry_date) : "—"}</dd>
          <dd className={cn("text-xs", statusTone[status])}>{expiryLabel(p.expiry_date, today)}</dd>
        </div>
      </dl>

      {panel === null && (
        <div className="grid grid-cols-2 gap-2">
          <Button className={big} onClick={() => setPanel("restock")}>Restock</Button>
          <Button variant="secondary" className={big} onClick={() => setPanel("count")}>Count</Button>
        </div>
      )}

      {panel === "restock" && (
        <form className="space-y-3" onSubmit={(e) => submit(e, "restock")}>
          <h3 className="font-semibold">Restock</h3>
          <div className="space-y-1.5">
            <Label htmlFor="restock-qty">Quantity to add</Label>
            <Input id="restock-qty" name="qty" inputMode="numeric" pattern="\d*" required autoFocus className={big} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="restock-expiry">Expiry date on new stock</Label>
            <Input id="restock-expiry" name="expiry" type="date" className={big} />
            <p className="text-xs text-muted-foreground">The earliest date is kept: new stock never hides old stock.</p>
          </div>
          <FormButtons pending={pending} label="Save restock" onCancel={() => setPanel(null)} />
        </form>
      )}

      {panel === "count" && (
        <form className="space-y-3" onSubmit={(e) => submit(e, "count")}>
          <h3 className="font-semibold">Count the shelf</h3>
          <div className="space-y-1.5">
            <Label htmlFor="count-qty">Quantity on shelf</Label>
            <Input id="count-qty" name="qty" inputMode="numeric" pattern="\d*" required autoFocus
              defaultValue={p.quantity} className={big} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="count-expiry">Earliest date you can see</Label>
            <Input id="count-expiry" name="expiry" type="date" defaultValue={p.expiry_date ?? ""} className={big} />
          </div>
          <FormButtons pending={pending} label="Save count" onCancel={() => setPanel(null)} />
        </form>
      )}

      <div className="grid grid-cols-2 gap-2 border-t pt-3">
        <Button variant="outline" className={big} onClick={onDone}>Scan another</Button>
        <Link href="/" className={cn(buttonVariants({ variant: "outline" }), big)}>Dashboard</Link>
      </div>
    </section>
  );
}

function NewProductForm({ barcode, prefill, pending, onCancel, onSave }: {
  barcode: string; prefill: OffResult; pending: boolean; onCancel: () => void;
  onSave: (input: Parameters<typeof createProduct>[0]) => void;
}) {
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    onSave({
      barcode,
      name: String(form.get("name") ?? "").trim(),
      brand: String(form.get("brand") ?? "").trim() || null,
      image_url: prefill.image_url,
      quantity: intField(form, "qty"),
      expiry_date: dateField(form, "expiry"),
      min_quantity: intField(form, "min") || 0,
    });
  }

  return (
    <form className="space-y-3 rounded-xl border p-4" onSubmit={submit}>
      <h2 className="text-lg font-semibold">New product</h2>
      <p className="text-sm text-muted-foreground">
        {prefill.found ? "We found this barcode. Check the details and add stock." : "Not in our list yet. Add the details."}
      </p>
      {prefill.image_url && (
        // eslint-disable-next-line @next/next/no-img-element -- OFF thumbnail
        <img src={prefill.image_url} alt="" className="size-20 rounded-md bg-muted object-contain" />
      )}
      <div className="space-y-1.5">
        <Label htmlFor="new-barcode">Barcode</Label>
        <Input id="new-barcode" value={barcode} readOnly className={cn(big, "bg-muted")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-name">Name</Label>
        <Input id="new-name" name="name" required maxLength={120} defaultValue={prefill.name ?? ""} className={big} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-brand">Brand (optional)</Label>
        <Input id="new-brand" name="brand" maxLength={120} defaultValue={prefill.brand ?? ""} className={big} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="new-qty">Quantity on shelf</Label>
          <Input id="new-qty" name="qty" inputMode="numeric" pattern="\d*" required className={big} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-min">Low-stock alert at</Label>
          <Input id="new-min" name="min" inputMode="numeric" pattern="\d*" placeholder="0" className={big} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-expiry">Earliest expiry date</Label>
        <Input id="new-expiry" name="expiry" type="date" className={big} />
      </div>
      {prefill.found && <p className="text-xs text-muted-foreground">Product data from Open Food Facts (ODbL).</p>}
      <FormButtons pending={pending} label="Save product" onCancel={onCancel} />
    </form>
  );
}

function FormButtons({ pending, label, onCancel }: { pending: boolean; label: string; onCancel: () => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button type="button" variant="ghost" className={big} onClick={onCancel} disabled={pending}>Cancel</Button>
      <Button type="submit" className={big} disabled={pending}>{pending ? "Saving…" : label}</Button>
    </div>
  );
}
