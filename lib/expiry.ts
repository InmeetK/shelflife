import { addDays, daysBetween } from "./dates";

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

export function expiryLabel(expiry: string | null, today: string): string {
  if (!expiry) return "No date";
  const d = daysBetween(today, expiry);
  if (d < -1) return `Expired ${-d} days ago`;
  if (d === -1) return "Expired yesterday";
  if (d === 0) return "Expires today";
  if (d === 1) return "Expires tomorrow";
  return `Expires in ${d} days`;
}
