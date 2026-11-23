import { supabase } from "@/lib/supabase/client";
import { parseLoginBranding, type LoginBranding } from "./branding-model";
export * from "./branding-model";

/** Public sign-in branding for an active business; null when unknown or not active. */
export async function fetchLoginBranding(slug: string, signal: AbortSignal): Promise<LoginBranding | null> {
  const result = await supabase.rpc("business_login_branding", { p_slug: slug }).abortSignal(signal);
  if (result.error) throw new Error("Unable to load sign-in details.");
  return parseLoginBranding(result.data);
}
