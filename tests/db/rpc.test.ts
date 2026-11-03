import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, day, eventsFor, signIn, testBarcode, type Client } from "./helpers";

let staff: Client;
let manager: Client;

beforeAll(async () => {
  staff = await signIn("staff");
  manager = await signIn("manager");
});

async function makeProduct(qty: number, expiry: string | null, client = staff) {
  const { data, error } = await client.rpc("create_product", {
    p_barcode: testBarcode(),
    p_name: "Test Lager 440ml",
    p_brand: "Testbrew",
    p_image_url: null,
    p_quantity: qty,
    p_expiry_date: expiry,
    p_min_quantity: 2,
  });
  if (error) throw error;
  return data!;
}

async function getProduct(id: string) {
  const { data, error } = await staff.from("products").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

describe("create_product", () => {
  it("inserts the product and exactly one create event", async () => {
    const p = await makeProduct(12, day(30));
    expect(p).toMatchObject({ quantity: 12, expiry_date: day(30), min_quantity: 2, name: "Test Lager 440ml" });
    const events = await eventsFor(p.id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "create", qty_before: null, qty_after: 12,
      expiry_before: null, expiry_after: day(30), product_name: "Test Lager 440ml",
    });
  });

  it("stores a null expiry when quantity is 0", async () => {
    const p = await makeProduct(0, day(30));
    expect(p.expiry_date).toBeNull();
  });

  it("rejects a duplicate barcode in the same shop with a clear message", async () => {
    const p = await makeProduct(1, day(5));
    const { error } = await staff.rpc("create_product", {
      p_barcode: p.barcode, p_name: "Dup", p_brand: null, p_image_url: null,
      p_quantity: 1, p_expiry_date: null, p_min_quantity: 0,
    });
    expect(error?.message).toMatch(/already exists/i);
  });

  it("rejects an invalid barcode and a negative quantity", async () => {
    const bad = await staff.rpc("create_product", {
      p_barcode: "12ab", p_name: "X", p_brand: null, p_image_url: null,
      p_quantity: 1, p_expiry_date: null, p_min_quantity: 0,
    });
    expect(bad.error?.message).toMatch(/barcode/i);
    const neg = await staff.rpc("create_product", {
      p_barcode: testBarcode(), p_name: "X", p_brand: null, p_image_url: null,
      p_quantity: -1, p_expiry_date: null, p_min_quantity: 0,
    });
    expect(neg.error?.message).toMatch(/quantity/i);
  });
});

describe("restock", () => {
  it("adds to qty and keeps the earliest date when incoming is later", async () => {
    const p = await makeProduct(5, day(10));
    const { data, error } = await staff.rpc("restock", { p_product_id: p.id, p_add_qty: 3, p_expiry_date: day(20) });
    expect(error).toBeNull();
    expect(data).toMatchObject({ quantity: 8, expiry_date: day(10) });
  });

  it("takes the incoming date when it is earlier", async () => {
    const p = await makeProduct(5, day(10));
    const { data } = await staff.rpc("restock", { p_product_id: p.id, p_add_qty: 1, p_expiry_date: day(4) });
    expect(data).toMatchObject({ quantity: 6, expiry_date: day(4) });
  });

  it("takes the incoming date when qty was 0 (even if later)", async () => {
    const p = await makeProduct(0, null);
    const { data } = await staff.rpc("restock", { p_product_id: p.id, p_add_qty: 6, p_expiry_date: day(60) });
    expect(data).toMatchObject({ quantity: 6, expiry_date: day(60) });
  });

  it("takes the incoming date when the current expiry was null", async () => {
    const p = await makeProduct(4, null);
    const { data } = await staff.rpc("restock", { p_product_id: p.id, p_add_qty: 2, p_expiry_date: day(15) });
    expect(data).toMatchObject({ quantity: 6, expiry_date: day(15) });
  });

  it("keeps the current date when no incoming date is given", async () => {
    const p = await makeProduct(4, day(9));
    const { data } = await staff.rpc("restock", { p_product_id: p.id, p_add_qty: 2, p_expiry_date: null });
    expect(data).toMatchObject({ quantity: 6, expiry_date: day(9) });
  });

  it("rejects add_qty <= 0 and leaves the product untouched", async () => {
    const p = await makeProduct(5, day(10));
    for (const q of [0, -3]) {
      const { error } = await staff.rpc("restock", { p_product_id: p.id, p_add_qty: q, p_expiry_date: day(1) });
      expect(error?.message).toMatch(/at least 1/i);
    }
    expect(await getProduct(p.id)).toMatchObject({ quantity: 5, expiry_date: day(10) });
    expect(await eventsFor(p.id)).toHaveLength(1);
  });

  it("writes exactly one restock event with before/after values", async () => {
    const p = await makeProduct(5, day(10));
    await staff.rpc("restock", { p_product_id: p.id, p_add_qty: 6, p_expiry_date: day(3) });
    const events = await eventsFor(p.id);
    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({
      type: "restock", qty_before: 5, qty_after: 11, expiry_before: day(10), expiry_after: day(3),
    });
  });
});

describe("set_count", () => {
  it("sets the absolute qty and can move the date forward", async () => {
    const p = await makeProduct(9, day(2));
    const { data, error } = await staff.rpc("set_count", { p_product_id: p.id, p_qty: 4, p_earliest_expiry: day(30) });
    expect(error).toBeNull();
    expect(data).toMatchObject({ quantity: 4, expiry_date: day(30) });
  });

  it("nulls the expiry at qty 0", async () => {
    const p = await makeProduct(9, day(2));
    const { data } = await staff.rpc("set_count", { p_product_id: p.id, p_qty: 0, p_earliest_expiry: day(30) });
    expect(data).toMatchObject({ quantity: 0, expiry_date: null });
  });

  it("rejects negative counts", async () => {
    const p = await makeProduct(9, day(2));
    const { error } = await staff.rpc("set_count", { p_product_id: p.id, p_qty: -1, p_earliest_expiry: null });
    expect(error?.message).toMatch(/negative/i);
    expect(await eventsFor(p.id)).toHaveLength(1);
  });

  it("writes exactly one count event with before/after values", async () => {
    const p = await makeProduct(9, day(2));
    await staff.rpc("set_count", { p_product_id: p.id, p_qty: 0, p_earliest_expiry: day(30) });
    const events = await eventsFor(p.id);
    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({
      type: "count", qty_before: 9, qty_after: 0, expiry_before: day(2), expiry_after: null,
    });
  });
});

describe("update_product (manager)", () => {
  it("edits details and writes exactly one edit event", async () => {
    const p = await makeProduct(3, day(5));
    const { data, error } = await manager.rpc("update_product", {
      p_product_id: p.id, p_name: "Renamed IPA", p_brand: "", p_min_quantity: 6,
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({ name: "Renamed IPA", brand: null, min_quantity: 6, quantity: 3 });
    const events = await eventsFor(p.id);
    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({
      type: "edit", product_name: "Renamed IPA", qty_before: 3, qty_after: 3,
      expiry_before: day(5), expiry_after: day(5),
    });
  });
});

describe("delete_product (manager)", () => {
  it("deletes the product and keeps one delete event in the log", async () => {
    const p = await makeProduct(3, day(5));
    const { error } = await manager.rpc("delete_product", { p_product_id: p.id });
    expect(error).toBeNull();
    const { data: gone } = await staff.from("products").select("id").eq("id", p.id);
    expect(gone).toEqual([]);
    // product_id is set null on delete, so find the event by name + shop.
    const { data: events } = await adminClient()
      .from("stock_events").select("*").eq("shop_id", p.shop_id).eq("product_name", p.name)
      .eq("type", "delete").gte("created_at", p.created_at);
    expect(events!.length).toBeGreaterThanOrEqual(1);
    expect(events!.at(-1)).toMatchObject({ product_id: null, qty_before: 3, qty_after: null });
  });
});
