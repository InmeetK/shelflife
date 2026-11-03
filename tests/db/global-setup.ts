import { execSync } from "node:child_process";

// DB tests mutate the linked Supabase project. Reseed before (known state)
// and after (leave the demo clean), per CLAUDE.md.
function seed() {
  execSync("npm run seed --silent", { stdio: "inherit" });
}

export function setup() {
  seed();
}

export function teardown() {
  seed();
}
