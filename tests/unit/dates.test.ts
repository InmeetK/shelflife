import { describe, expect, it } from "vitest";
import { addDays, daysBetween, formatDate, londonToday } from "@/lib/dates";

describe("londonToday", () => {
  it("is already tomorrow at 23:30 UTC during BST", () => {
    expect(londonToday(new Date("2026-07-15T23:30:00Z"))).toBe("2026-07-16");
  });

  it("is still today at 23:30 UTC during GMT", () => {
    expect(londonToday(new Date("2026-01-15T23:30:00Z"))).toBe("2026-01-15");
  });

  it("flips at 23:00 UTC in BST, not before", () => {
    expect(londonToday(new Date("2026-07-15T22:59:59Z"))).toBe("2026-07-15");
    expect(londonToday(new Date("2026-07-15T23:00:00Z"))).toBe("2026-07-16");
  });

  it("flips at 00:00 UTC in GMT", () => {
    expect(londonToday(new Date("2026-12-31T23:59:59Z"))).toBe("2026-12-31");
    expect(londonToday(new Date("2027-01-01T00:00:00Z"))).toBe("2027-01-01");
  });
});

describe("addDays", () => {
  it("crosses month and year boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("is unaffected by the DST change", () => {
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
  });
});

describe("daysBetween", () => {
  it("counts whole days, negative when in the past, across DST", () => {
    expect(daysBetween("2026-11-03", "2026-11-03")).toBe(0);
    expect(daysBetween("2026-11-03", "2026-11-10")).toBe(7);
    expect(daysBetween("2026-11-03", "2026-11-01")).toBe(-2);
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
  });
});

describe("formatDate", () => {
  it("formats UK-style without timezone drift", () => {
    expect(formatDate("2027-03-03")).toBe("3 Mar 2027");
    expect(formatDate("2026-12-31")).toBe("31 Dec 2026");
  });
});
