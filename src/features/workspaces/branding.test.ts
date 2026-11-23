import { expect, it } from "vitest";
import { db, queryResult } from "@tests/mocks/supabase";
import { loginBrandingRow } from "@tests/mocks/platform-branding";
import { businessBranding, fetchLoginBranding, safeAccent, safeLogoUrl } from "./branding";

it("accepts only #RRGGBB accents, normalised to lower case", () => {
  expect(safeAccent("#0EA5E9")).toBe("#0ea5e9");
  for (const value of ["red", "#12345", "#1234567", "0ea5e9", "#0ea5e9;background:url(x)", "", null, undefined, 42]) expect(safeAccent(value)).toBeNull();
});

it("accepts only https URLs and site paths as logo sources", () => {
  expect(safeLogoUrl("https://cdn.example.invalid/logo.png")).toBe("https://cdn.example.invalid/logo.png");
  expect(safeLogoUrl("/aaha-logo.png")).toBe("/aaha-logo.png");
  expect(safeLogoUrl("/brand/v2/logo-1.webp")).toBe("/brand/v2/logo-1.webp");
  for (const value of [
    "javascript:alert(1)", "JaVaScRiPt:alert(1)", "http://insecure.example/logo.png", "data:image/png;base64,AAAA", "data:text/html,<script>",
    "blob:https://x/1", "ftp://x/logo.png", "logo.png", "/logo.png?x=1", "/a b.png", "", null, 42, "https://x.example/" + "a".repeat(500),
  ]) expect(safeLogoUrl(value)).toBeNull();
  expect(safeLogoUrl("https://x.example/" + "a".repeat(500 - "https://x.example/".length))).not.toBeNull();
});

// Regression: "//host/path" must not pass as a site path (it loads from another host).
it("rejects protocol-relative URLs that point at another host", () => {
  expect(safeLogoUrl("//evil.example/logo.png")).toBeNull();
});

it("loads sanitised public sign-in branding by slug", async () => {
  db.rpc.mockReturnValue(queryResult(loginBrandingRow));
  const controller = new AbortController();
  expect(await fetchLoginBranding("spice-route", controller.signal)).toEqual({ name: "Spice Route Kitchens", accent: "#0ea5e9", logoUrl: loginBrandingRow.logo_url, palette: "neutral" });
  expect(db.rpc).toHaveBeenCalledWith("business_login_branding", { p_slug: "spice-route" });
  expect(db.rpc.mock.results[0].value.abortSignal).toHaveBeenCalledWith(controller.signal);
});

it("drops unsafe accent and logo values from the database", async () => {
  db.rpc.mockReturnValue(queryResult({ name: "Spice", accent: "red", logo_url: "javascript:alert(1)" }));
  expect(await fetchLoginBranding("spice", new AbortController().signal)).toEqual({ name: "Spice", accent: null, logoUrl: null, palette: "neutral" });
});

it.each([["no row", null], ["no name", { accent: "#000000" }], ["a blank name", { name: "   " }], ["a non-string name", { name: 7 }]])("returns null for %s", async (_label, data) => {
  db.rpc.mockReturnValue(queryResult(data));
  expect(await fetchLoginBranding("unknown", new AbortController().signal)).toBeNull();
});

it("throws a generic error when the lookup fails", async () => {
  db.rpc.mockReturnValue(queryResult(null, { message: "private database detail" }));
  await expect(fetchLoginBranding("spice", new AbortController().signal)).rejects.toThrow("Unable to load sign-in details.");
});

it("keeps the warm palette only when the business is explicitly marked warm", async () => {
  db.rpc.mockReturnValue(queryResult({ ...loginBrandingRow, palette: "warm" }));
  expect((await fetchLoginBranding("ahaa", new AbortController().signal))?.palette).toBe("warm");
  db.rpc.mockReturnValue(queryResult({ ...loginBrandingRow, palette: "WARM" }));
  expect((await fetchLoginBranding("ahaa", new AbortController().signal))?.palette).toBe("neutral");
});

it("reads signed-in branding from business settings with safe fallbacks", () => {
  expect(businessBranding({ name: "Ahaa", settings: { branding: { palette: "warm", logo_url: "/aaha-logo.png", accent: "#F0A020" } } }))
    .toEqual({ name: "Ahaa", accent: "#f0a020", logoUrl: "/aaha-logo.png", palette: "warm" });
  expect(businessBranding({ name: "Spice", settings: { branding: { display_name: "  Spice Route ", logo_url: "//evil.example/x.png", accent: "red" } } }))
    .toEqual({ name: "Spice Route", accent: null, logoUrl: null, palette: "neutral" });
  expect(businessBranding({ name: "Plain", settings: {} })).toEqual({ name: "Plain", accent: null, logoUrl: null, palette: "neutral" });
  expect(businessBranding({ name: "Odd", settings: { branding: ["x"] } })).toEqual({ name: "Odd", accent: null, logoUrl: null, palette: "neutral" });
});
