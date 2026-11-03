import { expect, test, type Page } from "@playwright/test";

const shot = (page: Page, name: string) =>
  page.screenshot({ path: `e2e/screenshots/${name}.png`, fullPage: true });

async function loginAs(page: Page, who: "manager" | "staff") {
  await page.goto("/login");
  await page.getByRole("button", { name: `Use demo ${who}` }).click();
  await expect(page).toHaveURL("/");
}

test("1. demo staff login → dashboard shows Expired / Expiring / Low stock", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/); // no session → login
  await shot(page, "login");

  await loginAs(page, "staff");
  await expect(page.getByRole("heading", { name: "Demo Off-Licence" })).toBeVisible();
  await expect(page.getByText("Staff", { exact: true })).toBeVisible();
  for (const card of [/^Expired/, /^Expiring within 7 days/, /^Low stock/]) {
    await expect(page.getByRole("heading", { name: card })).toBeVisible();
  }
  await shot(page, "dashboard-staff");
});

const lowStockCard = (page: Page) =>
  page.locator("section").filter({ has: page.getByRole("heading", { name: /^Low stock/ }) });

test("2. manual barcode of a seeded product → Restock +6 → dashboard reflects it", async ({ page }) => {
  await loginAs(page, "staff");
  await expect(lowStockCard(page)).toContainText("Corona Extra 330ml"); // seeded: 2 left, min 6

  await page.getByRole("link", { name: "Scan" }).click();
  await expect(page).toHaveURL("/scan");
  await shot(page, "scan-idle");
  await page.getByLabel("Barcode").fill("75041670");
  await page.getByRole("button", { name: "Look up" }).click();

  await expect(page.getByRole("heading", { name: "Corona Extra 330ml" })).toBeVisible();
  await expect(page.getByText("2 on shelf")).toBeVisible();
  await shot(page, "product-sheet");
  await page.getByRole("button", { name: "Restock" }).click();
  await page.getByLabel("Quantity to add").fill("6");
  await shot(page, "restock-form");
  await page.getByRole("button", { name: "Save restock" }).click();
  await expect(page.getByText("8 on shelf", { exact: true })).toBeVisible(); // toast also says it
  await expect(page.getByText(/Restocked \+6/)).toBeVisible();

  await page.goto("/");
  await expect(lowStockCard(page)).not.toContainText("Corona Extra 330ml");
});

test("3. unknown barcode → new-product form → save → appears in /products", async ({ page }) => {
  await loginAs(page, "staff");
  await page.goto("/scan");
  await page.getByLabel("Barcode").fill("5999999999998"); // verified absent from OFF
  await page.getByRole("button", { name: "Look up" }).click();

  await expect(page.getByRole("heading", { name: "New product" })).toBeVisible();
  await expect(page.getByLabel("Barcode", { exact: true })).toHaveValue("5999999999998");
  await page.getByLabel("Name").fill("E2E Test Ale 500ml");
  await page.getByLabel("Quantity on shelf").fill("12");
  await page.getByLabel("Earliest expiry date").fill("2030-01-31");
  await shot(page, "new-product-form");
  await page.getByRole("button", { name: "Save product" }).click();

  await expect(page.getByRole("heading", { name: "E2E Test Ale 500ml" })).toBeVisible();
  await page.goto("/products");
  await expect(page.getByText("E2E Test Ale 500ml")).toBeVisible();
  await shot(page, "products");
});

// /settings was cut (SPEC §9 cut list), so step 4 checks the manager-only card instead.
test("4. staff don't see Recent changes; demo manager does", async ({ page }) => {
  await loginAs(page, "staff");
  await expect(page.getByRole("heading", { name: /^Expired/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Recent changes/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await loginAs(page, "manager");
  const recent = page.locator("section").filter({ has: page.getByRole("heading", { name: /^Recent changes/ }) });
  await expect(recent).toBeVisible();
  await expect(recent).toContainText("Sam"); // seeded staff events, names via memberships
  await shot(page, "dashboard-manager");
});

test("products: search by name and filter chips", async ({ page }) => {
  await loginAs(page, "staff");
  await page.getByRole("link", { name: "Products" }).click();
  await expect(page).toHaveURL("/products");
  const list = page.getByRole("list", { name: "Products" });

  await page.getByLabel("Search products").fill("milk");
  await page.getByLabel("Search products").press("Enter");
  await expect(list).toContainText("Cravendale Semi-Skimmed Milk 2L");
  await expect(list).not.toContainText("Corona Extra 330ml");

  await page.getByRole("link", { name: "Clear" }).click();
  await expect(page).toHaveURL("/products");
  await expect(page.getByLabel("Search products")).toHaveValue("");
  await page.getByRole("link", { name: "Low stock" }).click();
  await expect(page).toHaveURL("/products?filter=low");
  await expect(list).toContainText("Red Bull Energy Drink 250ml"); // not Corona: step 2 restocks it
  await expect(list).not.toContainText("Asahi Super Dry 330ml");
  await shot(page, "products-low");

  await page.getByLabel("Search products").fill("zzz-nothing");
  await page.getByLabel("Search products").press("Enter");
  await expect(page.getByText(/No products match/)).toBeVisible();
  await shot(page, "products-empty");
});

test("login shows a friendly error for a wrong password", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("staff@shelflife.demo");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  // Next's route announcer is also role=alert, so match ours by text.
  await expect(page.getByRole("alert").filter({ hasText: /incorrect/i })).toBeVisible();
  await shot(page, "login-error");
});

test("sign out returns to /login", async ({ page }) => {
  await loginAs(page, "manager");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});
