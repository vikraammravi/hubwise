import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DELETE, PATCH } from "@/app/api/platform/businesses/[id]/route";
import { db, queryResult } from "@tests/mocks/supabase";
import { businessId } from "@tests/mocks/workspaces";

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServer: vi.fn(() => db) }));

const url = `https://ops.example.test/api/platform/businesses/${businessId}`;
const context = { params: Promise.resolve({ id: businessId }) };

function request(method: string, action?: string, origin = "https://ops.example.test") {
  return new Request(url, {
    method,
    headers: { origin, "Content-Type": "application/json" },
    body: action === undefined ? undefined : JSON.stringify({ action }),
  });
}

beforeEach(() => {
  vi.stubEnv("APP_SURFACE", "platform");
  vi.stubEnv("PLATFORM_CONSOLE_ENABLED", "true");
  vi.stubEnv("PLATFORM_BUSINESS_LIFECYCLE_ENABLED", "true");
  db.auth.getUser.mockResolvedValue({ data: { user: { id: "platform-user" } }, error: null });
  db.rpc.mockImplementation(name => queryResult(name === "platform_is_administrator" ? true : { id: businessId }));
});
afterEach(() => vi.unstubAllEnvs());

it("requires a trusted origin and platform access before deletion", async () => {
  expect((await DELETE(request("DELETE", undefined, "https://other.test"), context)).status).toBe(403);
  db.rpc.mockReturnValue(queryResult(false));
  expect((await DELETE(request("DELETE"), context)).status).toBe(403);
  expect(db.rpc).not.toHaveBeenCalledWith("platform_delete_business", expect.anything());
});

it("deletes through the guarded RPC and reports a business with records as a conflict", async () => {
  expect((await DELETE(request("DELETE"), context)).ok).toBe(true);
  expect(db.rpc).toHaveBeenCalledWith("platform_delete_business", { p_business_id: businessId });
  db.rpc.mockImplementation(name => name === "platform_is_administrator"
    ? queryResult(true)
    : queryResult(null, { code: "55000", message: "private database detail" } as { message: string }));
  const blocked = await DELETE(request("DELETE"), context);
  expect(blocked.status).toBe(409);
  expect(JSON.stringify(await blocked.json())).not.toContain("private database detail");
});

it.each([["suspend", true], ["restore", false]])("validates and forwards access action %s", async (action, suspended) => {
  expect((await PATCH(request("PATCH", "purge"), context)).status).toBe(400);
  expect((await PATCH(request("PATCH", action), context)).ok).toBe(true);
  expect(db.rpc).toHaveBeenCalledWith("platform_set_business_access", {
    p_business_id: businessId,
    p_suspended: suspended,
  });
});
