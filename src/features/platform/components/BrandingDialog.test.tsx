import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { platformBusinesses } from "@tests/mocks/platform";
import { logoFile, pngBytes, savedBranding, uploadedLogoUrl } from "@tests/mocks/platform-branding";
import { updateBusinessBranding, uploadBusinessLogo, type PlatformBusiness } from "../data";
import { BrandingDialog } from "./BrandingDialog";

vi.mock("../data", async importOriginal => ({ ...await importOriginal<typeof import("../data")>(), updateBusinessBranding: vi.fn(), uploadBusinessLogo: vi.fn() }));

const plain: PlatformBusiness = { ...platformBusinesses[1], branding: null };
const branded: PlatformBusiness = { ...platformBusinesses[1], branding: savedBranding };
const onClose = vi.fn();
const onSaved = vi.fn();
beforeEach(() => {
  vi.mocked(updateBusinessBranding).mockResolvedValue();
  vi.mocked(uploadBusinessLogo).mockResolvedValue(uploadedLogoUrl);
});
function open(business: PlatformBusiness = plain) {
  render(<BrandingDialog business={business} onClose={onClose} onSaved={onSaved} />);
  return screen.getByRole("dialog", { name: "Branding" });
}
const save = (dialog: HTMLElement) => fireEvent.click(within(dialog).getByRole("button", { name: "Save branding" }));

it("previews the business name when no display name is set, then the display name as typed", () => {
  const dialog = open();
  expect(within(dialog).getByText(/How Example Business appears on its sign-in page/)).toBeInTheDocument();
  expect(within(dialog).getByText("Example Business")).toBeInTheDocument();
  expect(within(dialog).getByText("EB")).toBeInTheDocument();
  fireEvent.change(within(dialog).getByLabelText("Display name"), { target: { value: "Spice Route" } });
  expect(within(dialog).getByText("SR")).toBeInTheDocument();
  expect(within(dialog).getByText("Spice Route")).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "Upload logo" })).toBeInTheDocument();
  expect(within(dialog).queryByRole("button", { name: /Remove/ })).not.toBeInTheDocument();
});

it("starts from saved branding with the logo and matching swatch", () => {
  const dialog = open(branded);
  expect(within(dialog).getByLabelText("Display name")).toHaveValue("Spice Route");
  expect(within(dialog).getByRole("img", { name: "Spice Route logo" })).toHaveAttribute("src", savedBranding.logo_url!);
  expect(within(dialog).getByRole("button", { name: "Use colour #0ea5e9" })).toHaveAttribute("aria-pressed", "true");
  expect(within(dialog).getByRole("button", { name: "Replace logo" })).toBeInTheDocument();
});

it("saves a chosen swatch, a trimmed display name and no logo", async () => {
  const dialog = open();
  fireEvent.change(within(dialog).getByLabelText("Display name"), { target: { value: "  Spice Route  " } });
  const swatch = within(dialog).getByRole("button", { name: "Use colour #059669" });
  expect(swatch).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(swatch);
  expect(swatch).toHaveAttribute("aria-pressed", "true");
  expect(within(dialog).getByLabelText("Custom colour")).toHaveValue("#059669");
  save(dialog);
  await waitFor(() => expect(updateBusinessBranding).toHaveBeenCalledWith("b", { displayName: "Spice Route", accent: "#059669", logoUrl: "" }));
  expect(onSaved).toHaveBeenCalledTimes(1);
});

it("normalises a custom colour and clears it with Default", async () => {
  const dialog = open();
  fireEvent.change(within(dialog).getByLabelText("Custom colour"), { target: { value: " #0EA5E9 " } });
  expect(within(dialog).getByRole("button", { name: "Use colour #0ea5e9" })).toHaveAttribute("aria-pressed", "true");
  save(dialog);
  await waitFor(() => expect(updateBusinessBranding).toHaveBeenCalledWith("b", expect.objectContaining({ accent: "#0ea5e9" })));
  // A successful save waits for the parent to close the dialog.
  expect(within(dialog).getByRole("button", { name: "Saving…" })).toBeDisabled();
});

it("clears a saved colour with Default and saves the default", async () => {
  const dialog = open(branded);
  fireEvent.click(within(dialog).getByRole("button", { name: "Default" }));
  expect(within(dialog).getByLabelText("Custom colour")).toHaveValue("");
  expect(within(dialog).queryByRole("button", { name: "Default" })).not.toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "Use colour #0ea5e9" })).toHaveAttribute("aria-pressed", "false");
  save(dialog);
  await waitFor(() => expect(updateBusinessBranding).toHaveBeenCalledWith("b", { displayName: "Spice Route", accent: "", logoUrl: savedBranding.logo_url }));
});

it("rejects an invalid custom colour without calling the API", () => {
  const dialog = open();
  fireEvent.change(within(dialog).getByLabelText("Custom colour"), { target: { value: "#12" } });
  save(dialog);
  expect(within(dialog).getByText("Choose a colour like #4F46E5.")).toBeInTheDocument();
  expect(updateBusinessBranding).not.toHaveBeenCalled();
  expect(onSaved).not.toHaveBeenCalled();
});

it("uploads a logo, previews it and saves its URL", async () => {
  const dialog = open();
  const file = logoFile(pngBytes);
  fireEvent.change(within(dialog).getByLabelText("Upload logo", { selector: "input" }), { target: { files: [file] } });
  await waitFor(() => expect(uploadBusinessLogo).toHaveBeenCalledWith("b", file));
  expect(await within(dialog).findByRole("img", { name: "Example Business logo" })).toHaveAttribute("src", uploadedLogoUrl);
  expect(within(dialog).getByRole("button", { name: "Replace logo" })).toBeInTheDocument();
  save(dialog);
  await waitFor(() => expect(updateBusinessBranding).toHaveBeenCalledWith("b", { displayName: "", accent: "", logoUrl: uploadedLogoUrl }));
});

it("rejects a logo over 512 KB in the browser", () => {
  const dialog = open();
  fireEvent.change(within(dialog).getByLabelText("Upload logo", { selector: "input" }), { target: { files: [logoFile(new Uint8Array(512 * 1024 + 1))] } });
  expect(within(dialog).getByText("Use a logo of 512 KB or smaller.")).toBeInTheDocument();
  expect(uploadBusinessLogo).not.toHaveBeenCalled();
});

it("shows upload and save errors in the dialog and keeps it open", async () => {
  vi.mocked(uploadBusinessLogo).mockRejectedValue(new Error("Use a PNG, JPEG or WebP image."));
  vi.mocked(updateBusinessBranding).mockRejectedValue(new Error("Check the display name, colour and logo."));
  const dialog = open();
  fireEvent.change(within(dialog).getByLabelText("Upload logo", { selector: "input" }), { target: { files: [logoFile(pngBytes)] } });
  expect(await within(dialog).findByText("Use a PNG, JPEG or WebP image.")).toBeInTheDocument();
  expect(within(dialog).queryByRole("img")).not.toBeInTheDocument();
  save(dialog);
  expect(await within(dialog).findByText("Check the display name, colour and logo.")).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "Save branding" })).toBeEnabled();
  expect(onSaved).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog", { name: "Branding" })).toBeInTheDocument();
});

it("removes a saved logo and cancels without saving", async () => {
  const dialog = open(branded);
  fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
  expect(within(dialog).queryByRole("img")).not.toBeInTheDocument();
  save(dialog);
  await waitFor(() => expect(updateBusinessBranding).toHaveBeenCalledWith("b", { displayName: "Spice Route", accent: "#0ea5e9", logoUrl: "" }));
});

it("cancels without saving", () => {
  const dialog = open(branded);
  fireEvent.change(within(dialog).getByLabelText("Display name"), { target: { value: "Changed" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(updateBusinessBranding).not.toHaveBeenCalled();
});

it("renders nothing without a business", () => {
  render(<BrandingDialog business={null} onClose={onClose} onSaved={onSaved} />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
