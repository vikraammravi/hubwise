import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import Login from "@/app/login/page";
import { db, queryResult } from "@tests/mocks/supabase";
import { loginBrandingRow } from "@tests/mocks/platform-branding";

// A business's own sign-in page is reached as /login?next=/b/<slug>.
const search = vi.hoisted(() => ({ value: "next=/b/spice-route" }));
vi.mock("next/navigation", async () => {
  const { router: mockRouter } = await import("@tests/mocks/supabase");
  return { useRouter: () => mockRouter, usePathname: () => "/login", useSearchParams: () => new URLSearchParams(search.value) };
});
const year = new Date().getFullYear();
beforeEach(() => {
  search.value = "next=/b/spice-route";
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED", "true");
  document.title = "";
});
const ahaaBranding = () => [screen.queryByAltText(/Aaha/), screen.queryByLabelText("Aaha Central"), screen.queryByText(/Truly South/)];

it("shows the business's own brand, never Ahaa's", async () => {
  db.rpc.mockReturnValue(queryResult(loginBrandingRow));
  const { container } = render(<Login />);
  expect(await screen.findByRole("img", { name: "Spice Route Kitchens logo" })).toHaveAttribute("src", loginBrandingRow.logo_url);
  expect(db.rpc).toHaveBeenCalledWith("business_login_branding", { p_slug: "spice-route" });
  expect(screen.getByText("Sign in to Spice Route Kitchens.")).toBeInTheDocument();
  expect(screen.getByText(`© ${year} Spice Route Kitchens`)).toBeInTheDocument();
  await waitFor(() => expect(document.title).toBe("Sign in · Spice Route Kitchens"));
  expect(ahaaBranding()).toEqual([null, null, null]);
  expect(screen.getByLabelText("Email")).toHaveAttribute("placeholder", "you@company.com");
  const shell = container.querySelector(".neutral-surface") as HTMLElement;
  expect(shell).not.toBeNull();
  expect(shell.style.getPropertyValue("--primary")).toBe("#0ea5e9");
  expect(shell.style.getPropertyValue("--ring")).toBe("#0ea5e9");
  expect(shell.style.getPropertyValue("--saffron-hover")).toBe("#0ea5e9");
});

it("shows initials and no injected styles when the stored values are unsafe", async () => {
  db.rpc.mockReturnValue(queryResult({ name: "Spice Route", accent: "red;}", logo_url: "javascript:alert(1)" }));
  const { container } = render(<Login />);
  expect(await screen.findByText("SR")).toBeInTheDocument();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect((container.querySelector(".neutral-surface") as HTMLElement).getAttribute("style")).toBeNull();
});

it.each([
  ["an unknown or inactive business", () => db.rpc.mockReturnValue(queryResult(null))],
  ["a failed lookup", () => db.rpc.mockReturnValue(queryResult(null, { message: "private database detail" }))],
])("shows a neutral page with no logo for %s", async (_label, arrange) => {
  arrange();
  const { container } = render(<Login />);
  await waitFor(() => expect(db.rpc).toHaveBeenCalledWith("business_login_branding", { p_slug: "spice-route" }));
  await waitFor(() => expect(document.title).toBe("Sign in"));
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(ahaaBranding()).toEqual([null, null, null]);
  expect(screen.getByText("Sign in to keep the kitchen moving.")).toBeInTheDocument();
  expect(container.querySelector(".neutral-surface")).not.toBeNull();
  expect(screen.queryByText(/private/)).not.toBeInTheDocument();
  expect(screen.getByLabelText("Email")).toHaveAttribute("placeholder", "you@company.com");
});

it("does not look up business branding when workspaces are off or the next path is not a business entry", async () => {
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED", "false");
  const { unmount } = render(<Login />);
  expect(screen.getByLabelText("Aaha Central")).toBeInTheDocument();
  unmount();
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED", "true");
  for (const value of ["", "next=/admin/dashboard", "next=/b/Bad_Slug", "next=/b/spice-route/extra"]) {
    search.value = value;
    const view = render(<Login />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("placeholder", "you@aaha.com");
    expect(screen.getByText(new RegExp(`© ${year} Aaha Central`))).toBeInTheDocument();
    view.unmount();
  }
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(db.rpc).not.toHaveBeenCalledWith("business_login_branding", expect.anything());
  expect(document.title).toBe("");
});
