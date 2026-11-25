import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { platformBusinesses } from "@tests/mocks/platform";
import { fetchBusinessUsage, updateBusinessAiScan } from "../data";
import { parseBusinessUsage } from "../usage-model";
import { UsageView } from "./UsageView";

vi.mock("../data", async importOriginal => ({ ...await importOriginal<typeof import("../data")>(), fetchBusinessUsage: vi.fn(), updateBusinessAiScan: vi.fn() }));

const business = { ...platformBusinesses[1], id: "11111111-1111-4111-8111-111111111111", name: "Spice Route", status: "active" as const };
const usage = (scan: Record<string, unknown>) => parseBusinessUsage([{
  business_id: business.id, last_activity_at: "2026-11-24T12:00:00Z",
  ai_scan: { enabled: true, monthly_limit: 10, this_month: 9, succeeded: 8, failed: 1, months: [{ month: "2026-10", count: 4 }, { month: "2026-11", count: 9 }], ...scan },
  features: { orders: { recent: 12, total: 40, last_at: "2026-11-24T10:00:00Z" } },
  people: { members: 4, active_7d: 3, active_30d: 4 }, branches: 2,
  setup: { admin_signed_in: true, branch_added: true, catalog_added: true, first_order: true, first_invoice: false },
}]);
beforeEach(() => {
  vi.mocked(fetchBusinessUsage).mockResolvedValue({ usage: usage({}), generatedAt: "2026-11-25T12:00:00Z" });
  vi.mocked(updateBusinessAiScan).mockResolvedValue();
});

it("summarises scans, setup and feature usage per business without amounts", async () => {
  render(<UsageView businesses={[business]} canManage />);
  const card = within((await screen.findByRole("heading", { name: "Spice Route" })).closest("li")!);
  expect(card.getByText("4/5")).toBeInTheDocument();
  expect(card.getByText(/of 10 this month/)).toBeInTheDocument();
  expect(card.getByText("No scans yet")).toBeInTheDocument();
  expect(card.getByText("Near allowance")).toBeInTheDocument();
  expect(card.getByRole("meter", { name: "AI scans used this month by Spice Route" })).toHaveAttribute("aria-valuenow", "9");
  expect(card.getByText("Orders").closest("li")).toHaveTextContent("12 · yesterday");
  expect(card.getByText("Catering").closest("li")).toHaveTextContent("Not used yet");
  expect(screen.getByRole("region", { name: "Usage summary" })).toHaveTextContent("AI scans this month9");
  expect(screen.getByRole("table", { name: "AI scans per month across all businesses" })).toHaveTextContent("Nov 20269");
  expect(document.body.textContent).not.toMatch(/\$/);
});

it("shows scanning as off and lets a superadmin change it", async () => {
  vi.mocked(fetchBusinessUsage).mockResolvedValue({ usage: usage({ enabled: false, this_month: 0 }), generatedAt: "2026-11-25T12:00:00Z" });
  render(<UsageView businesses={[business]} canManage />);
  await screen.findByRole("heading", { name: "Spice Route" });
  fireEvent.click(screen.getByRole("button", { name: "Manage AI scanning for Spice Route" }));
  expect(screen.getByText("Off")).toBeInTheDocument();
  const dialog = within(screen.getByRole("dialog"));
  fireEvent.click(dialog.getByRole("checkbox"));
  fireEvent.change(dialog.getByLabelText("Monthly allowance"), { target: { value: "abc" } });
  fireEvent.click(dialog.getByRole("button", { name: "Save" }));
  expect(await dialog.findByText(/whole number/)).toBeInTheDocument();
  expect(updateBusinessAiScan).not.toHaveBeenCalled();
  fireEvent.change(dialog.getByLabelText("Monthly allowance"), { target: { value: "50" } });
  fireEvent.click(dialog.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(updateBusinessAiScan).toHaveBeenCalledWith(business.id, { enabled: true, monthlyLimit: 50 }));
  expect(await screen.findByText("AI scanning updated for Spice Route.")).toBeInTheDocument();
});

it("hides the control when management is not allowed", async () => {
  render(<UsageView businesses={[business]} canManage={false} />);
  await screen.findByRole("heading", { name: "Spice Route" });
  expect(screen.queryByRole("button", { name: /Manage AI scanning/ })).not.toBeInTheDocument();
});

it("shows an error with retry when usage is unavailable", async () => {
  vi.mocked(fetchBusinessUsage).mockRejectedValue(new Error("Usage is not available yet."));
  render(<UsageView businesses={[business]} canManage />);
  expect(await screen.findByText("Usage is not available yet.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
});

it("offers scan settings only once a business is active (setup businesses cannot scan yet)", async () => {
  render(<UsageView businesses={[{ ...business, status: "provisioning" }]} canManage />);
  await screen.findByRole("heading", { name: "Spice Route" });
  expect(screen.queryByRole("button", { name: /Manage AI scanning/ })).not.toBeInTheDocument();
});
