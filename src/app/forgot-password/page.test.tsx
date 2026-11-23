import { afterEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ForgotPassword from "@/app/forgot-password/page";
import { db } from "@tests/mocks/supabase";

const search = vi.hoisted(() => ({ value: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search.value) }));
afterEach(() => { search.value = ""; });

it("forgot password requests the configured callback instead of pretending to send",async()=>{
  render(<ForgotPassword/>);await userEvent.type(screen.getByLabelText("Email"),"manager@example.invalid");await userEvent.click(screen.getByRole("button",{name:"Send Reset Link"}));expect(await screen.findByText("Check your inbox")).toBeVisible();expect(db.auth.resetPasswordForEmail).toHaveBeenCalledWith("manager@example.invalid",{redirectTo:`${window.location.origin}/auth/confirm`});
});

it("email delivery errors do not show success",async()=>{
  db.auth.resetPasswordForEmail.mockResolvedValue({error:new Error("Email rate limit reached")});render(<ForgotPassword/>);await userEvent.type(screen.getByLabelText("Email"),"manager@example.invalid");await userEvent.click(screen.getByRole("button",{name:"Send Reset Link"}));expect(await screen.findByText("Email rate limit reached")).toBeVisible();expect(screen.queryByText("Check your inbox")).not.toBeInTheDocument();
});

it.each([
  ["/maple-kitchen", "/maple-kitchen"],
  ["/superadmin", "/superadmin"],
  ["//other.example/path", "/login?next=/admin"],
])("returns from password recovery to a valid entry for %s", (next, destination) => {
  search.value = new URLSearchParams({ next }).toString();
  render(<ForgotPassword />);
  expect(screen.getByRole("link", { name: "Back to login" })).toHaveAttribute("href", destination);
});

it("returns to ordinary sign-in in workspace mode without a business link", () => {
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED", "true");
  render(<ForgotPassword />);
  expect(screen.getByRole("link", { name: "Back to login" })).toHaveAttribute("href", "/login?next=/admin");
});
