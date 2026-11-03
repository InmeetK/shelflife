// Open Food Facts v3 product lookup. Shape checked against real responses:
// found → 200 + status "success" + product{…}; not found → 404 + JSON failure
// body; missing fields are absent or ""; under load OFF serves an HTML 503.

export type OffResult = { found: boolean; name: string | null; brand: string | null; image_url: string | null };

const NOT_FOUND: OffResult = { found: false, name: null, brand: null, image_url: null };

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export function parseOffResponse(httpStatus: number, body: string): OffResult {
  if (httpStatus !== 200) return NOT_FOUND;
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return NOT_FOUND;
  }
  if (!json || typeof json !== "object") return NOT_FOUND;
  const { status, product } = json as { status?: unknown; product?: Record<string, unknown> };
  if (!(status === "success" || status === "success_with_warnings") || !product || typeof product !== "object") {
    return NOT_FOUND;
  }
  const image = text(product.image_front_small_url);
  return {
    found: true,
    name: text(product.product_name),
    brand: text(text(product.brands)?.split(",")[0]),
    image_url: image && /^https?:\/\//.test(image) ? image : null,
  };
}

export async function lookupOff(barcode: string): Promise<OffResult> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v3/product/${barcode}.json?fields=product_name,brands,image_front_small_url`,
      {
        headers: { "User-Agent": `ShelfLife/0.1 (${process.env.OFF_CONTACT_EMAIL ?? "unknown"})` },
        signal: AbortSignal.timeout(3000),
        next: { revalidate: 86400 },
      },
    );
    return parseOffResponse(res.status, await res.text());
  } catch {
    return NOT_FOUND; // timeout / network: the form still works empty
  }
}
