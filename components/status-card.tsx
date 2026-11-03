import Link from "next/link";
import { cn } from "@/lib/utils";

export type StatusItem = { id: string; name: string; detail: string };

const tones = {
  red: { card: "border-red-300 bg-red-50", title: "text-red-800", count: "bg-red-600 text-white", detail: "text-red-700" },
  amber: { card: "border-amber-300 bg-amber-50", title: "text-amber-900", count: "bg-amber-500 text-amber-950", detail: "text-amber-800" },
  neutral: { card: "border-border bg-card", title: "text-foreground", count: "bg-muted text-foreground", detail: "text-muted-foreground" },
} as const;

export function StatusCard({ title, tone, items, empty, max = 8 }: {
  title: string;
  tone: keyof typeof tones;
  items: StatusItem[];
  empty: string;
  max?: number;
}) {
  const t = tones[tone];
  const shown = items.slice(0, max);
  return (
    <section className={cn("rounded-xl border p-4", t.card)}>
      <h2 className={cn("flex items-center justify-between text-base font-semibold", t.title)}>
        {title}
        <span className={cn("min-w-7 rounded-full px-2 py-0.5 text-center text-sm tabular-nums", t.count)}>
          {items.length}
        </span>
      </h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-black/5">
          {shown.map((item) => (
            <li key={item.id}>
              <Link href={`/products/${item.id}`} className="flex min-h-11 flex-col justify-center py-1.5">
                <span className="truncate font-medium">{item.name}</span>
                <span className={cn("text-sm", t.detail)}>{item.detail}</span>
              </Link>
            </li>
          ))}
          {items.length > max && (
            <li className="pt-2 text-sm text-muted-foreground">+{items.length - max} more</li>
          )}
        </ul>
      )}
    </section>
  );
}
