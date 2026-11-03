// RPCs raise friendly messages with these codes; anything else stays generic
// so stack traces and SQL details never reach the user.
const FRIENDLY_CODES = ["22023", "23505", "P0002", "42501"];

export function friendlyRpcError(e: { code?: string; message: string }): string {
  return FRIENDLY_CODES.includes(e.code ?? "") ? e.message : "Something went wrong. Please try again.";
}
