// Public demo credentials. Shown on the login buttons and in the README, so
// committing them is intentional. Users are created by `npm run seed`.
export const DEMO_PASSWORD = "shelflife-demo";

export const DEMO_USERS = {
  manager: { email: "manager@shelflife.demo", name: "Priya", role: "manager" },
  staff: { email: "staff@shelflife.demo", name: "Sam", role: "staff" },
  // Corner Cellar: second shop, only used by the isolation tests.
  cellar: { email: "cellar@shelflife.demo", name: "Dev", role: "manager" },
} as const;

export const DEMO_SHOP_ID = "00000000-0000-4000-8000-000000000001";
export const CELLAR_SHOP_ID = "00000000-0000-4000-8000-000000000002";
