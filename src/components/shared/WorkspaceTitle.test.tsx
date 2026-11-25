import { renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useWorkspaceTitle } from "./WorkspaceBrand";

const current = vi.hoisted(() => ({ business: null as null | { id: string; name: string; slug: string; settings: Record<string, unknown> } }));
const route = vi.hoisted(() => ({ pathname: "/aaha/admin/dashboard" }));
vi.mock("@/lib/useCurrentUser", () => ({ useCurrentUser: () => ({ business: current.business }) }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

beforeEach(() => { document.title = "Hubwise"; current.business = null; route.pathname = "/aaha/admin/dashboard"; });

it("names the tab after the signed-in business, preferring its display name", () => {
  current.business = { id: "b", name: "Ahaa", slug: "ahaa", settings: {} };
  const { rerender } = renderHook(() => useWorkspaceTitle());
  expect(document.title).toBe("Ahaa");
  current.business = { id: "s", name: "Spice Route Kitchens", slug: "spice-route", settings: { branding: { display_name: "Spice Route" } } };
  rerender();
  expect(document.title).toBe("Spice Route");
});

it("restores the business name after navigation resets the title", () => {
  current.business = { id: "b", name: "Ahaa", slug: "ahaa", settings: {} };
  const { rerender } = renderHook(() => useWorkspaceTitle());
  document.title = "Hubwise";
  route.pathname = "/aaha/admin/orders";
  rerender();
  expect(document.title).toBe("Ahaa");
});

it("leaves the title alone without a business", () => {
  renderHook(() => useWorkspaceTitle());
  expect(document.title).toBe("Hubwise");
});

it("puts the business name back when the page metadata rewrites the title later", async () => {
  current.business = { id: "b", name: "Ahaa", slug: "ahaa", settings: {} };
  const { unmount } = renderHook(() => useWorkspaceTitle());
  document.title = "Hubwise";
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(document.title).toBe("Ahaa");
  unmount();
  document.title = "Hubwise";
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(document.title).toBe("Hubwise");
});
