"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { friendlyRpcError } from "@/lib/errors";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Manager-only. delete_product logs a 'delete' stock event, then deletes. */
export async function deleteProduct(id: string): Promise<{ error?: string }> {
  if (typeof id !== "string" || !UUID.test(id)) return { error: "Unknown product." };
  const { supabase, role } = await requireMember();
  if (role !== "manager") return { error: "Only managers can delete products." };
  const { error } = await supabase.rpc("delete_product", { p_product_id: id });
  if (error) return { error: friendlyRpcError(error) };
  revalidatePath("/", "layout");
  return {};
}
