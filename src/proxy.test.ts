import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { db, queryResult } from "@tests/mocks/supabase";
import { adminWorkspace, businessId, businessWorkspace, otherBusinessId, workspaceProfile } from "@tests/mocks/workspaces";
import { proxy } from "./proxy";
vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn(() => db) }));
vi.mock("@/lib/supabase/env", () => ({ SUPABASE_URL: "https://test.supabase.co", SUPABASE_KEY: "test-public-key", SUPABASE_CONFIGURED: true }));
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED", "true");
  vi.stubEnv("OPERATIONS_APP_ORIGIN", undefined);
  db.auth.getUser.mockResolvedValue({ data: { user: { id: workspaceProfile.id } }, error: null });
  db.rpc.mockReturnValue(queryResult(businessWorkspace));
});
it("uses the selected membership role, never an admin role from another business", async () => {
  db.from.mockReturnValue(queryResult(adminWorkspace.profile));
  const response = await proxy(new NextRequest("https://app.test/admin/users", { headers: { cookie: `ahaa_business=${businessId}` } }));
  expect(response.headers.get("location")).toBe("https://app.test/test-business/branch/home");
  expect(createServerClient).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ global: { headers: { "x-business-id": businessId } } }));
  expect(db.from).not.toHaveBeenCalled();
});
it("retains the login and requests workspace selection when context is missing", async () => {
  db.rpc.mockReturnValue(queryResult(null, { message: "Choose a workspace" }));
  const response = await proxy(new NextRequest("https://app.test/admin/users"));
  expect(response.headers.get("location")).toBe("https://app.test/workspaces");
  expect(db.auth.signOut).not.toHaveBeenCalled();
});
it("allows an authenticated chooser to recover from an invalid cookie", async () => {
  const response = await proxy(new NextRequest("https://app.test/workspaces", { headers: { cookie: "ahaa_business=invalid" } }));
  expect(response.headers.get("location")).toBeNull();
  expect(db.rpc).not.toHaveBeenCalled();
});
it.each(["/workspaces", "/login?next=/workspaces"])("hides the workspace chooser entry while signed out at %s", async (path) => {
  db.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
  const response = await proxy(new NextRequest(`https://app.test${path}`, { headers: { cookie: `ahaa_business=${businessId}` } }));
  expect(response.status).toBe(404);
  expect(response.headers.get("location")).toBeNull();
});
it("keeps the workspace chooser available after sign-in", async () => {
  const response = await proxy(new NextRequest("https://app.test/login?next=/workspaces"));
  expect(response.headers.get("location")).toBe("https://app.test/workspaces");
});
it("preserves the existing route authorization while business mode is disabled", async () => {
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED", "false");
  db.from.mockReturnValue(queryResult(adminWorkspace.profile));
  const response = await proxy(new NextRequest("https://app.test/admin/users"));
  expect(response.headers.get("location")).toBeNull();
  expect(db.rpc).not.toHaveBeenCalled();
  const scoped = await proxy(new NextRequest("https://app.test/aaha/admin/users"));
  expect(scoped.headers.get("x-middleware-rewrite")).toBeNull();
});
it("keeps the platform console unavailable by default", async () => {
  vi.stubEnv("PLATFORM_CONSOLE_ENABLED", "false");
  expect((await proxy(new NextRequest("https://app.test/superadmin"))).status).toBe(404);
});
it("authorizes platform access independently of customer selection and role", async () => {
  vi.stubEnv("APP_SURFACE", "platform");
  vi.stubEnv("PLATFORM_CONSOLE_ENABLED", "true");
  db.rpc.mockReturnValue(queryResult(true));
  const response = await proxy(new NextRequest("https://app.test/superadmin", { headers: { cookie: "ahaa_business=invalid" } }));
  expect(response.status).toBe(200);
  expect(db.rpc).toHaveBeenCalledWith("platform_is_administrator");
  expect(db.from).not.toHaveBeenCalled();
});
it("does not treat a customer admin as a platform admin", async () => {
  vi.stubEnv("APP_SURFACE", "platform");
  vi.stubEnv("PLATFORM_CONSOLE_ENABLED", "true");
  db.rpc.mockReturnValue(queryResult(false));
  expect((await proxy(new NextRequest("https://app.test/superadmin"))).status).toBe(403);
});
it("keeps business pages and APIs unavailable on the platform deployment", async () => {
  vi.stubEnv("APP_SURFACE", "platform");
  for (const path of ["/admin/orders", "/branch/home", "/employee/inventory", "/workspaces", "/api/admin/branch-users", "/api/receipts", "/api/invoices/order/id/pdf", "/admin/orders/id.pdf"]) {
    expect((await proxy(new NextRequest(`https://app.test${path}`))).status).toBe(404);
  }
  expect(db.auth.getUser).not.toHaveBeenCalled();
});
it("keeps platform pages, login and APIs unavailable on the business deployment even if the console flag is set", async () => {
  vi.stubEnv("APP_SURFACE", "business");
  vi.stubEnv("PLATFORM_CONSOLE_ENABLED", "true");
  for (const path of ["/superadmin", "/login?next=/superadmin", "/api/platform/businesses"]) expect((await proxy(new NextRequest(`https://app.test${path}`))).status).toBe(404);
});
it.each(["GET", "HEAD"])("sends an exact business /superadmin %s request to Operations without forwarding query state", async method => {
  vi.stubEnv("APP_SURFACE", "business");
  vi.stubEnv("OPERATIONS_APP_ORIGIN", "https://operations.test");
  const response = await proxy(new NextRequest("https://app.test/superadmin?next=%2Fbranch%2Fhome&token=demo", { method }));
  expect(response.status).toBe(307);
  expect(response.headers.get("location")).toBe("https://operations.test/superadmin");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(db.auth.getUser).not.toHaveBeenCalled();
});
it.each([
  undefined,
  "malformed",
  "https://app.test",
  "https://operations.test/unexpected",
  "https://operations.test?unexpected=1",
  "https://name:secret@operations.test",
  "http://operations.test",
])("keeps business /superadmin unavailable with invalid or same-origin configuration %s", async origin => {
  vi.stubEnv("APP_SURFACE", "business");
  vi.stubEnv("OPERATIONS_APP_ORIGIN", origin);
  const response = await proxy(new NextRequest("https://app.test/superadmin"));
  expect(response.status).toBe(404);
  expect(response.headers.get("location")).toBeNull();
});
it("does not expose nested Operations pages, API routes, or non-navigation actions on the business deployment", async () => {
  vi.stubEnv("APP_SURFACE", "business");
  vi.stubEnv("OPERATIONS_APP_ORIGIN", "https://operations.test");
  for (const request of [
    new NextRequest("https://app.test/superadmin/businesses"),
    new NextRequest("https://app.test/api/platform/businesses"),
    new NextRequest("https://app.test/login?next=/superadmin"),
    new NextRequest("https://app.test/superadmin", { method: "POST" }),
  ]) {
    const response = await proxy(request);
    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
  }
});
it("uses /superadmin as the operations entry and keeps a bare login unavailable", async () => {
  vi.stubEnv("APP_SURFACE", "platform");
  vi.stubEnv("PLATFORM_CONSOLE_ENABLED", "true");
  vi.stubEnv("OPERATIONS_APP_ORIGIN", "https://operations.test");
  db.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
  expect((await proxy(new NextRequest("https://app.test/"))).headers.get("location")).toBe("https://app.test/superadmin");
  expect((await proxy(new NextRequest("https://app.test/login"))).status).toBe(404);
  const redirect = await proxy(new NextRequest("https://app.test/superadmin"));
  expect(redirect.headers.get("location")).toBe("https://app.test/login?next=%2Fsuperadmin");
});
it("preserves the reset notice when it opens the operations sign-in", async () => {
  vi.stubEnv("APP_SURFACE", "platform");
  const response = await proxy(new NextRequest("https://app.test/login?reset=1"));
  const location = new URL(response.headers.get("location")!);
  expect(location.pathname).toBe("/login");
  expect(location.searchParams.get("next")).toBe("/superadmin");
  expect(location.searchParams.get("reset")).toBe("1");
});
it.each(["", "?error=invalid_link", "?next=/test-business"])("keeps operations password recovery attached to /superadmin for %s", async query => {
  vi.stubEnv("APP_SURFACE", "platform");
  const response = await proxy(new NextRequest(`https://app.test/forgot-password${query}`));
  const location = new URL(response.headers.get("location")!);
  expect(location.pathname).toBe("/forgot-password");
  expect(location.searchParams.get("next")).toBe("/superadmin");
  expect(location.searchParams.get("error")).toBe(new URLSearchParams(query).get("error"));
  expect((await proxy(new NextRequest(location))).headers.get("location")).toBeNull();
});
it("keeps bare login unavailable on the business app and protects against external continuations", async () => {
  vi.stubEnv("APP_SURFACE", "business");
  for (const path of ["/login", "/login?next=https://foreign.test", "/login?next=%2F%2Fforeign.test"]) {
    const response = await proxy(new NextRequest(`https://app.test${path}`));
    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
  }
  expect(db.auth.getUser).not.toHaveBeenCalled();
});
it.each([
  ["/", ""],
  ["/login", ""],
  ["/login?reset=1", "?reset=1"],
  ["/login?activated=1", "?activated=1"],
])("keeps the legacy Ahaa entry reachable at %s", async (path, search) => {
  vi.stubEnv("APP_SURFACE", "business");
  vi.stubEnv("BUSINESS_DEFAULT_SLUG", "ahaa");
  const response = await proxy(new NextRequest(`https://app.test${path}`));
  expect(response.status).toBe(307);
  expect(response.headers.get("location")).toBe(`https://app.test/aaha${search}`);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(db.auth.getUser).not.toHaveBeenCalled();
});
it("leaves explicit login and recovery destinations in charge on the Ahaa deployment", async () => {
  vi.stubEnv("APP_SURFACE", "business");
  vi.stubEnv("BUSINESS_DEFAULT_SLUG", "ahaa");
  db.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
  const contextual = await proxy(new NextRequest("https://app.test/login?next=/other-business&reset=1"));
  expect(contextual.headers.get("location")).toBe("https://app.test/other-business?reset=1");
  for (const path of ["/login?next=/branch/home", "/forgot-password?next=/other-business"]) {
    const response = await proxy(new NextRequest(`https://app.test${path}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  }
});
it("keeps Operations separate even if a default business is configured", async () => {
  vi.stubEnv("APP_SURFACE", "platform");
  vi.stubEnv("BUSINESS_DEFAULT_SLUG", "ahaa");
  const entry = await proxy(new NextRequest("https://app.test/"));
  expect(entry.headers.get("location")).toBe("https://app.test/superadmin");
  expect((await proxy(new NextRequest("https://app.test/login"))).status).toBe(404);
});
it.each(["", "login", "https://foreign.test"])("ignores an unset or invalid default business %s", async slug => {
  vi.stubEnv("APP_SURFACE", "business");
  vi.stubEnv("BUSINESS_DEFAULT_SLUG", slug);
  expect((await proxy(new NextRequest("https://app.test/login"))).status).toBe(404);
  expect((await proxy(new NextRequest("https://app.test/"))).headers.get("location")).toBeNull();
});
it("does not redirect to a named business when workspace routing is disabled", async () => {
  vi.stubEnv("APP_SURFACE", "business");
  vi.stubEnv("BUSINESS_DEFAULT_SLUG", "ahaa");
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED", "false");
  expect((await proxy(new NextRequest("https://app.test/login"))).status).toBe(404);
  expect((await proxy(new NextRequest("https://app.test/"))).headers.get("location")).toBeNull();
});
it("keeps direct business sign-in at the business address", async () => {
  db.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
  const response = await proxy(new NextRequest("https://app.test/test-business"));
  expect(response.status).toBe(200);
  expect(response.headers.get("location")).toBeNull();
});
it.each(["/b", "/b/ahaa", "/b/aaha", "/b/ahaaa", "/b/another-tenant", "/b/login", "/login?next=%2Fb%2Fahaa"])(
  "rejects the retired business address %s before loading any session",
  async path => {
    const response = await proxy(new NextRequest(`https://app.test${path}`, { headers: { cookie: "ahaa_business=invalid" } }));
    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
    expect(db.auth.getUser).not.toHaveBeenCalled();
  },
);
it("supports contextual sign-in via the current business address", async () => {
  const response = await proxy(new NextRequest("https://app.test/login?next=%2Faaha"));
  expect(response.headers.get("location")).toBe("https://app.test/aaha");
});
it("lets a signed-in user reach the business entry without trusting an old selection", async () => {
  const response = await proxy(new NextRequest("https://app.test/test-business", { headers: { cookie: "ahaa_business=invalid" } }));
  expect(response.status).toBe(200);
  expect(db.rpc).not.toHaveBeenCalled();
});
it("allows signed-out users to continue to protected pages or recover without a redirect loop from a stale cookie", async () => {
  db.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
  const protectedPage = await proxy(new NextRequest("https://app.test/branch/inventory", { headers: { cookie: "ahaa_business=invalid" } }));
  expect(protectedPage.headers.get("location")).toBe("https://app.test/login?next=%2Fbranch%2Finventory");
  for (const path of ["/login?next=/branch/inventory", "/login?reset=1"]) {
    const response = await proxy(new NextRequest(`https://app.test${path}`, { headers: { cookie: "ahaa_business=invalid" } }));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  }
});
it("does not expose business entry on the platform deployment", async () => {
  vi.stubEnv("APP_SURFACE", "platform");
  for (const path of ["/test-business", "/b/test-business", "/aaha/admin", "/aaha/branch/inventory"]) {
    expect((await proxy(new NextRequest(`https://app.test${path}`))).status).toBe(404);
  }
});

it.each([
  ["/aaha/admin", "/aaha/admin"],
  ["/aaha/branch", "/aaha/branch"],
  ["/aaha/admin/invoices?tab=combined&_rsc=internal", "/aaha/admin/invoices?tab=combined"],
  ["/aaha/branch/inventory?next=https://foreign.test", "/aaha/branch/inventory"],
])("serves branded sign-in at %s with a safe continuation", async (path, continuation) => {
  db.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
  const response = await proxy(new NextRequest(`https://app.test${path}`, { headers: { cookie: "ahaa_business=invalid" } }));
  const target = new URL(response.headers.get("x-middleware-rewrite")!);
  expect(response.headers.get("location")).toBeNull();
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(target.pathname).toBe("/aaha");
  expect(target.searchParams.get("next")).toBe(continuation);
  expect(db.rpc).not.toHaveBeenCalled();
});

it.each([
  ["CENTRAL_ADMIN", "/aaha/admin/invoices?tab=combined", "/admin/invoices?tab=combined"],
  ["BRANCH_MANAGER", "/aaha/branch/inventory", "/branch/inventory"],
  ["BRANCH_EMPLOYEE", "/aaha/branch/inventory", "/employee/inventory"],
] as const)("serves a signed-in %s from the implementation matching the verified role", async (role, path, implementation) => {
  db.rpc.mockReturnValue(queryResult({
    business: { ...businessWorkspace.business, slug: "ahaa" },
    profile: { ...workspaceProfile, role },
  }));
  const response = await proxy(new NextRequest(`https://app.test${path}`, { headers: { cookie: `ahaa_business=${businessId}` } }));
  expect(response.headers.get("location")).toBeNull();
  expect(response.headers.get("x-middleware-rewrite")).toBe(`https://app.test${implementation}`);
  expect(response.headers.get("cache-control")).toContain("no-store");
});

it.each([
  ["CENTRAL_ADMIN", "/aaha/admin", "/aaha/admin/dashboard"],
  ["BRANCH_MANAGER", "/aaha/branch", "/aaha/branch/home"],
  ["BRANCH_EMPLOYEE", "/aaha/branch", "/aaha/branch/inventory"],
  ["BRANCH_EMPLOYEE", "/aaha/admin/orders", "/aaha/branch/inventory"],
  ["BRANCH_EMPLOYEE", "/aaha/branch/invoices", "/aaha/branch/inventory"],
] as const)("redirects %s from %s to the in-business home if the path is a role entry or unauthorized", async (role, path, home) => {
  db.rpc.mockReturnValue(queryResult({
    business: { ...businessWorkspace.business, slug: "ahaa" },
    profile: { ...workspaceProfile, role },
  }));
  const response = await proxy(new NextRequest(`https://app.test${path}`, { headers: { cookie: `ahaa_business=${businessId}` } }));
  expect(response.headers.get("location")).toBe(`https://app.test${home}`);
  expect(response.headers.get("x-middleware-rewrite")).toBeNull();
});

it.each([
  { ...businessWorkspace.business, slug: "another-business" },
  { ...businessWorkspace.business, id: otherBusinessId, slug: "ahaa" },
])("never renders a tenant page with an unrelated verified workspace", async business => {
  db.rpc.mockReturnValue(queryResult({ business, profile: adminWorkspace.profile }));
  const response = await proxy(new NextRequest("https://app.test/aaha/admin/invoices?tab=combined", { headers: { cookie: `ahaa_business=${businessId}` } }));
  const target = new URL(response.headers.get("x-middleware-rewrite")!);
  expect(target.pathname).toBe("/aaha");
  expect(target.searchParams.get("next")).toBe("/aaha/admin/invoices?tab=combined");
});

it("serves old same-role bookmarks without redirecting an internal rewrite back to itself", async () => {
  db.rpc.mockReturnValue(queryResult({ ...adminWorkspace, business: { ...adminWorkspace.business, slug: "ahaa" } }));
  const response = await proxy(new NextRequest("https://app.test/admin/invoices?tab=combined", { headers: { cookie: `ahaa_business=${businessId}` } }));
  expect(response.headers.get("x-middleware-next")).toBe("1");
  expect(response.headers.get("location")).toBeNull();
});
it("blocks a stale workspace on business APIs while preserving current and legacy requests", async () => {
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED", "true");
  const url = "https://app.test/api/receipts";
  const cookie = `ahaa_business=${businessId}`;
  const stale = await proxy(new NextRequest(url, { headers: { cookie, "x-ahaa-expected-business-id": otherBusinessId } }));
  expect(stale.status).toBe(409);
  expect(stale.headers.get("cache-control")).toContain("no-store");
  const current = await proxy(new NextRequest(url, { headers: { cookie, "x-ahaa-expected-business-id": businessId } }));
  expect(current.headers.get("x-middleware-next")).toBe("1");
  expect((await proxy(new NextRequest(url, { headers: { cookie } }))).headers.get("x-middleware-next")).toBe("1");
});
it("keeps invitation acceptance on the business deployment and protects the page from caching and referrers", async () => {
  vi.stubEnv("APP_SURFACE", "business");
  db.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
  const response = await proxy(new NextRequest("https://app.test/accept-invite"));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  expect(response.headers.get("location")).toBeNull();
  expect(db.auth.getUser).not.toHaveBeenCalled();
});
it("rejects invitation acceptance routes on the platform deployment", async () => {
  vi.stubEnv("APP_SURFACE", "platform");
  for (const path of ["/accept-invite", "/api/onboarding/accept"]) {
    expect((await proxy(new NextRequest(`https://app.test${path}`))).status).toBe(404);
  }
  expect(db.auth.getUser).not.toHaveBeenCalled();
});
