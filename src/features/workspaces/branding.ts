import { supabase } from "@/lib/supabase/client";

export type LoginBranding = { name: string; accent: string | null; logoUrl: string | null };

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

/** Public sign-in branding for an active business; null when unknown or not active. */
export async function fetchLoginBranding(slug: string, signal: AbortSignal): Promise<LoginBranding | null> {
  const result = await supabase.rpc("business_login_branding", { p_slug: slug }).abortSignal(signal);
  if (result.error) throw new Error("Unable to load sign-in details.");
  const data = result.data as { name?: unknown; accent?: unknown; logo_url?: unknown } | null;
  if (!data || typeof data.name !== "string" || !data.name.trim()) return null;
  return { name: data.name.trim(), accent: safeAccent(data.accent), logoUrl: safeLogoUrl(data.logo_url) };
}
