import { describe, expect, it } from "vitest";
import { parseOffResponse } from "@/lib/off";
import found from "./fixtures/off-found.json";
import notFound from "./fixtures/off-not-found.json";
import noImage from "./fixtures/off-no-image.json";
import noBrand from "./fixtures/off-no-brand.json";
import emptyBrand from "./fixtures/off-empty-brand.json";

const none = { found: false, name: null, brand: null, image_url: null };

describe("parseOffResponse (real OFF v3 bodies)", () => {
  it("found: name, brand, small front image", () => {
    expect(parseOffResponse(200, JSON.stringify(found))).toEqual({
      found: true,
      name: "Coca-Cola Original",
      brand: "COCA-COLA SERVICES SA/NV",
      image_url: "https://images.openfoodfacts.org/images/products/544/900/000/0996/front_en.1129.200.jpg",
    });
  });

  it("takes the first brand from a comma-separated list", () => {
    const body = { ...found, product: { ...found.product, brands: "Sprite, The Coca-Cola Company" } };
    expect(parseOffResponse(200, JSON.stringify(body)).brand).toBe("Sprite");
  });

  it("not found: HTTP 404 with a JSON failure body", () => {
    expect(parseOffResponse(404, JSON.stringify(notFound))).toEqual(none);
  });

  it("missing image key → null image", () => {
    expect(parseOffResponse(200, JSON.stringify(noImage))).toMatchObject({
      found: true, name: "Monster Energy Ultra", image_url: null,
    });
  });

  it("missing brands key and empty-string brands → null brand", () => {
    expect(parseOffResponse(200, JSON.stringify(noBrand))).toMatchObject({ found: true, brand: null });
    expect(parseOffResponse(200, JSON.stringify(emptyBrand))).toMatchObject({ found: true, brand: null });
  });

  it("blank product_name → null name (still found)", () => {
    const body = { ...found, product: { ...found.product, product_name: "  " } };
    expect(parseOffResponse(200, JSON.stringify(body))).toMatchObject({ found: true, name: null });
  });

  it("rate limit / overload: 429, or a 503 HTML page → not found", () => {
    expect(parseOffResponse(429, "")).toEqual(none);
    expect(parseOffResponse(503, "<html><body>Service Unavailable</body></html>")).toEqual(none);
    expect(parseOffResponse(200, "<html>oops</html>")).toEqual(none);
  });

  it("rejects non-http image URLs", () => {
    const body = { ...found, product: { ...found.product, image_front_small_url: "javascript:alert(1)" } };
    expect(parseOffResponse(200, JSON.stringify(body)).image_url).toBeNull();
  });
});
