import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { businessWithInvitation, ownerAssignedBusiness, pendingInvitation } from "@tests/mocks/platform";
import { BusinessCard, type BusinessActions } from "./BusinessCard";

const activeBusiness = { ...ownerAssignedBusiness, status: "active", isolation_ready: true } as const;

function actions(overrides: Partial<BusinessActions> = {}): BusinessActions {
  return {
    inviteEnabled: true,
    assignEnabled: true,
    activationEnabled: true,
    invitationStatusUnknown: false,
    businessAppOrigin: "https://business.example",
    onSetUpAdmin: vi.fn(),
    onReissue: vi.fn(),
    onRevoke: vi.fn(),
    onActivate: vi.fn(),
    onResolve: vi.fn(),
    onBranding: vi.fn(),
    onLifecycle: vi.fn(),
    ...overrides,
  };
}

it.each([
  [businessWithInvitation(null), "Invite first admin", "Delete business"],
  [businessWithInvitation(pendingInvitation), "Reissue link", "Revoke"],
  [ownerAssignedBusiness, "Activate business", null],
  [{ ...activeBusiness, status: "suspended" } as const, "Restore access", null],
] as const)("puts the available next action first (%s)", async (business, primaryLabel, destructiveLabel) => {
  const user = userEvent.setup();
  render(<ul><BusinessCard business={business} actions={actions()} /></ul>);
  const primary = screen.getByRole("button", { name: primaryLabel });
  const branding = screen.getByRole("button", { name: "Branding" });

  await user.tab();
  expect(primary).toHaveFocus();
  expect(primary).toHaveAttribute("data-variant", "default");
  await user.tab();
  expect(branding).toHaveFocus();
  expect(branding).toHaveAttribute("data-variant", "outline");
  expect(branding.dataset.size).toBe(primary.dataset.size);

  if (destructiveLabel) {
    const destructive = screen.getByRole("button", { name: destructiveLabel });
    await user.tab();
    expect(destructive).toHaveFocus();
    expect(destructive).toHaveAttribute("data-variant", "destructive");
    expect(destructive.dataset.size).toBe(primary.dataset.size);
  } else {
    expect(screen.queryByRole("button", { name: /delete|revoke|suspend/i })).not.toBeInTheDocument();
  }
});

it("keeps the active business sign-in link first and its suspend action last", async () => {
  const user = userEvent.setup();
  const cardActions = actions();
  render(<ul><BusinessCard business={activeBusiness} actions={cardActions} /></ul>);
  const signIn = screen.getByRole("link", { name: "Open business sign-in" });
  const suspend = screen.getByRole("button", { name: "Suspend business" });
  await user.tab();
  expect(signIn).toHaveFocus();
  expect(signIn).toHaveAttribute("href", "https://business.example/example-business");
  expect(signIn).toHaveAttribute("data-variant", "default");
  await user.tab();
  expect(screen.getByRole("button", { name: "Branding" })).toHaveFocus();
  await user.tab();
  expect(suspend).toHaveFocus();
  expect(suspend).toHaveAttribute("data-variant", "destructive");
  await user.keyboard("{Enter}");
  expect(cardActions.onLifecycle).toHaveBeenCalledWith(activeBusiness, "suspend");
});

it("keeps Ahaa's sign-in address and excludes lifecycle actions", () => {
  render(<ul><BusinessCard business={{ ...activeBusiness, slug: "ahaa", name: "Ahaa" }} actions={actions()} /></ul>);
  expect(screen.getByRole("link", { name: "Open business sign-in" })).toHaveAttribute("href", "https://business.example/aaha");
  expect(screen.queryByRole("button", { name: /delete|suspend|restore/i })).not.toBeInTheDocument();
});
