import type { BusinessBranding } from "@/features/platform/data";

// Minimal file signatures; content beyond the magic bytes is irrelevant to the server checks.
export const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
export const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 0]);
export const webpBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
export function logoFile(bytes: Uint8Array, type = "image/png", name = "logo") {
  return new File([bytes as BlobPart], name, { type });
}

export const brandingInput = { displayName: "Spice Route", accent: "#0EA5E9", logoUrl: "https://cdn.example/logo.png" };
export const savedBranding: BusinessBranding = { display_name: "Spice Route", accent: "#0ea5e9", logo_url: "https://cdn.example.invalid/logo.png" };
export const uploadedLogoUrl = "https://storage.example.invalid/business-branding/new-logo.png";
export const loginBrandingRow = { name: "  Spice Route Kitchens ", accent: "#0EA5E9", logo_url: "https://cdn.example.invalid/logo.png" };
