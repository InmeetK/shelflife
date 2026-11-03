"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEMO_PASSWORD, DEMO_USERS } from "@/lib/demo";

export function LoginForm() {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, {});

  return (
    <div className="space-y-6">
      <section className="space-y-3" aria-label="Demo accounts">
        {(["manager", "staff"] as const).map((who) => (
          <form key={who} action={action}>
            <input type="hidden" name="email" value={DEMO_USERS[who].email} />
            <input type="hidden" name="password" value={DEMO_PASSWORD} />
            <Button type="submit" disabled={pending} variant={who === "staff" ? "default" : "secondary"}
              className="h-12 w-full text-base">
              Use demo {who}
            </Button>
          </form>
        ))}
        <p className="text-center text-xs text-muted-foreground">
          Demo password: <code>{DEMO_PASSWORD}</code>
        </p>
      </section>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or sign in with email
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={action} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required
            defaultValue={state.email} className="h-12 text-base" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required
            className="h-12 text-base" />
        </div>
        {state.error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </p>
        )}
        <Button type="submit" disabled={pending} variant="outline" className="h-12 w-full text-base">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
