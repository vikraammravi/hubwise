import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { db, queryResult, router } from "@tests/mocks/supabase";
import { businessId, businessWorkspace, otherBusinessId, workspaceChoices, workspaceProfile } from "@tests/mocks/workspaces";
import { setDisplayedBusiness } from "../fetch";
import { saveBusinessSelection } from "../selection";
import BusinessEntry from "./BusinessEntry";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED", "true");
  saveBusinessSelection(null);
  setDisplayedBusiness(null);
  db.auth.getUser.mockResolvedValue({ data: { user: { id: workspaceProfile.id } }, error: null });
  db.rpc.mockImplementation(name => queryResult(name === "my_workspaces" ? workspaceChoices : businessWorkspace));
});
it.each([
  ["CENTRAL_ADMIN", "/test-business/admin/dashboard"],
  ["BRANCH_MANAGER", "/test-business/branch/home"],
  ["BRANCH_EMPLOYEE", "/test-business/branch/inventory"],
] as const)("opens the verified %s home without an intermediate confirmation", async (role, home) => {
  const otherWorkspace = { ...workspaceChoices[0], business_id: otherBusinessId, slug: "another-business" };
  const verification = queryResult({ ...businessWorkspace, profile: { ...workspaceProfile, role } });
  db.rpc.mockImplementation(name => name === "my_workspaces" ? queryResult([otherWorkspace, ...workspaceChoices]) : verification);
  render(<BusinessEntry slug="test-business" />);
  expect(screen.getByText("Opening business…")).toBeVisible();
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith(home));
  expect(db.rpc).toHaveBeenCalledWith("current_workspace");
  expect(verification.setHeader).toHaveBeenCalledWith("x-business-id", businessId);
  expect(screen.queryByRole("button", { name: "Open business" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "My workspaces" })).not.toBeInTheDocument();
});
it.each([
  ["/test-business/branch/inventory?date=2026-11-23#count", "/test-business/branch/inventory?date=2026-11-23#count"],
  ["/another-business/branch/inventory", "/test-business/branch/home"],
  ["/test-business/admin/invoices", "/test-business/branch/home"],
  ["//foreign.test/test-business/branch/inventory", "/test-business/branch/home"],
])("opens only a same-business continuation allowed by the verified role", async (next, destination) => {
  render(<BusinessEntry slug="test-business" next={next} />);
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith(destination));
});
it("does not open an unrelated or suspended business", async () => {
  db.rpc.mockReturnValue(queryResult([{ ...workspaceChoices[0], business_status: "suspended" }]));
  render(<BusinessEntry slug="test-business" />);
  expect(await screen.findByText(/unavailable for your account/)).toBeVisible();
  expect(screen.getByRole("link", { name: "My workspaces" })).toHaveAttribute("href", "/workspaces");
  expect(db.rpc).not.toHaveBeenCalledWith("current_workspace");
  expect(router.replace).not.toHaveBeenCalled();
});
it("does not reveal or open another business when its link is entered", async () => {
  render(<BusinessEntry slug="another-business" />);
  expect(await screen.findByText(/unavailable for your account/)).toBeVisible();
  expect(screen.queryByText("Test business")).not.toBeInTheDocument();
  expect(db.rpc).not.toHaveBeenCalledWith("current_workspace");
  expect(router.replace).not.toHaveBeenCalled();
});
it("does not open a business before its isolation setup is complete", async () => {
  db.rpc.mockReturnValue(queryResult([{ ...workspaceChoices[0], isolation_ready: false }]));
  render(<BusinessEntry slug="test-business" />);
  expect(await screen.findByText(/unavailable for your account/)).toBeVisible();
  expect(db.rpc).not.toHaveBeenCalledWith("current_workspace");
});
it("keeps the entry page open when membership is revoked during selection", async () => {
  db.rpc.mockImplementation(name => name === "my_workspaces" ? queryResult(workspaceChoices) : queryResult(null, { message: "Workspace access is unavailable" }));
  render(<BusinessEntry slug="test-business" />);
  expect(await screen.findByText("Workspace access is unavailable")).toBeVisible();
  expect(document.cookie).not.toContain("ahaa_business=");
  expect(router.replace).not.toHaveBeenCalled();
  db.rpc.mockImplementation(name => queryResult(name === "my_workspaces" ? workspaceChoices : businessWorkspace));
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/test-business/branch/home"));
});
it("rejects a workspace response for a different business", async () => {
  db.rpc.mockImplementation(name => name === "my_workspaces" ? queryResult(workspaceChoices) : queryResult({ ...businessWorkspace, business: { ...businessWorkspace.business, id: otherBusinessId } }));
  render(<BusinessEntry slug="test-business" />);
  expect(await screen.findByText("Workspace selection could not be verified.")).toBeVisible();
  expect(document.cookie).not.toContain("ahaa_business=");
  expect(router.replace).not.toHaveBeenCalled();
});
