import { signOut } from "@/app/actions";
import { Button } from "@/components/ui/button";

export default function NoShopPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-5 text-center">
      <h1 className="text-xl font-semibold">This account isn&apos;t linked to a shop</h1>
      <p className="text-muted-foreground">Ask your shop manager to add you, then sign in again.</p>
      <form action={signOut}>
        <Button type="submit" variant="outline" className="h-12 w-full text-base">Sign out</Button>
      </form>
    </main>
  );
}
