import Link from "next/link";
import { signOut } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/auth";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/products", label: "Products" },
] as const;

export function AppHeader({ shopName, role, displayName, active }: {
  shopName: string; role: Role; displayName: string; active?: "/" | "/products";
}) {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center gap-3 px-4 pt-2">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold leading-tight">{shopName}</h1>
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
      <nav className="mx-auto flex max-w-md gap-1 px-2">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-current={active === n.href ? "page" : undefined}
            className={cn("flex h-11 items-center border-b-2 px-3 text-sm font-medium",
              active === n.href ? "border-foreground text-foreground" : "border-transparent text-muted-foreground")}>
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
