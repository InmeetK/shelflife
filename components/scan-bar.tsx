import Link from "next/link";
import { ScanBarcode } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Bottom-fixed primary action. Pages using it need `pb-28` on their main. */
export function ScanBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
      <div className="mx-auto max-w-md">
        <Link href="/scan" className={cn(buttonVariants(), "h-14 w-full gap-2 text-lg")}>
          <ScanBarcode className="size-6" aria-hidden />
          Scan
        </Link>
      </div>
    </div>
  );
}
