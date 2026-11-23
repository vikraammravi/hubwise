"use client";
import { useEffect, useMemo } from "react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { businessWorkspacesEnabled } from "@/features/workspaces/context";
import { businessBranding, type LoginBranding } from "@/features/workspaces/branding";
import { BusinessMark } from "./BusinessMark";
import { Logo } from "./Logo";

const THEME_CLASS = "neutral-surface";
const ACCENT_VARS = ["--primary", "--ring", "--saffron-hover", "--sidebar-primary"] as const;

/** The signed-in business's branding, or null for the original Ahaa look (warm palette, legacy mode, or loading). */
export function useWorkspaceBranding(): LoginBranding | null {
  const { business } = useCurrentUser();
  return useMemo(() => {
    if (!businessWorkspacesEnabled() || !business) return null;
    const branding = businessBranding(business);
    return branding.palette === "warm" ? null : branding;
  }, [business]);
}

/**
 * Applies the neutral theme and the business accent to the whole page (dialogs and menus render
 * outside the shell), and restores the original theme when the business changes or the shell unmounts.
 */
export function useWorkspaceTheme(branding: LoginBranding | null) {
  const accent = branding?.accent ?? null;
  const neutral = branding !== null;
  useEffect(() => {
    if (!neutral) return;
    const root = document.documentElement;
    root.classList.add(THEME_CLASS);
    if (accent) ACCENT_VARS.forEach(name => root.style.setProperty(name, accent));
    return () => {
      root.classList.remove(THEME_CLASS);
      ACCENT_VARS.forEach(name => root.style.removeProperty(name));
    };
  }, [neutral, accent]);
}

/** Header/sidebar brand: Ahaa's logo for the original look, otherwise the business's own mark. */
export function WorkspaceBrand({ branding, size, href }: { branding: LoginBranding | null; size: "sm" | "md"; href: string }) {
  if (!branding) return <Logo variant="full" size={size} href={href} priority />;
  return <BusinessMark name={branding.name} logoUrl={branding.logoUrl} accent={branding.accent} size={size === "md" ? "md" : "sm"} layout="inline" href={href} />;
}
