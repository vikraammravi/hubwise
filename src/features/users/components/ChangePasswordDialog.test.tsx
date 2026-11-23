import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChangePasswordDialog } from "@/features/users/components/ChangePasswordDialog";
import { db, router } from "@tests/mocks/supabase";

it.each([[undefined, "/login?reset=1"], ["/aaha/branch", "/aaha/branch?reset=1"]])("change password signs out and returns to the sign-in at %s",async(signInPath, destination)=>{
  render(<ChangePasswordDialog signInPath={signInPath}/>);await userEvent.click(screen.getByRole("button",{name:"Change Password"}));
  await userEvent.type(screen.getByLabelText(/Current Password/),"old-password-123");await userEvent.type(screen.getByLabelText(/^New Password/),"new-password-123");await userEvent.type(screen.getByLabelText(/Confirm New/),"new-password-123");await userEvent.click(screen.getByRole("button",{name:"Update Password"}));
  expect(db.auth.updateUser).toHaveBeenCalledWith({password:"new-password-123",current_password:"old-password-123"});expect(db.auth.signOut).toHaveBeenCalledWith({scope:"global"});expect(router.replace).toHaveBeenCalledWith(destination);
});

it("change password mismatch never reaches Supabase",async()=>{
  render(<ChangePasswordDialog/>);await userEvent.click(screen.getByRole("button",{name:"Change Password"}));await userEvent.type(screen.getByLabelText(/Current Password/),"old-password-123");await userEvent.type(screen.getByLabelText(/^New Password/),"new-password-123");await userEvent.type(screen.getByLabelText(/Confirm New/),"different-password");await userEvent.click(screen.getByRole("button",{name:"Update Password"}));expect(await screen.findByRole("alert")).toHaveTextContent("Passwords don't match");expect(db.auth.updateUser).not.toHaveBeenCalled();
});
