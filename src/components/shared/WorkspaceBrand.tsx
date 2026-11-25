"use client";
import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { businessWorkspacesEnabled } from "@/features/workspaces/context";
import { businessBranding, type LoginBranding } from "@/features/workspaces/branding";
import { BusinessMark } from "./BusinessMark";
import { Logo } from "./Logo";

const THEME_CLASS = "neutral-surface";
const ACCENT_VARS = ["--primary", "--ring", "--saffron-hover", "--sidebar-primary"] as const;

/**
 * The signed-in business's branding; null for the original Ahaa look (warm palette or legacy mode);
 * undefined in workspace mode while no business is known, so no brand (never Ahaa's) is shown.
 */
export function useWorkspaceBranding(): LoginBranding | null | undefined {
  const { business } = useCurrentUser();
  return useMemo(() => {
    if (!businessWorkspacesEnabled()) return null;
    if (!business) return undefined;
    const branding = businessBranding(business);
    return branding.palette === "warm" ? null : branding;
  }, [business]);
}

/**
 * Applies the neutral theme and the business accent to the whole page (dialogs and menus render
 * outside the shell), and restores the original theme when the business changes or the shell unmounts.
 */
export function useWorkspaceTheme(branding: LoginBranding | null | undefined) {
  const accent = branding?.accent ?? null;
  const neutral = branding != null;
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

/**
 * The browser tab shows the signed-in business's own name (display name, else business name), never
 * the platform's. Route metadata rewrites the title after client navigations (asynchronously), so it is
 * re-applied whenever the head changes while the app shell is mounted.
 */
export function useWorkspaceTitle() {
  const { business } = useCurrentUser();
  const pathname = usePathname();
  const name = business ? businessBranding(business).name : null;
  useEffect(() => {
    if (!name) return;
    const apply = () => { if (document.title !== name) document.title = name; };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [name, pathname]);
}

/** Header/sidebar brand: Ahaa's logo for the original look, otherwise the business's own mark. */
export function WorkspaceBrand({ branding, size, href }: { branding: LoginBranding | null | undefined; size: "sm" | "md"; href: string }) {
  if (branding === undefined) return null;
  if (branding === null) return <Logo variant="full" size={size} href={href} priority />;
  return <BusinessMark name={branding.name} logoUrl={branding.logoUrl} accent={branding.accent} size={size === "md" ? "md" : "sm"} layout="inline" href={href} />;
}
