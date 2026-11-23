export type BrandPalette = "warm" | "neutral";
export type LoginBranding = { name: string; accent: string | null; logoUrl: string | null; palette: BrandPalette };

/** "warm" keeps the original Ahaa look; anything else is the neutral theme with the business's own brand. */
export function brandPalette(value: unknown): BrandPalette {
  return value === "warm" ? "warm" : "neutral";
}

/** Signed-in branding from the current workspace's business settings. */
export function businessBranding(business: { name: string; settings: Record<string, unknown> }): LoginBranding {
  const raw = business.settings.branding;
  const branding = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const displayName = typeof branding.display_name === "string" ? branding.display_name.trim() : "";
  return { name: displayName || business.name, accent: safeAccent(branding.accent), logoUrl: safeLogoUrl(branding.logo_url), palette: brandPalette(branding.palette) };
}

/** Only #RRGGBB colours are used for styling. */
export function safeAccent(value: unknown): string | null {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : null;
}
/** Only https URLs or site paths are used as image sources. */
export function safeLogoUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 500) return null;
  // Site path only: a second leading slash ("//host/...") would load from another site.
  if (/^\/[A-Za-z0-9._-][A-Za-z0-9._/-]*$/.test(value)) return value;
  if (value.startsWith("/")) return null;
  try { return new URL(value).protocol === "https:" ? value : null; } catch { return null; }
}

export function parseLoginBranding(value: unknown): LoginBranding | null {
  const data = value != null && typeof value === "object" ? value as { name?: unknown; accent?: unknown; logo_url?: unknown; palette?: unknown } : null;
  if (!data || typeof data.name !== "string" || !data.name.trim()) return null;
  return { name: data.name.trim(), accent: safeAccent(data.accent), logoUrl: safeLogoUrl(data.logo_url), palette: brandPalette(data.palette) };
}
