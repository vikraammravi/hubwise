// @vitest-environment node
// Node environment: multipart parsing must produce the same File class the handler checks.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db, queryResult } from "@tests/mocks/supabase";
import { invitationBusinessId as businessId } from "@tests/mocks/platform-invitations";
import { brandingInput, jpegBytes, logoFile, pngBytes, webpBytes } from "@tests/mocks/platform-branding";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { updateBusinessBranding, uploadBusinessLogo } from "./branding";
import * as brandingRoute from "@/app/api/platform/businesses/[id]/branding/route";
import * as logoRoute from "@/app/api/platform/businesses/[id]/branding/logo/route";

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServer: vi.fn(() => db) }));
const bucket = vi.hoisted(() => ({ upload: vi.fn(), getPublicUrl: vi.fn() }));
const privileged = vi.hoisted(() => ({ storage: { from: vi.fn(() => bucket) } }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdmin: vi.fn(() => privileged) }));

const origin = "https://platform.example";
const context = (id = businessId) => ({ params: Promise.resolve({ id }) });
function patch(body: string | object, from = origin) {
  return new Request(`${origin}/api/platform/businesses/${businessId}/branding`, { method: "PATCH", headers: { origin: from, host: "platform.example", "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) });
}
function upload(file?: File | string, { from = origin, contentLength }: { from?: string; contentLength?: string } = {}) {
  const form = new FormData();
  if (file !== undefined) form.append("logo", file);
  const headers: Record<string, string> = { origin: from, host: "platform.example" };
  if (contentLength) headers["content-length"] = contentLength;
  return new Request(`${origin}/api/platform/businesses/${businessId}/branding/logo`, { method: "POST", headers, body: form });
}
const rpcNames = () => db.rpc.mock.calls.map(([name]) => name);
function brandingRpc(result: ReturnType<typeof queryResult>) {
  db.rpc.mockImplementation((name: string) => name === "platform_is_administrator" ? queryResult(true) : result);
}

beforeEach(() => {
  vi.stubEnv("APP_SURFACE", "platform");
  vi.stubEnv("PLATFORM_CONSOLE_ENABLED", "true");
  vi.stubEnv("PLATFORM_BUSINESS_REGISTRATION_ENABLED", "true");
  db.auth.getUser.mockResolvedValue({ data: { user: { id: "platform-user" } }, error: null });
  brandingRpc(queryResult({ display_name: "Spice Route", accent: "#0ea5e9", logo_url: null }));
  db.from.mockReturnValue(queryResult({ id: businessId }));
  privileged.storage.from.mockImplementation(() => bucket);
  bucket.upload.mockResolvedValue({ data: { path: "x" }, error: null });
  bucket.getPublicUrl.mockImplementation((path: string) => ({ data: { publicUrl: `https://storage.example/business-branding/${path}` } }));
});

it("exposes PATCH and POST through the branding routes", () => {
  expect(brandingRoute.PATCH).toBe(updateBusinessBranding);
  expect(logoRoute.POST).toBe(uploadBusinessLogo);
});

describe.each([
  ["updateBusinessBranding", () => updateBusinessBranding(patch(brandingInput), context()), (from: string) => updateBusinessBranding(patch(brandingInput, from), context()), (id: string) => updateBusinessBranding(patch(brandingInput), context(id))],
  ["uploadBusinessLogo", () => uploadBusinessLogo(upload(logoFile(pngBytes)), context()), (from: string) => uploadBusinessLogo(upload(logoFile(pngBytes), { from }), context()), (id: string) => uploadBusinessLogo(upload(logoFile(pngBytes)), context(id))],
] as const)("%s guards", (_name, call, callFrom, callFor) => {
  it("refuses cross-origin requests before the session", async () => {
    expect((await callFrom("https://evil.example")).status).toBe(403);
    expect(db.auth.getUser).not.toHaveBeenCalled();
  });
  it("requires sign-in, platform permission and the platform surface", async () => {
    db.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    expect((await call()).status).toBe(401);
    db.rpc.mockReturnValueOnce(queryResult(false));
    expect((await call()).status).toBe(403);
    vi.stubEnv("APP_SURFACE", "business");
    expect((await call()).status).toBe(404);
    vi.stubEnv("APP_SURFACE", "platform");
    vi.stubEnv("PLATFORM_CONSOLE_ENABLED", "false");
    expect((await call()).status).toBe(404);
    expect(rpcNames()).not.toContain("platform_update_business_branding");
    expect(bucket.upload).not.toHaveBeenCalled();
  });
  it("is unavailable until business registration is enabled", async () => {
    vi.stubEnv("PLATFORM_BUSINESS_REGISTRATION_ENABLED", "false");
    const response = await call();
    expect(response.status).toBe(409);
    expect(rpcNames()).not.toContain("platform_update_business_branding");
    expect(bucket.upload).not.toHaveBeenCalled();
  });
  it("rejects an invalid business id", async () => {
    expect((await callFor("../admin")).status).toBe(400);
    expect(rpcNames()).not.toContain("platform_update_business_branding");
    expect(bucket.upload).not.toHaveBeenCalled();
  });
});

describe("updateBusinessBranding", () => {
  it("saves trimmed values through the platform RPC", async () => {
    const response = await updateBusinessBranding(patch({ displayName: "  Spice Route  ", accent: " #0EA5E9 ", logoUrl: " https://cdn.example/logo.png " }), context());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({ branding: { display_name: "Spice Route", accent: "#0ea5e9", logo_url: null } });
    expect(db.rpc).toHaveBeenCalledWith("platform_update_business_branding", { p_business_id: businessId, p_display_name: "Spice Route", p_accent: "#0EA5E9", p_logo_url: "https://cdn.example/logo.png" });
    expect(db.from).not.toHaveBeenCalled();
  });

  it("treats missing or null fields as cleared", async () => {
    expect((await updateBusinessBranding(patch({ displayName: null }), context())).status).toBe(200);
    expect(db.rpc).toHaveBeenCalledWith("platform_update_business_branding", { p_business_id: businessId, p_display_name: "", p_accent: "", p_logo_url: "" });
  });

  it("accepts an 80-character display name and rejects 81", async () => {
    expect((await updateBusinessBranding(patch({ displayName: "n".repeat(80) }), context())).status).toBe(200);
    const response = await updateBusinessBranding(patch({ displayName: "n".repeat(81) }), context());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Use a display name of 80 characters or fewer." });
  });

  it.each([
    ["a named colour", { accent: "red" }],
    ["a short hex", { accent: "#12345" }],
    ["hex without #", { accent: "4F46E5" }],
    ["an overlong accent", { accent: "#".repeat(21) }],
    ["a non-string name", { displayName: 42 }],
    ["an overlong logo", { logoUrl: "https://x.example/" + "a".repeat(500) }],
    ["an overlong raw name", { displayName: "n".repeat(201) }],
  ])("rejects %s before the RPC", async (_label, body) => {
    expect((await updateBusinessBranding(patch(body), context())).status).toBe(400);
    expect(rpcNames()).not.toContain("platform_update_business_branding");
  });

  it("explains the colour format", async () => {
    expect(await (await updateBusinessBranding(patch({ accent: "blue" }), context())).json()).toEqual({ error: "Choose a colour like #4F46E5." });
  });

  it.each([["invalid JSON", "{"], ["an array", "[]"], ["null", "null"], ["a string", "\"x\""]])("rejects %s", async (_label, body) => {
    const response = await updateBusinessBranding(patch(body), context());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid branding details." });
  });

  it("rejects bodies over 4096 characters", async () => {
    expect((await updateBusinessBranding(patch(JSON.stringify({ displayName: "x", padding: "p".repeat(4100) })), context())).status).toBe(413);
    expect(rpcNames()).not.toContain("platform_update_business_branding");
  });

  it.each([
    ["22023", 400, "Check the display name, colour and logo."],
    ["P0002", 404, "Business not found."],
    ["42501", 403, "Platform access is required."],
    ["XX000", 503, "Unable to update branding. Please try again."],
  ])("maps RPC error %s to a safe response", async (code, status, message) => {
    brandingRpc(queryResult(null, { message: "private database detail", code } as { message: string }));
    const response = await updateBusinessBranding(patch(brandingInput), context());
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: message });
  });
});

describe("uploadBusinessLogo", () => {
  it.each([
    ["image/png", pngBytes, "png"],
    ["image/jpeg", jpegBytes, "jpg"],
    ["image/webp", webpBytes, "webp"],
  ])("stores a %s logo under the business folder and returns its public URL", async (type, bytes, ext) => {
    const response = await uploadBusinessLogo(upload(logoFile(bytes, type)), context());
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(db.from).toHaveBeenCalledWith("businesses");
    expect(privileged.storage.from).toHaveBeenCalledWith("business-branding");
    const [path, stored, options] = bucket.upload.mock.calls[0];
    expect(path).toMatch(new RegExp(`^${businessId}/[0-9a-f-]{36}\\.${ext}$`));
    expect(Array.from(stored as Uint8Array)).toEqual(Array.from(bytes));
    expect(options).toEqual({ contentType: type, upsert: false, cacheControl: "31536000" });
    expect(await response.json()).toEqual({ logoUrl: `https://storage.example/business-branding/${path}` });
  });

  it("uses a fresh object name for every upload", async () => {
    await uploadBusinessLogo(upload(logoFile(pngBytes)), context());
    await uploadBusinessLogo(upload(logoFile(pngBytes)), context());
    expect(bucket.upload.mock.calls[0][0]).not.toBe(bucket.upload.mock.calls[1][0]);
  });

  it.each([
    ["no file", undefined],
    ["a text field", "not a file"],
    ["an empty file", logoFile(new Uint8Array(), "image/png")],
  ])("asks for a logo file when given %s", async (_label, file) => {
    const response = await uploadBusinessLogo(upload(file), context());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Choose a logo file." });
    expect(bucket.upload).not.toHaveBeenCalled();
  });

  it("accepts exactly 512 KB and rejects one byte more", async () => {
    const exact = new Uint8Array(512 * 1024); exact.set(pngBytes);
    expect((await uploadBusinessLogo(upload(logoFile(exact)), context())).status).toBe(201);
    const over = new Uint8Array(512 * 1024 + 1); over.set(pngBytes);
    const response = await uploadBusinessLogo(upload(logoFile(over)), context());
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "Use a logo of 512 KB or smaller." });
    expect(bucket.upload).toHaveBeenCalledTimes(1);
  });

  it("rejects a declared content length above the limit before reading the body", async () => {
    expect((await uploadBusinessLogo(upload(logoFile(pngBytes), { contentLength: String(512 * 1024 + 16 * 1024 + 1) }), context())).status).toBe(413);
    expect(bucket.upload).not.toHaveBeenCalled();
  });

  it.each([
    ["an unsupported type", logoFile(pngBytes, "image/gif")],
    ["an SVG", logoFile(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"), "image/svg+xml")],
    ["PNG type with JPEG bytes", logoFile(jpegBytes, "image/png")],
    ["JPEG type with PNG bytes", logoFile(pngBytes, "image/jpeg")],
    ["WebP type with RIFF but not WEBP", logoFile(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20]), "image/webp")],
    ["HTML disguised as PNG", logoFile(new TextEncoder().encode("<html><script>alert(1)</script>"), "image/png")],
  ])("rejects %s with 415", async (_label, file) => {
    const response = await uploadBusinessLogo(upload(file), context());
    expect(response.status).toBe(415);
    expect(await response.json()).toEqual({ error: "Use a PNG, JPEG or WebP image." });
    expect(bucket.upload).not.toHaveBeenCalled();
  });

  it("returns 404 for a business the platform cannot see", async () => {
    db.from.mockReturnValue(queryResult(null));
    expect((await uploadBusinessLogo(upload(logoFile(pngBytes)), context())).status).toBe(404);
    expect(createSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("fails safely when the business lookup errors", async () => {
    db.from.mockReturnValue(queryResult(null, { message: "private database detail" }));
    const response = await uploadBusinessLogo(upload(logoFile(pngBytes)), context());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private");
  });

  it("reports missing storage configuration", async () => {
    vi.mocked(createSupabaseAdmin).mockImplementationOnce(() => { throw new Error("private key missing"); });
    const response = await uploadBusinessLogo(upload(logoFile(pngBytes)), context());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Logo upload is not configured." });
  });

  it("reports a storage failure without details", async () => {
    bucket.upload.mockResolvedValue({ data: null, error: { message: "private storage detail" } });
    const response = await uploadBusinessLogo(upload(logoFile(pngBytes)), context());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "The logo could not be uploaded. Please try again." });
    expect(bucket.getPublicUrl).not.toHaveBeenCalled();
  });
});
