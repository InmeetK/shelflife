// All "today" logic goes through here so dates don't flip at 23:00 UTC in BST.
// Dates are ISO `YYYY-MM-DD` strings, matching Postgres `date` columns.

const londonParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function londonToday(now: Date = new Date()): string {
  const parts = Object.fromEntries(londonParts.formatToParts(now).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
