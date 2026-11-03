import { beforeAll, describe, expect, it } from "vitest";
import { CELLAR_SHOP_ID, DEMO_SHOP_ID } from "@/lib/demo";
import { adminClient, anonClient, day, eventsFor, signIn, testBarcode, type Client } from "./helpers";

let staff: Client;
let manager: Client;
let cellar: Client;
let demoProductId: string;

beforeAll(async () => {
  [staff, manager, cellar] = await Promise.all([signIn("staff"), signIn("manager"), signIn("cellar")]);
  const { data, error } = await adminClient()
    .from("products").select("id").eq("shop_id", DEMO_SHOP_ID).gt("quantity", 0).limit(1).single();
  if (error) throw error;
  demoProductId = data.id;
});

async function staffProduct() {
  const { data, error } = await staff.rpc("create_product", {
    p_barcode: testBarcode(), p_name: "RLS test", p_brand: null, p_image_url: null,
    p_quantity: 3, p_expiry_date: day(10), p_min_quantity: 0,
  });
  if (error) throw error;
  return data!;
}

describe("staff role limits", () => {
  it("staff calling update_product gets an error and nothing changes", async () => {
    const p = await staffProduct();
    const { error } = await staff.rpc("update_product", {
      p_product_id: p.id, p_name: "Hacked", p_brand: null, p_min_quantity: 99,
    });
    expect(error?.message).toMatch(/manager/i);
    const { data } = await staff.from("products").select("name, min_quantity").eq("id", p.id).single();
    expect(data).toEqual({ name: "RLS test", min_quantity: 0 });
    expect(await eventsFor(p.id)).toHaveLength(1);
  });

  it("staff calling delete_product gets an error and the product stays", async () => {
    const p = await staffProduct();
    const { error } = await staff.rpc("delete_product", { p_product_id: p.id });
    expect(error?.message).toMatch(/manager/i);
    const { data } = await staff.from("products").select("id").eq("id", p.id);
    expect(data).toHaveLength(1);
  });

  it("staff can't delete via the table either", async () => {
    const p = await staffProduct();
    await staff.from("products").delete().eq("id", p.id);
    const { data } = await adminClient().from("products").select("id").eq("id", p.id);
    expect(data).toHaveLength(1);
  });

  it("staff calling update_shop gets an error", async () => {
    const { error } = await staff.rpc("update_shop", { p_name: "Hacked", p_expiry_window_days: 3 });
    expect(error?.message).toMatch(/manager/i);
  });

  it("manager can update_shop and the window is validated", async () => {
    const { data: before } = await manager.from("shops").select("name, expiry_window_days").single();
    const bad = await manager.rpc("update_shop", { p_name: before!.name, p_expiry_window_days: 0 });
    expect(bad.error?.message).toMatch(/window/i);
    const { data, error } = await manager.rpc("update_shop", { p_name: "Renamed Off-Licence", p_expiry_window_days: 10 });
    expect(error).toBeNull();
    expect(data).toMatchObject({ name: "Renamed Off-Licence", expiry_window_days: 10 });
    await manager.rpc("update_shop", { p_name: before!.name, p_expiry_window_days: before!.expiry_window_days });
  });
});

describe("no direct writes from clients", () => {
  it("insert/update on products and stock_events are refused", async () => {
    const ins = await staff.from("products").insert({ shop_id: DEMO_SHOP_ID, barcode: testBarcode(), name: "Direct" });
    expect(ins.error).not.toBeNull();
    await manager.from("products").update({ quantity: 999 }).eq("id", demoProductId);
    const { data } = await adminClient().from("products").select("quantity").eq("id", demoProductId).single();
    expect(data!.quantity).not.toBe(999);
    const ev = await manager.from("stock_events").insert({
      shop_id: DEMO_SHOP_ID, product_name: "Fake", type: "count",
    });
    expect(ev.error).not.toBeNull();
  });

  it("memberships can't be changed by a member (no self-promotion)", async () => {
    await staff.from("memberships").update({ role: "manager" }).neq("role", "x");
    const { data } = await staff.rpc("is_manager");
    expect(data).toBe(false);
  });

  it("anonymous callers can't run RPCs or read tables", async () => {
    const anon = anonClient();
    const rpc = await anon.rpc("restock", { p_product_id: demoProductId, p_add_qty: 1, p_expiry_date: null });
    expect(rpc.error).not.toBeNull();
    const { data } = await anon.from("products").select("id");
    expect(data ?? []).toEqual([]);
  });
});

describe("shop isolation (Corner Cellar manager vs Demo Off-Licence)", () => {
  it("can only select its own shop's rows", async () => {
    for (const table of ["products", "stock_events", "memberships"] as const) {
      const { data, error } = await cellar.from(table).select("shop_id");
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThan(0);
      expect(data!.every((r) => r.shop_id === CELLAR_SHOP_ID)).toBe(true);
    }
    const { data: shops } = await cellar.from("shops").select("id");
    expect(shops).toEqual([{ id: CELLAR_SHOP_ID }]);
    const { data: target } = await cellar.from("products").select("id").eq("id", demoProductId);
    expect(target).toEqual([]);
  });

  it("can't mutate Demo Off-Licence products through any RPC", async () => {
    const { data: before } = await adminClient().from("products").select("*").eq("id", demoProductId).single();
    const calls = [
      cellar.rpc("restock", { p_product_id: demoProductId, p_add_qty: 5, p_expiry_date: null }),
      cellar.rpc("set_count", { p_product_id: demoProductId, p_qty: 0, p_earliest_expiry: null }),
      cellar.rpc("update_product", { p_product_id: demoProductId, p_name: "Pwned", p_brand: null, p_min_quantity: 0 }),
      cellar.rpc("delete_product", { p_product_id: demoProductId }),
    ];
    for (const { error } of await Promise.all(calls)) {
      expect(error?.message).toMatch(/not found/i);
    }
    const { data: after } = await adminClient().from("products").select("*").eq("id", demoProductId).single();
    expect(after).toEqual(before);
  });

  it("creates products in its own shop even with a barcode the demo shop uses", async () => {
    const { data: demo } = await adminClient().from("products").select("barcode").eq("id", demoProductId).single();
    const { data, error } = await cellar.rpc("create_product", {
      p_barcode: demo!.barcode, p_name: "Same code, other shop", p_brand: null, p_image_url: null,
      p_quantity: 1, p_expiry_date: null, p_min_quantity: 0,
    });
    // Corner Cellar may already stock it from the seed; either way it never touches the demo shop.
    if (error) expect(error.message).toMatch(/already exists/i);
    else expect(data!.shop_id).toBe(CELLAR_SHOP_ID);
  });
});
