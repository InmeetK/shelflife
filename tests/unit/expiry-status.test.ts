import { describe, expect, it } from "vitest";
import { expiryLabel, expiryStatus } from "@/lib/expiry";

const today = "2026-11-03";

describe("expiryStatus", () => {
  it("is 'none' with no date", () => {
    expect(expiryStatus(null, today, 7)).toBe("none");
  });

  it("is 'expired' strictly before today", () => {
    expect(expiryStatus("2026-11-02", today, 7)).toBe("expired");
    expect(expiryStatus("2025-01-01", today, 7)).toBe("expired");
  });

  it("is 'expiring' from today through today + window (inclusive)", () => {
    expect(expiryStatus("2026-11-03", today, 7)).toBe("expiring");
    expect(expiryStatus("2026-11-10", today, 7)).toBe("expiring");
  });

  it("is 'ok' after the window", () => {
    expect(expiryStatus("2026-11-11", today, 7)).toBe("ok");
  });

  it("respects the shop's window size", () => {
    expect(expiryStatus("2026-11-11", today, 14)).toBe("expiring");
    expect(expiryStatus("2026-11-04", today, 0)).toBe("ok");
  });
});

describe("expiryLabel", () => {
  it("reads naturally", () => {
    expect(expiryLabel("2026-11-01", today)).toBe("Expired 2 days ago");
    expect(expiryLabel("2026-11-02", today)).toBe("Expired yesterday");
    expect(expiryLabel("2026-11-03", today)).toBe("Expires today");
    expect(expiryLabel("2026-11-04", today)).toBe("Expires tomorrow");
    expect(expiryLabel("2026-11-08", today)).toBe("Expires in 5 days");
    expect(expiryLabel(null, today)).toBe("No date");
  });
});
