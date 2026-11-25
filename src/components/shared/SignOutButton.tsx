"use client";

import { LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { businessWorkspacesEnabled } from "@/features/workspaces/context";
import { parseBusinessRolePath } from "@/features/workspaces/business-routes";
import { businessEntryPath } from "@/features/workspaces/business-address";
import { saveBusinessSelection } from "@/features/workspaces/selection";
import { setDisplayedBusiness } from "@/features/workspaces/fetch";

type Variant = "row" | "icon" | "compact";

/** Signs out and returns to the right sign-in page (the business's own role sign-in when scoped). */
export function useSignOut(returnTo?: string) {
  const pathname = usePathname();
  return async function handleSignOut() {
    await supabase.auth.signOut();
    const workspaceMode = businessWorkspacesEnabled();
    if (workspaceMode) { saveBusinessSelection(null); setDisplayedBusiness(null); }
    const scopedPath = workspaceMode && pathname ? parseBusinessRolePath(pathname) : null;
    // Every role returns to the business's one sign-in address (e.g. /aaha).
    const signIn = (scopedPath && businessEntryPath(scopedPath.slug)) || returnTo || "/login?next=/admin";
    const destination = pathname === "/superadmin" ? "/superadmin" : signIn;
    // A full page load: screens still mounted from the signed-in session must not react to the
    // signed-out state (they would show "Workspace access changed" instead of the sign-in page).
    window.location.replace(destination);
  };
}

export function SignOutButton({
  variant = "row",
  className,
  returnTo,
}: {
  variant?: Variant;
  className?: string;
  returnTo?: string;
}) {
  const handleSignOut = useSignOut(returnTo);

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={handleSignOut}
        aria-label="Sign out"
        className={cn(
          "inline-flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:bg-muted hover:text-[#DC2626]",
          className,
        )}
      >
        <LogOut className="size-4" />
      </button>
    );
  }

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={handleSignOut}
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-[#DC2626]",
          className,
        )}
      >
        <LogOut className="size-3.5" />
        Sign out
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-3 hover:bg-muted rounded-lg text-[#DC2626]",
        className,
      )}
    >
      <LogOut className="size-4" />
      <span className="text-sm">Sign Out</span>
    </button>
  );
}
