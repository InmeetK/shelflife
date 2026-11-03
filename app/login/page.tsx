import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · ShelfLife" };

export default async function LoginPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect("/");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-5 py-10">
      <div className="space-y-1 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">ShelfLife</h1>
        <p className="text-muted-foreground">Expiry &amp; stock tracker for off-licences</p>
      </div>
      <LoginForm />
    </main>
  );
}
