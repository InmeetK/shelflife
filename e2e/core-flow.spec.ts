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
