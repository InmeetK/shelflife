import Link from "next/link";
import { signOut } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/auth";

export function AppHeader({ shopName, role, displayName }: { shopName: string; role: Role; displayName: string }) {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-2">
        <div className="min-w-0 flex-1">
          <Link href="/" className="block">
            <h1 className="truncate text-lg font-semibold leading-tight">{shopName}</h1>
          </Link>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate">{displayName}</span>
            <Badge variant={role === "manager" ? "default" : "secondary"}>
              {role === "manager" ? "Manager" : "Staff"}
            </Badge>
          </p>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="ghost" className="h-11 px-3">Sign out</Button>
        </form>
      </div>
    </header>
  );
}
