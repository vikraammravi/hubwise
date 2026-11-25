/** Per-business usage for the superadmin console: counts and dates only, never amounts or records. */
export const USAGE_FEATURES = ["orders", "invoices", "inventory", "catering", "receipts", "catalog"] as const;
export type UsageFeature = typeof USAGE_FEATURES[number];
export const FEATURE_LABELS: Record<UsageFeature, string> = {
  orders: "Orders", invoices: "Invoices", inventory: "Stock counts", catering: "Catering", receipts: "Receipts", catalog: "Catalogue",
};
export const SETUP_STEPS = ["admin_signed_in", "branch_added", "catalog_added", "first_order", "first_invoice"] as const;
export type SetupStep = typeof SETUP_STEPS[number];
export const SETUP_LABELS: Record<SetupStep, string> = {
  admin_signed_in: "Admin signed in", branch_added: "Branch added", catalog_added: "Catalogue added", first_order: "First order", first_invoice: "First invoice",
};
export const AI_SCAN_MAX_MONTHLY = 10000;

export type FeatureUsage = { recent: number; total: number; lastAt: string | null };
export type AiScanUsage = { enabled: boolean; monthlyLimit: number; thisMonth: number; succeeded: number; failed: number; lastScanAt: string | null; months: { month: string; count: number }[] };
export type BusinessUsage = {
  businessId: string;
  lastActivityAt: string | null;
  aiScan: AiScanUsage;
  features: Record<UsageFeature, FeatureUsage>;
  people: { members: number; active7d: number; active30d: number; lastSignInAt: string | null };
  branches: number;
  setup: Record<SetupStep, boolean>;
};

type Raw = Record<string, unknown>;
const object = (value: unknown): Raw => value && typeof value === "object" && !Array.isArray(value) ? value as Raw : {};
const count = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
const date = (value: unknown) => typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;

/** Parses the database payload; anything malformed becomes zero/empty rather than failing the console. */
export function parseBusinessUsage(value: unknown): BusinessUsage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    const row = object(item);
    if (typeof row.business_id !== "string") return [];
    const scan = object(row.ai_scan);
    const features = object(row.features);
    const people = object(row.people);
    const setup = object(row.setup);
    return [{
      businessId: row.business_id,
      lastActivityAt: date(row.last_activity_at),
      aiScan: {
        enabled: scan.enabled !== false,
        monthlyLimit: count(scan.monthly_limit),
        thisMonth: count(scan.this_month), succeeded: count(scan.succeeded), failed: count(scan.failed),
        lastScanAt: date(scan.last_scan_at),
        months: (Array.isArray(scan.months) ? scan.months : []).map(object)
          .filter(entry => typeof entry.month === "string" && /^\d{4}-\d{2}$/.test(entry.month))
          .map(entry => ({ month: entry.month as string, count: count(entry.count) })),
      },
      features: Object.fromEntries(USAGE_FEATURES.map(key => {
        const feature = object(features[key]);
        return [key, { recent: count(feature.recent), total: count(feature.total), lastAt: date(feature.last_at) }];
      })) as Record<UsageFeature, FeatureUsage>,
      people: { members: count(people.members), active7d: count(people.active_7d), active30d: count(people.active_30d), lastSignInAt: date(people.last_sign_in_at) },
      branches: count(row.branches),
      setup: Object.fromEntries(SETUP_STEPS.map(key => [key, setup[key] === true])) as Record<SetupStep, boolean>,
    }];
  });
}

export function setupProgress(usage: Pick<BusinessUsage, "setup">): { done: number; total: number } {
  return { done: SETUP_STEPS.filter(step => usage.setup[step]).length, total: SETUP_STEPS.length };
}

/** Share of the monthly allowance used, 0–1 (1 when the allowance is zero). */
export function scanShare(scan: Pick<AiScanUsage, "thisMonth" | "monthlyLimit">): number {
  return scan.monthlyLimit === 0 ? 1 : Math.min(1, scan.thisMonth / scan.monthlyLimit);
}

/** "Mar" style label for a YYYY-MM key, independent of the viewer's timezone. */
export function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
}

/** Human "3 days ago" relative to `now`; "Never" without a date. */
export function lastSeen(value: string | null, now = Date.now()): string {
  if (!value) return "Never";
  const minutes = Math.max(0, Math.round((now - Date.parse(value)) / 60000));
  if (minutes < 60) return minutes <= 1 ? "Just now" : `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return days === 1 ? "Yesterday" : `${days} days ago`;
  const months = Math.round(days / 30);
  return months < 12 ? `${months} mo ago` : `${Math.round(months / 12)} yr ago`;
}
