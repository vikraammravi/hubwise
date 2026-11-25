import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminHome from "@/features/dashboard/screens/AdminDashboardScreen";
import { db, queryResult } from "@tests/mocks/supabase";
import { item } from "@tests/mocks/fixtures";

const summary = { ordersToday: 3, pendingOrders: 2, revenueToday: 150, lowStock: 1, lowItems: [item], recentOrders: [], businessDate: "2026-10-12" };

it("Home is tiles only, with a one-line greeting and no separate figures, previews or summary", async () => {
  db.rpc.mockReturnValue(queryResult(summary));
  db.from.mockImplementation(() => queryResult(null, null, 0));
  render(<AdminHome />);
  const stock = await screen.findByRole("link", { name: /^Daily Stock, 1 low/ });
  expect(stock).not.toHaveTextContent(item.name);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/^Good (morning|afternoon|evening)/);
  expect(screen.queryByText("CA$150.00")).not.toBeInTheDocument();
  expect(screen.queryByText(/Today's Summary|Orders Today|Revenue Today/)).not.toBeInTheDocument();
});
