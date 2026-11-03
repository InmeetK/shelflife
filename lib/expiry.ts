import { addDays } from "./dates";

export type ExpiryStatus = "expired" | "expiring" | "ok" | "none";

/**
 * expired: before today. expiring: today through today + windowDays.
 * The best-before day itself is still sellable, so it counts as expiring.
 */
export function expiryStatus(expiry: string | null, today: string, windowDays: number): ExpiryStatus {
  if (!expiry) return "none";
  if (expiry < today) return "expired";
  if (expiry <= addDays(today, windowDays)) return "expiring";
  return "ok";
}
