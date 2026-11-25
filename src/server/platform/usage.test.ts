// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { db, queryResult } from "@tests/mocks/supabase";
import { invitationBusinessId as businessId } from "@tests/mocks/platform-invitations";
import { getBusinessUsage, updateBusinessAiScan } from "./usage";
import * as usageRoute from "@/app/api/platform/usage/route";
import * as aiScanRoute from "@/app/api/platform/businesses/[id]/ai-scan/route";

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServer: vi.fn(() => db) }));
const origin = "https://platform.example";
const context = (id = businessId) => ({ params: Promise.resolve({ id }) });
const patch = (body: unknown, from = origin) => new Request(`${origin}/api/platform/businesses/${businessId}/ai-scan`, {
  method: "PATCH", headers: { origin: from, host: "platform.example", "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body),
});
function rpc(result: ReturnType<typeof queryResult>, admin = true) {
  db.rpc.mockImplementation((name: string) => name === "platform_is_administrator" ? queryResult(admin) : result);
}
beforeEach(() => {
  vi.stubEnv("APP_SURFACE", "platform");
  vi.stubEnv("PLATFORM_CONSOLE_ENABLED", "true");
  db.auth.getUser.mockResolvedValue({ data: { user: { id: "platform-user" } }, error: null });
});

it("exposes the handlers as routes", () => {
  expect(usageRoute.GET).toBe(getBusinessUsage);
  expect(aiScanRoute.PATCH).toBe(updateBusinessAiScan);
});

it("returns parsed usage for platform admins only", async () => {
  rpc(queryResult([{ business_id: businessId, ai_scan: { this_month: 3, monthly_limit: 100 } }]));
  const response = await getBusinessUsage();
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect((await response.json()).usage[0]).toMatchObject({ businessId, aiScan: { thisMonth: 3, monthlyLimit: 100, enabled: true } });
  rpc(queryResult([]), false);
  expect((await getBusinessUsage()).status).toBe(403);
  db.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
  expect((await getBusinessUsage()).status).toBe(401);
});

it("explains when the usage migration is missing without leaking database details", async () => {
  rpc(queryResult(null, { code: "PGRST202", message: "private database detail" } as { message: string }));
  const response = await getBusinessUsage();
  expect(response.status).toBe(503);
  expect(JSON.stringify(await response.json())).not.toContain("private");
});

it("saves a validated AI scan setting", async () => {
  rpc(queryResult({ enabled: false, monthly_limit: 25 }));
  const response = await updateBusinessAiScan(patch({ enabled: false, monthlyLimit: 25 }), context());
  expect(response.status).toBe(200);
  expect(db.rpc).toHaveBeenCalledWith("platform_set_business_ai_scan", { p_business_id: businessId, p_enabled: false, p_monthly_limit: 25 });
});

it.each([
  [{ enabled: "yes", monthlyLimit: 5 }], [{ enabled: true, monthlyLimit: -1 }], [{ enabled: true, monthlyLimit: 10001 }],
  [{ enabled: true, monthlyLimit: 2.5 }], [{ enabled: true }], ["not json"], [[1]],
])("rejects %j without calling the database", async body => {
  rpc(queryResult(null));
  expect((await updateBusinessAiScan(patch(body), context())).status).toBe(400);
  expect(db.rpc.mock.calls.map(([name]) => name)).not.toContain("platform_set_business_ai_scan");
});

it("rejects cross-site requests and bad ids, and maps database errors", async () => {
  rpc(queryResult(null));
  expect((await updateBusinessAiScan(patch({ enabled: true, monthlyLimit: 5 }, "https://evil.example"), context())).status).toBe(403);
  expect((await updateBusinessAiScan(patch({ enabled: true, monthlyLimit: 5 }), context("nope"))).status).toBe(400);
  rpc(queryResult(null, { code: "P0002", message: "missing" } as { message: string }));
  expect((await updateBusinessAiScan(patch({ enabled: true, monthlyLimit: 5 }), context())).status).toBe(404);
});
