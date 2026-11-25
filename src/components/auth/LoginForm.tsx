"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, FormEvent } from "react";
import { BusinessMark } from "@/components/shared/BusinessMark";
import type { LoginBranding } from "@/features/workspaces/branding-model";
import { AuthShell } from "@/components/auth/AuthShell";
import { PlatformBrand } from "@/features/platform/components/PlatformBrand";
import { PLATFORM_NAME } from "@/features/platform/brand";
import { Banner } from "@/components/shared/Banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/shared/PasswordInput";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/shared/Spinner";
import { supabase } from "@/lib/supabase/client";
import { activeRole, safeNextPath } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { businessWorkspacesEnabled } from "@/features/workspaces/context";
import { businessEntryPath } from "@/features/workspaces/business-address";
import { businessRolePath } from "@/features/workspaces/business-routes";
import { loadSessionProfile } from "@/features/workspaces/session";

type LoginFormProps = { business?: { slug: string; branding: LoginBranding; next?: string | null } };

function LoginInner({ business }: LoginFormProps) {
  const params = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activated = params.get("activated") === "1";
  const reset = params.get("reset") === "1";
  const businessPath = business ? businessEntryPath(business.slug) : null;
  const next = businessPath ?? params.get("next");
  const platformSignIn = next === "/superadmin";
  const workspaceMode = businessWorkspacesEnabled();
  const businessBrand = business?.branding;
  const recoveryReturn = businessPath ?? (platformSignIn ? "/superadmin" : null);
  const recoveryHref = recoveryReturn ? `/forgot-password?next=${encodeURIComponent(recoveryReturn)}` : "/forgot-password";
  useEffect(() => {
    if (platformSignIn) document.title = `Sign in · ${PLATFORM_NAME}`;
    else if (businessBrand) document.title = `Sign in · ${businessBrand.name}`;
  }, [businessBrand, platformSignIn]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      if (businessPath || (workspaceMode && next === "/workspaces")) {
        const destination = businessPath && business?.next
          ? `${businessPath}?next=${encodeURIComponent(business.next)}`
          : businessPath ?? "/workspaces";
        router.replace(destination);
        router.refresh();
        return;
      }

      if (next === "/superadmin") {
        const permission = await supabase.rpc("platform_is_administrator");
        if (!permission.error && permission.data === true) { router.replace("/superadmin"); router.refresh(); return; }
        throw new Error("Platform access is required for this account.");
      }

      const { profile, business: workspace, error: profileError } = await loadSessionProfile(supabase, data.user.id);

      const role = activeRole(profileError ? null : profile);
      if (!role) {
        if (workspaceMode) { router.replace("/workspaces"); router.refresh(); return; }
        await supabase.auth.signOut({ scope: "local" });
        throw new Error("This account is not active. Contact your admin.");
      }
      const destination = safeNextPath(next, role);
      router.replace(workspace ? businessRolePath(workspace.slug, destination) : destination);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      // A business's sign-in is just its logo and "Sign in to <business>"; every role uses the same page.
      title={platformSignIn ? "Superadmin sign in" : businessBrand ? `Sign in to ${businessBrand.name}` : "Welcome back"}
      subtitle={platformSignIn ? "Sign in to manage businesses on the platform." : undefined}
      showBrand={platformSignIn || businessBrand !== undefined}
      brand={platformSignIn ? <PlatformBrand subtitle="Platform admin" /> : businessBrand ? <BusinessMark name={businessBrand.name} logoUrl={businessBrand.logoUrl} accent={businessBrand.accent} size="lg" showName={!businessBrand.logoUrl} /> : undefined}
      brandName={platformSignIn ? PLATFORM_NAME : businessBrand?.name ?? ""}
      accent={businessBrand?.accent}
      neutral={!platformSignIn && businessBrand?.palette !== "warm"}
    >
      {(activated || reset) && (
        <Banner tone="success" className="mb-4">
          {activated
            ? "Your account is ready. Sign in to continue."
            : "Password reset successfully. Sign in with your new password."}
        </Banner>
      )}
      {params.get("reason") === "account_inactive" && <Banner tone="danger" className="mb-4">This account is not active. Contact your admin.</Banner>}

      {error && (
        <Banner tone="danger" className="mb-4">
          {error}
        </Banner>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
            autoComplete="email"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href={recoveryHref}
              className="text-xs text-saffron-hover"
            >
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
        </div>

        <Button
          type="submit"
          size="sm"
          className="mx-auto flex h-10 w-full max-w-40 px-4 sm:h-9"
          disabled={submitting}
        >
          {submitting && <Spinner size="xs" className="text-primary-foreground" />}
          {submitting ? "Signing in…" : "Sign In"}
        </Button>
      </form>
    </AuthShell>
  );
}

export function LoginForm(props: LoginFormProps) {
  return (
    <Suspense>
      <LoginInner {...props} />
    </Suspense>
  );
}
