import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import HomePage from "@/app/page";
import Login from "@/app/login/page";
import TenantPage from "@/app/[slug]/page";
import { BusinessEntryPage } from "@/app/BusinessEntryPage";
import { createSupabaseServer } from "@/lib/supabase/server";
import { db, queryResult, router } from "@tests/mocks/supabase";
import { loginBrandingRow } from "@tests/mocks/platform-branding";

const search = vi.hoisted(() => ({ value: "" }));
vi.mock("next/navigation", async () => {
  const { router: mockRouter } = await import("@tests/mocks/supabase");
  return {
    useRouter: () => mockRouter,
    usePathname: () => "/spice-route",
    useSearchParams: () => new URLSearchParams(search.value),
    notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
    redirect: vi.fn((path: string) => { throw new Error("NEXT_REDIRECT:" + path); }),
  };
});
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServer: vi.fn(() => db) }));
vi.mock("@/features/workspaces/components/BusinessEntry", () => ({
  default: ({ slug }: { slug: string }) => <div>Check membership for {slug}</div>,
}));

const params = (slug: string, next?: string) => ({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({ next }) });

beforeEach(() => {
  search.value = "";
  vi.stubEnv("APP_SURFACE", "business");
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED", "true");
  document.title = "";
});

it("uses the top-level business page; the bare address names no business", async () => {
  const entry = await TenantPage(params("spice-route")) as ReactElement<{ slug: string }>;
  expect(entry.type).toBe(BusinessEntryPage);
  expect(entry.props.slug).toBe("spice-route");
  const { container } = render(HomePage());
  expect(container.textContent).toContain("Open your business's link");
  expect(container.textContent).not.toMatch(/aaha|ahaa|spice/i);
});

it("uses /aaha for the Ahaa workspace's existing slug", async () => {
  const entry = await TenantPage(params("aaha")) as ReactElement<{ slug: string }>;
  expect(entry.props.slug).toBe("ahaa");
  await expect(TenantPage(params("ahaa"))).rejects.toThrow("NEXT_REDIRECT:/aaha");
});

it("denies reserved names, disabled workspaces and tenant pages on operations", async () => {
  await expect(TenantPage(params("login"))).rejects.toThrow("NEXT_NOT_FOUND");
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED", "false");
  await expect(TenantPage(params("spice-route"))).rejects.toThrow("NEXT_NOT_FOUND");
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED", "true");
  vi.stubEnv("APP_SURFACE", "platform");
  await expect(TenantPage(params("spice-route"))).rejects.toThrow("NEXT_NOT_FOUND");
  expect(createSupabaseServer).not.toHaveBeenCalled();
});

it("shows tenant branding at the tenant URL and reloads the same address after sign-in", async () => {
  db.rpc.mockReturnValue(queryResult(loginBrandingRow));
  db.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: "customer-user" } }, error: null });
  const { container } = render(await BusinessEntryPage({ slug: "spice-route", next: null }));
  expect(screen.getByRole("img", { name: "Spice Route Kitchens logo" })).toHaveAttribute("src", loginBrandingRow.logo_url);
  expect(db.rpc).toHaveBeenCalledWith("business_login_branding", { p_slug: "spice-route" });
  expect(createSupabaseServer).toHaveBeenCalledWith({ workspace: false });
  expect(screen.getByRole("heading", { name: "Sign in to Spice Route Kitchens" })).toBeInTheDocument();
  // Just the logo above the title: the name is not repeated under it.
  expect(screen.queryByText("Spice Route Kitchens", { exact: true })).not.toBeInTheDocument();
  expect(screen.queryByAltText(/Aaha/)).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/forgot-password?next=%2Fspice-route");
  expect((container.querySelector(".neutral-surface") as HTMLElement).style.getPropertyValue("--primary")).toBe("#0ea5e9");
  await waitFor(() => expect(document.title).toBe("Sign in · Spice Route Kitchens"));

  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "admin@customer.invalid" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "example-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/spice-route"));
  expect(router.refresh).toHaveBeenCalled();
  expect(db.rpc).toHaveBeenCalledTimes(1);
});

it("checks the selected business membership after authentication rather than showing sign-in again", async () => {
  db.rpc.mockReturnValue(queryResult(loginBrandingRow));
  db.auth.getUser.mockResolvedValue({ data: { user: { id: "customer-user" } }, error: null });
  render(await BusinessEntryPage({ slug: "spice-route", next: null }));
  expect(screen.getByText("Check membership for spice-route")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Sign In" })).not.toBeInTheDocument();
});

it("passes the scoped page to the business entry after entering credentials", async () => {
  db.rpc.mockReturnValue(queryResult(loginBrandingRow));
  db.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: "customer-user" } }, error: null });
  const next = "/spice-route/admin/invoices?tab=invoices#combined";
  render(await BusinessEntryPage({ slug: "spice-route", next }));
  expect(screen.getByRole("heading", { name: "Sign in to Spice Route Kitchens" })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "admin@customer.invalid" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "example-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/spice-route?next=" + encodeURIComponent(next)));
});

it("shows initials and omits unsafe branding values", async () => {
  db.rpc.mockReturnValue(queryResult({ name: "Spice Route", accent: "red;}", logo_url: "javascript:alert(1)" }));
  const { container } = render(await BusinessEntryPage({ slug: "spice-route", next: null }));
  expect(screen.getByText("SR")).toBeInTheDocument();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect((container.querySelector(".neutral-surface") as HTMLElement).getAttribute("style")).toBeNull();
});

it("shows no sign-in for unknown or inactive businesses and suppresses private lookup errors", async () => {
  db.rpc.mockReturnValueOnce(queryResult(null));
  await expect(BusinessEntryPage({ slug: "unknown-tenant", next: null })).rejects.toThrow("NEXT_NOT_FOUND");
  expect(db.auth.getUser).not.toHaveBeenCalled();

  db.rpc.mockReturnValueOnce(queryResult(null, { message: "private database detail" }));
  await expect(BusinessEntryPage({ slug: "spice-route", next: null })).rejects.toThrow("Unable to load sign-in details.");
});

it.each([
  ["admin", "/spice-route/admin/invoices?tab=combined"],
  ["branch", "/spice-route/branch/inventory?date=2026-11-23"],
])("uses the same branded sign-in for %s pages and retains the selected continuation", async (_role, next) => {
  db.rpc.mockReturnValue(queryResult(loginBrandingRow));
  db.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: "customer-user" } }, error: null });
  render(await BusinessEntryPage({ slug: "spice-route", next }));
  expect(screen.getByRole("heading", { name: "Sign in to Spice Route Kitchens" })).toBeVisible();
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "admin@customer.invalid" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "example-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith(`/spice-route?next=${encodeURIComponent(next)}`));
});

it("uses a neutral form for protected-route continuations without a tenant", () => {
  search.value = "next=/admin/dashboard";
  render(<Login />);
  expect(screen.getByLabelText("Email")).toHaveAttribute("placeholder", "you@company.com");
  expect(screen.queryByAltText(/Aaha/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Truly South|kitchen moving/)).not.toBeInTheDocument();
  expect(db.rpc).not.toHaveBeenCalledWith("business_login_branding", expect.anything());
});
