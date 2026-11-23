import { notFound } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { createSupabaseServer } from "@/lib/supabase/server";
import { parseLoginBranding } from "@/features/workspaces/branding-model";
import BusinessEntry from "@/features/workspaces/components/BusinessEntry";

export async function BusinessEntryPage({ slug, next }: { slug: string; next: string | null }) {
  const supabase = await createSupabaseServer({ workspace: false });
  const { data, error } = await supabase.rpc("business_login_branding", { p_slug: slug });
  if (error) throw new Error("Unable to load sign-in details.");
  const branding = parseLoginBranding(data);
  if (!branding) notFound();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  return user && !authError
    ? <BusinessEntry key={slug} slug={slug} next={next} />
    : <LoginForm business={{ slug, branding, next }} />;
}
