import { expect, it } from "vitest";
import { lastSeen, monthLabel, parseBusinessUsage, scanShare, setupProgress } from "./usage-model";

const row = {
  business_id: "b1", last_activity_at: "2026-11-20T10:00:00Z",
  ai_scan: { enabled: false, monthly_limit: 25, this_month: 7, succeeded: 5, failed: 2, last_scan_at: "2026-11-19T10:00:00Z", months: [{ month: "2026-10", count: 3 }, { month: "bad", count: 1 }, { month: "2026-11", count: -4 }] },
  features: { orders: { recent: 4, total: 9, last_at: "2026-11-18T00:00:00Z" }, invoices: { recent: "x", total: 2, last_at: "not a date" } },
  people: { members: 3, active_7d: 2, active_30d: 3, last_sign_in_at: null },
  branches: 2,
  setup: { admin_signed_in: true, branch_added: true, catalog_added: "yes", first_order: true },
};

it("parses usage defensively: malformed values become zero, null or false", () => {
  const [usage] = parseBusinessUsage([row, { no_id: true }, "junk"]);
  expect(parseBusinessUsage([row, { no_id: true }, "junk"])).toHaveLength(1);
  expect(usage.aiScan).toEqual({ enabled: false, monthlyLimit: 25, thisMonth: 7, succeeded: 5, failed: 2, lastScanAt: "2026-11-19T10:00:00Z", months: [{ month: "2026-10", count: 3 }, { month: "2026-11", count: 0 }] });
  expect(usage.features.orders).toEqual({ recent: 4, total: 9, lastAt: "2026-11-18T00:00:00Z" });
  expect(usage.features.invoices).toEqual({ recent: 0, total: 2, lastAt: null });
  expect(usage.features.catering).toEqual({ recent: 0, total: 0, lastAt: null });
  expect(usage.setup).toEqual({ admin_signed_in: true, branch_added: true, catalog_added: false, first_order: true, first_invoice: false });
  expect(setupProgress(usage)).toEqual({ done: 3, total: 5 });
  expect(parseBusinessUsage(null)).toEqual([]);
});

it("treats scanning as on unless explicitly off", () => {
  expect(parseBusinessUsage([{ business_id: "b", ai_scan: {} }])[0].aiScan.enabled).toBe(true);
});

it("caps the allowance share and treats a zero allowance as used", () => {
  expect(scanShare({ thisMonth: 5, monthlyLimit: 20 })).toBe(0.25);
  expect(scanShare({ thisMonth: 50, monthlyLimit: 20 })).toBe(1);
  expect(scanShare({ thisMonth: 0, monthlyLimit: 0 })).toBe(1);
});

it("formats months and relative times", () => {
  expect(monthLabel("2026-01")).toBe("Jan");
  const now = Date.parse("2026-11-25T12:00:00Z");
  expect(lastSeen(null, now)).toBe("Never");
  expect(lastSeen("2026-11-25T11:59:30Z", now)).toBe("Just now");
  expect(lastSeen("2026-11-25T11:30:00Z", now)).toBe("30 min ago");
  expect(lastSeen("2026-11-25T11:00:00Z", now)).toBe("1 h ago");
  expect(lastSeen("2026-11-25T06:00:00Z", now)).toBe("6 h ago");
  expect(lastSeen("2026-11-24T12:00:00Z", now)).toBe("Yesterday");
  expect(lastSeen("2026-11-15T12:00:00Z", now)).toBe("10 days ago");
  expect(lastSeen("2026-08-25T12:00:00Z", now)).toBe("3 mo ago");
});
