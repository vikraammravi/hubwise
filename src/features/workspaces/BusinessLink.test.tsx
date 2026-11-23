import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BusinessLink } from "./BusinessLink";

const navigation = vi.hoisted(() => ({ usePathname: vi.fn() }));
vi.mock("next/navigation", () => navigation);

it.each([
  ["/aaha/admin/orders", "/admin/invoices?tab=invoices#combined", "/aaha/admin/invoices?tab=invoices#combined"],
  ["/spice-route/branch/inventory", "/employee/catering", "/spice-route/branch/catering"],
  ["/branch/home", "/branch/order", "/branch/order"],
  ["/aaha/admin/dashboard", "/api/invoices/combined/test/pdf", "/api/invoices/combined/test/pdf"],
])("keeps navigation tied to the visible business at %s", (pathname, href, expected) => {
  navigation.usePathname.mockReturnValue(pathname);
  render(<BusinessLink href={href}>Continue</BusinessLink>);
  expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute("href", expected);
});
