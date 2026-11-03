import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { requireMember } from "@/lib/auth";
import { londonToday } from "@/lib/dates";
import { ScanClient } from "./scan-client";

export const metadata: Metadata = { title: "Scan · ShelfLife" };

export default async function ScanPage() {
  const me = await requireMember();
  return (
    <>
      <AppHeader shopName={me.shop.name} role={me.role} displayName={me.displayName} />
      <main className="mx-auto max-w-md px-4 pt-4 pb-10">
        <ScanClient today={londonToday()} windowDays={me.shop.windowDays} />
      </main>
    </>
  );
}
