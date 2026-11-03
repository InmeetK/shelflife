"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import type { Tables } from "@/lib/database";
import { friendlyRpcError as friendly } from "@/lib/errors";

export type Product = Tables<"products">;
type Result = { product: Product; error?: undefined } | { error: string; product?: undefined };

const BARCODE = /^\d{8,14}$/;
const isDate = (v: unknown): v is string | null => v === null || (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v));
const isQty = (v: unknown, min: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= 100_000;


function done(data: Product | null, error: { code?: string; message: string } | null): Result {
  if (error || !data) return { error: error ? friendly(error) : "Something went wrong. Please try again." };
  revalidatePath("/", "layout");
  return { product: data };
}

export async function findByBarcode(barcode: string): Promise<{ product: Product | null } | { error: string }> {
  if (typeof barcode !== "string" || !BARCODE.test(barcode)) return { error: "Barcode must be 8 to 14 digits." };
  const { supabase } = await requireMember();
  const { data, error } = await supabase.from("products").select("*").eq("barcode", barcode).maybeSingle();
  if (error) return { error: "Couldn't look that up. Please try again." };
  return { product: data };
}

export async function createProduct(input: {
  barcode: string; name: string; brand: string | null; image_url: string | null;
  quantity: number; expiry_date: string | null; min_quantity: number;
}): Promise<Result> {
  if (!BARCODE.test(input.barcode ?? "")) return { error: "Barcode must be 8 to 14 digits." };
  if (!input.name?.trim() || input.name.length > 120) return { error: "Enter a product name (max 120 characters)." };
  if (!isQty(input.quantity, 0)) return { error: "Quantity must be a whole number, 0 or more." };
  if (!isQty(input.min_quantity, 0)) return { error: "Minimum must be a whole number, 0 or more." };
  if (!isDate(input.expiry_date)) return { error: "Enter a valid expiry date." };
  const image = input.image_url && /^https:\/\//.test(input.image_url) && input.image_url.length < 500 ? input.image_url : null;

  const { supabase } = await requireMember();
  const { data, error } = await supabase.rpc("create_product", {
    p_barcode: input.barcode, p_name: input.name, p_brand: input.brand?.slice(0, 120) ?? null, p_image_url: image,
    p_quantity: input.quantity, p_expiry_date: input.expiry_date, p_min_quantity: input.min_quantity,
  });
  return done(data, error);
}

export async function restockProduct(id: string, addQty: number, expiry: string | null): Promise<Result> {
  if (!isQty(addQty, 1)) return { error: "Add at least 1." };
  if (!isDate(expiry)) return { error: "Enter a valid expiry date." };
  const { supabase } = await requireMember();
  const { data, error } = await supabase.rpc("restock", { p_product_id: id, p_add_qty: addQty, p_expiry_date: expiry });
  return done(data, error);
}

export async function countProduct(id: string, qty: number, expiry: string | null): Promise<Result> {
  if (!isQty(qty, 0)) return { error: "Count must be a whole number, 0 or more." };
  if (!isDate(expiry)) return { error: "Enter a valid expiry date." };
  const { supabase } = await requireMember();
  const { data, error } = await supabase.rpc("set_count", { p_product_id: id, p_qty: qty, p_earliest_expiry: expiry });
  return done(data, error);
}
