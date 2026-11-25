import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { AdminShell } from "@/components/admin/AdminShell";
import { BranchShell } from "@/components/branch/BranchShell";
import { EmployeeShell } from "@/components/employee/EmployeeShell";

const route = vi.hoisted(() => ({ pathname: "/admin/orders" }));
vi.mock("next/navigation", async importOriginal => ({
  ...await importOriginal<typeof import("next/navigation")>(),
  usePathname: () => route.pathname,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
beforeEach(() => { route.pathname = "/admin/orders"; });

function openAccountMenu() {
  const trigger = screen.getByRole("button", { name: /^Account menu for/ });
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
  return screen.getByRole("menu");
}

it.each([AdminShell, BranchShell, EmployeeShell])("puts profile and sign out in the header menu, never in navigation", async Shell => {
  render(<Shell><p>Page content</p></Shell>);
  expect(screen.getByText("Page content")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Change Password" })).not.toBeInTheDocument();
  for (const nav of screen.getAllByRole("navigation")) {
    expect(within(nav).queryByText(/Sign out|My Profile/i)).not.toBeInTheDocument();
  }
  const menu = openAccountMenu();
  expect(within(menu).getByRole("menuitem", { name: "My Profile" })).toHaveAttribute("href", expect.stringMatching(/\/profile$/));
  expect(within(menu).getByRole("menuitem", { name: "Sign out" })).toBeInTheDocument();
});

it("hides the sidebar on the admin Home page and shows it inside a section", () => {
  route.pathname = "/admin/dashboard";
  const { unmount } = render(<AdminShell><p>Home</p></AdminShell>);
  expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Open menu" })).not.toBeInTheDocument();
  unmount();
  route.pathname = "/admin/orders";
  render(<AdminShell><p>Orders</p></AdminShell>);
  const navigation = within(screen.getByRole("complementary")).getAllByRole("navigation");
  const links = within(navigation[0]).getAllByRole("link");
  expect(links[0]).toHaveTextContent("Home");
  expect(links[0]).toHaveAttribute("href", "/admin/dashboard");
  expect(screen.getByRole("banner")).toHaveTextContent("Branch Orders");
  expect(screen.getByRole("button", { name: "Open menu" })).toBeInTheDocument();
});

it("treats the business-scoped Home address as Home too", () => {
  route.pathname = "/branch/home";
  render(<BranchShell><p>Home</p></BranchShell>);
  expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
});

it.each([BranchShell, EmployeeShell])("branch role sidebar icons match admin's inventory and catering icons", Shell => {
  route.pathname = "/branch/inventory";
  render(<Shell><p>Page content</p></Shell>);
  const sidebar = within(screen.getByRole("complementary"));
  expect(sidebar.getByRole("link", { name: "Catering" }).querySelector("svg")).toHaveClass("lucide-utensils-crossed");
  expect(sidebar.getByRole("link", { name: /Inventory/ }).querySelector("svg")).toHaveClass("lucide-package");
});

it.each([BranchShell, EmployeeShell])("branch roles use bottom navigation without a mobile sidebar menu", Shell => {
  route.pathname = "/branch/inventory";
  render(<Shell><p>Page content</p></Shell>);
  expect(screen.queryByRole("button", { name: "Open menu" })).not.toBeInTheDocument();
  const mobileNav = screen.getAllByRole("navigation").find(nav => nav.classList.contains("fixed"));
  expect(mobileNav).toBeDefined();
  expect(within(mobileNav!).getByRole("link", { name: /Inventory/ })).toBeVisible();
});

it("names the section in the header and keeps only a screen-reader heading on the page", async () => {
  route.pathname = "/admin/stock";
  const { PageHeader } = await import("./PageHeader");
  render(<AdminShell><PageHeader title="Daily Stock" subtitle="Stock updates every 5 seconds." /></AdminShell>);
  expect(screen.getAllByRole("banner")[0]).toHaveTextContent("Daily Stock");
  expect(screen.getByRole("heading", { level: 1, name: "Daily Stock" })).toHaveClass("sr-only");
  expect(screen.queryByText("Stock updates every 5 seconds.")).not.toBeInTheDocument();
});

it("keeps the page's own heading on Home, where the header shows no section", async () => {
  route.pathname = "/admin/dashboard";
  const { PageHeader } = await import("./PageHeader");
  render(<AdminShell><PageHeader title="Home" /></AdminShell>);
  expect(screen.getByRole("heading", { level: 1, name: "Home" })).not.toHaveClass("sr-only");
});

it("keeps Home centred in the branch bar and puts further sections under More", () => {
  route.pathname = "/branch/catering";
  render(<BranchShell><p>Catering</p></BranchShell>);
  const bar = within(screen.getByRole("navigation", { name: "Sections" }));
  const slots = bar.getAllByRole("link").map(link => link.textContent).concat(bar.getAllByRole("button").map(button => button.textContent));
  expect(slots).toEqual(["Place Order", "Orders", "Home", "Inventory", "More"]);
  expect(bar.queryByRole("link", { name: /Catering/ })).not.toBeInTheDocument();
  fireEvent.click(bar.getByRole("button", { name: "More" }));
  const panel = within(screen.getByRole("dialog", { name: "More" }));
  expect(panel.getByRole("link", { name: "Catering" })).toHaveAttribute("aria-current", "page");
  expect(panel.getByRole("link", { name: "Vendor Invoices" })).toHaveAttribute("href", "/branch/receipts");
});
