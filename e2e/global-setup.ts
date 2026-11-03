import { execSync } from "node:child_process";

// Reseed so the smoke spec is re-runnable. Runs locally even when BASE_URL is
// Vercel, so the secret key never leaves this machine.
export default function globalSetup() {
  execSync("npm run seed --silent", { stdio: "inherit" });
}
