import Link from "next/link";
import type { Tables } from "@/lib/database";
import { formatDate, timeAgo } from "@/lib/dates";

type Event = Pick<Tables<"stock_events">,
  "id" | "type" | "product_id" | "product_name" | "user_id" | "qty_before" | "qty_after" | "expiry_before" | "expiry_after" | "created_at">;

function describe(e: Event): string {
  const qty = (n: number | null) => n ?? 0;
  switch (e.type) {
    case "create": return `added ${qty(e.qty_after)} on shelf`;
    case "restock": return `restocked +${qty(e.qty_after) - qty(e.qty_before)} (now ${qty(e.qty_after)})`;
    case "count": {
      const date = e.expiry_after !== e.expiry_before ? `, date ${e.expiry_after ? formatDate(e.expiry_after) : "cleared"}` : "";
      return `counted ${qty(e.qty_before)} → ${qty(e.qty_after)}${date}`;
    }
    case "edit": return "edited details";
    case "delete": return "deleted the product";
    default: return e.type;
  }
}

export function RecentChanges({ events, names }: { events: Event[]; names: Map<string, string> }) {
  return (
    <section className="rounded-xl border p-4">
      <h2 className="text-base font-semibold">Recent changes</h2>
      {events.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No stock changes yet.</p>
      ) : (
        <ul className="mt-2 divide-y">
          {events.map((e) => {
            const who = (e.user_id && names.get(e.user_id)) || "Someone";
            const body = (
              <>
                <span className="block truncate font-medium">{e.product_name}</span>
                <span className="block text-sm text-muted-foreground">
                  {who} {describe(e)} · {timeAgo(e.created_at)}
                </span>
              </>
            );
            return (
              <li key={e.id}>
                {e.product_id ? (
                  <Link href={`/products/${e.product_id}`} className="flex min-h-11 flex-col justify-center py-1.5">{body}</Link>
                ) : (
                  <div className="flex min-h-11 flex-col justify-center py-1.5">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
