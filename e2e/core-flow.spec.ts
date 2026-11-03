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
