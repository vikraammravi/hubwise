"use client";
import { createContext, createElement, Fragment, useContext, useEffect, useState, type ReactNode } from "react";
import { LoadingState } from "@/components/shared/Spinner";
import { Button } from "@/components/ui/button";
import { supabase } from "./supabase/client";
import type { Profile } from "./supabase/types";
import { loadSessionProfile } from "@/features/workspaces/session";
import { WORKSPACE_CHANGED_EVENT, businessWorkspacesEnabled, selectedBusiness, type Business } from "@/features/workspaces/context";
import { businessRolePath, parseBusinessRolePath } from "@/features/workspaces/business-routes";
import { setDisplayedBusiness } from "@/features/workspaces/fetch";
import { saveBusinessSelection } from "@/features/workspaces/selection";
import { usePathname, useRouter } from "next/navigation";
import { userHome } from "@/lib/auth";
import type { UserRole } from "./supabase/types";
export type CurrentUser = { userId: string | null; profile: Profile | null; business?: Business | null; loading: boolean; error: string | null };
const initial: CurrentUser = { userId: null, profile: null, loading: true, error: null };
const signedOut: CurrentUser = { ...initial, loading: false };
const CurrentUserContext = createContext<CurrentUser | null>(null);
function useUserQuery(enabled: boolean, expectedSlug?: string): CurrentUser {
 const [state, setState] = useState({ slug: expectedSlug, value: initial });
 useEffect(() => {
  if (!enabled) return;
  let active = true, generation = 0;
  let knownUserId: string | null = null;
  let controller: AbortController | undefined;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const update = (value: CurrentUser) => setState({ slug: expectedSlug, value });
  async function refresh() {
   const request = ++generation;
   controller?.abort(); controller = new AbortController();
   const signal = controller.signal;
   try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!active || request !== generation) return;
    if (error || !user) { knownUserId = null; update({ ...signedOut, error: error?.message ?? null }); return; }
    knownUserId = user.id;
    const result = await loadSessionProfile(supabase, user.id, signal);
    if (!active || request !== generation) return;
    if (expectedSlug && (result.business?.slug !== expectedSlug || selectedBusiness(document.cookie) !== result.business.id)) {
      update({ ...signedOut, userId: user.id, error: "Workspace access changed. Reload to open this business again." });
      return;
    }
    if (result.business && !expectedSlug) saveBusinessSelection(result.business.id);
    setDisplayedBusiness(result.business?.id ?? null);
    update({ userId: user.id, profile: result.profile, business: result.business, loading: false, error: result.error?.message ?? null });
   } catch (error) {
    if (active && request === generation) update({ ...signedOut, error: error instanceof Error ? error.message : "Unable to load profile." });
   }
  }
  void refresh();
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
   if (!active) return;
   if (event === "SIGNED_OUT" || event === "SIGNED_IN" || event === "USER_UPDATED") { timers.forEach(clearTimeout); timers.clear(); }
   if (event === "SIGNED_OUT") { ++generation; knownUserId = null; controller?.abort(); setDisplayedBusiness(null); update(signedOut); }
   else if (event === "SIGNED_IN" || event === "USER_UPDATED") {
    // Defer Supabase queries until its auth callback has released its lock.
    ++generation; controller?.abort();
    if (event === "SIGNED_IN" && session?.user.id !== knownUserId) {
      knownUserId = session?.user.id ?? null;
      update(initial);
    }
    const timer = setTimeout(() => { timers.delete(timer); if (active) void refresh(); }, 0);
    timers.add(timer);
   }
  });
  const onFocus = () => { if (!document.hidden) void refresh(); };
  window.addEventListener("focus", onFocus);
  window.addEventListener(WORKSPACE_CHANGED_EVENT, onFocus);
  return () => { active = false; ++generation; controller?.abort(); subscription.unsubscribe(); timers.forEach(clearTimeout); window.removeEventListener("focus", onFocus); window.removeEventListener(WORKSPACE_CHANGED_EVENT, onFocus); };
 }, [enabled, expectedSlug]);
 return state.slug === expectedSlug ? state.value : initial;
}
/** Protected layouts own one profile request shared by their shell and pages. */
export function CurrentUserProvider({ children, role: expectedRole }: { children: ReactNode; role: UserRole }) {
 const pathname = usePathname();
 const scopeSlug = businessWorkspacesEnabled() && pathname ? parseBusinessRolePath(pathname)?.slug : undefined;
 const value = useUserQuery(true, scopeSlug);
 const router = useRouter();
 useEffect(() => {
  if (!businessWorkspacesEnabled() || scopeSlug || value.loading || !value.userId) return;
  if (!value.profile || !value.business) { router.replace("/workspaces"); return; }
  const role = value.profile.role;
  if (expectedRole !== role) {
    router.replace(businessRolePath(value.business.slug, userHome(role)));
    return;
  }
  // Legacy bookmarks are rendered by the same route that scoped URLs rewrite to.
  // Canonicalize the browser address after verification to avoid a server redirect loop.
  const { pathname: currentPath, search, hash } = window.location;
  const destination = businessRolePath(value.business.slug, currentPath + search + hash);
  if (destination !== currentPath + search + hash) window.history.replaceState(null, "", destination);
 }, [router, scopeSlug, expectedRole, value.loading, value.userId, value.profile, value.business]);
 if (scopeSlug && !value.loading && (!value.business || value.profile?.role !== expectedRole)) {
  return createElement("main", { className: "mx-auto max-w-lg space-y-4 p-6" },
    createElement("p", { role: "alert", className: "text-sm text-destructive" }, value.error ?? "Workspace access changed. Reload to continue."),
    createElement(Button, { variant: "outline", onClick: () => window.location.reload() }, "Reload this business"));
 }
 const accessKey = value.business ? `${value.business.id}:${value.profile?.role}:${value.profile?.location_id}` : "legacy";
 return createElement(CurrentUserContext.Provider, { value }, value.loading
  ? createElement(LoadingState, { label: "Loading your workspace…", minHeight: "min-h-screen" })
  : createElement(Fragment, { key: `${value.userId ?? "signed-out"}:${accessKey}` }, children));
}
/** Standalone consumers retain their existing behavior outside a layout provider. */
export function useCurrentUser(): CurrentUser {
 const shared = useContext(CurrentUserContext);
 const fallback = useUserQuery(shared === null);
 return shared ?? fallback;
}
