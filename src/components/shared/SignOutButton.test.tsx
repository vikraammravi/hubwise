import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignOutButton } from "@/components/shared/SignOutButton";
import { saveBusinessSelection } from "@/features/workspaces/selection";
import { db } from "@tests/mocks/supabase";
import { businessId } from "@tests/mocks/workspaces";

const navigation = vi.hoisted(() => ({ pathname: "/admin/dashboard" }));
vi.mock("next/navigation", async () => {
  const { router: mockRouter } = await import("@tests/mocks/supabase");
  return { usePathname: () => navigation.pathname, useRouter: () => mockRouter };
});

// Sign-out loads the sign-in page in full so no signed-in screen lingers.
const replace = vi.fn();
const realLocation = window.location;
beforeEach(() => { replace.mockClear(); Object.defineProperty(window, "location", { configurable: true, value: { ...realLocation, replace } }); });
afterEach(() => { Object.defineProperty(window, "location", { configurable: true, value: realLocation }); });
afterEach(() => { navigation.pathname = "/admin/dashboard"; saveBusinessSelection(null); vi.unstubAllEnvs(); });

it("sign out without a selected tenant returns to ordinary sign-in",async()=>{
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED", "true");
  render(<SignOutButton/>);await userEvent.click(screen.getByRole("button",{name:"Sign Out"}));expect(db.auth.signOut).toHaveBeenCalled();expect(replace).toHaveBeenCalledWith("/login?next=/admin");
});

it.each([
  ["/aaha/admin/invoices", "/aaha"],
  ["/aaha/branch/inventory", "/aaha"],
])("returns from %s to the business's one sign-in address", async (pathname, destination) => {
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED", "true");
  navigation.pathname = pathname;
  saveBusinessSelection(businessId);
  render(<SignOutButton />);
  await userEvent.click(screen.getByRole("button", { name: "Sign Out" }));
  expect(replace).toHaveBeenCalledWith(destination);
  expect(document.cookie).not.toContain("ahaa_business=");
});

it("returns from a named business entry to its sign-in", async () => {
  navigation.pathname = "/maple-kitchen";
  render(<SignOutButton returnTo="/maple-kitchen" />);
  await userEvent.click(screen.getByRole("button", { name: "Sign Out" }));
  expect(replace).toHaveBeenCalledWith("/maple-kitchen");
});

it("keeps a Superadmin on the Operations sign-in after sign out", async () => {
  navigation.pathname = "/superadmin";
  render(<SignOutButton />);
  await userEvent.click(screen.getByRole("button", { name: "Sign Out" }));
  expect(replace).toHaveBeenCalledWith("/superadmin");
});
