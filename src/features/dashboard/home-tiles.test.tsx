import { expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import AdminDashboard from "@/features/dashboard/screens/AdminDashboardScreen";
import BranchHome from "@/features/dashboard/screens/BranchDashboardScreen";
import { fetchAdminAttention, fetchBranchAttention } from "@/features/dashboard/attention-data";
import { db, queryResult } from "@tests/mocks/supabase";
import { branchDashboard } from "@tests/mocks/branch-dashboard";
import { item, profile, workspace } from "@tests/mocks/fixtures";

const summary = { ordersToday: 3, pendingOrders: 2, revenueToday: 150, lowStock: 1, lowItems: [item], recentOrders: [], businessDate: "2026-10-12" };
const counts: Record<string, number> = { orders: 6, pickup_requests: 1, catering_events: 2, weekly_invoices: 4, purchase_receipts: 5 };
const tile = (area: string, name: RegExp) => within(screen.getByRole("navigation", { name: area })).getByRole("link", { name });

it("opens the admin home on tiles that show what needs attention", async () => {
  db.rpc.mockReturnValue(queryResult(summary));
  db.from.mockImplementation((table: string) => queryResult(null, null, counts[table] ?? 0));
  render(<AdminDashboard />);
  expect(await screen.findByRole("heading", { name: "Home" })).toBeVisible();
  expect(await within(screen.getByRole("navigation", { name: "Admin areas" })).findByText("1 pickup request")).toBeVisible();
  expect(tile("Admin areas", /Branch Orders/)).toHaveAttribute("href", "/admin/orders");
  expect(tile("Admin areas", /Branch Orders/)).toHaveAccessibleName("Branch Orders, 1 pickup request. Review, prepare and confirm pickups");
  expect(tile("Admin areas", /Daily Stock/)).toHaveTextContent("1 low");
  expect(tile("Admin areas", /Branch Invoices/)).toHaveTextContent("4 to send");
  expect(tile("Admin areas", /Catering/)).toHaveTextContent("2 this week");
  expect(tile("Admin areas", /Vendor Invoices/)).toHaveTextContent("5 to review");
  expect(tile("Admin areas", /Catalog/)).not.toHaveTextContent(/\d/);
  expect(within(screen.getByRole("navigation", { name: "Admin areas" })).getAllByRole("link")).toHaveLength(9);
  expect(screen.getByText("CA$150.00")).toBeVisible();
});

it("shows branch tiles, including whether today's order is placed", async () => {
  db.auth.getUser.mockResolvedValue({ data: { user: { id: profile.id } }, error: null });
  db.from.mockImplementation((table: string) => table === "profiles" ? queryResult(profile) : queryResult(null, null, table === "weekly_invoices" ? 2 : 0));
  db.rpc.mockImplementation((name: string) => queryResult(name === "branch_dashboard_summary" ? { ...branchDashboard, todaysOrder: null } : workspace));
  render(<BranchHome />);
  expect(await screen.findByText("Not placed")).toBeVisible();
  expect(tile("Branch areas", /Place Order/)).toHaveAttribute("href", "/branch/order");
  expect(await within(tile("Branch areas", /^Orders/)).findByText("2 unpaid")).toBeVisible();
  expect(tile("Branch areas", /^Orders/)).toHaveAttribute("href", "/branch/invoices?tab=invoices");
  expect(tile("Branch areas", /Catering/)).toHaveTextContent("7 upcoming");
  expect(screen.queryByText(/Order before/)).not.toBeInTheDocument();
});

it("keeps a count unknown instead of failing when one query errors", async () => {
  db.from.mockImplementation((table: string) => table === "weekly_invoices" ? queryResult(null, { message: "denied" }) : queryResult(null, null, 3));
  const admin = await fetchAdminAttention(new AbortController().signal);
  expect(admin).toEqual({ openOrders: 3, pickupRequests: 3, cateringThisWeek: 3, invoicesToSend: null, receiptsToReview: 3 });
  const branch = await fetchBranchAttention("branch-id", new AbortController().signal);
  expect(branch).toEqual({ unpaidInvoices: null, receiptsToReview: 3 });
});

it("counts open orders on every date when no pickup request is waiting", async () => {
  db.rpc.mockReturnValue(queryResult({ ...summary, pendingOrders: 0 }));
  db.from.mockImplementation((table: string) => queryResult(null, null, table === "orders" ? 4 : 0));
  render(<AdminDashboard />);
  expect(await within(screen.getByRole("navigation", { name: "Admin areas" })).findByText("4 open")).toBeVisible();
});
