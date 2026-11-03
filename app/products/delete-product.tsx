"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteProduct } from "./actions";

/** Trash button → inline confirmation (no browser confirm(): it blocks and can't be styled). */
export function DeleteProduct({ id, name }: { id: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button variant="ghost" size="icon" aria-label={`Delete ${name}`} className="size-11 shrink-0 text-muted-foreground"
        onClick={() => { setError(null); setConfirming(true); }}>
        <Trash2 className="size-5" aria-hidden />
      </Button>
    );
  }

  return (
    <div role="group" aria-label={`Confirm delete ${name}`}
      className="absolute inset-0 z-[1] flex items-center gap-2 bg-red-50 px-3">
      <p className="min-w-0 flex-1 text-sm">
        <span className="block truncate font-medium text-red-800">Delete {name}?</span>
        <span className="block text-xs text-red-700">{error ?? "Stock history is kept."}</span>
      </p>
      <Button variant="ghost" className="h-11 px-3" disabled={pending} onClick={() => setConfirming(false)}>
        Cancel
      </Button>
      <Button className="h-11 bg-red-600 px-3 text-white hover:bg-red-700" disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await deleteProduct(id);
            if (res.error) setError(res.error);
            else toast.success(`Deleted ${name}`);
          })
        }>
        {pending ? "Deleting…" : "Yes, delete"}
      </Button>
    </div>
  );
}
