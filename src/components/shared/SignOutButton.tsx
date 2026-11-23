"use client";

import { LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { usePathname, useRouter } from "next/navigation";
import { businessWorkspacesEnabled } from "@/features/workspaces/context";
import { businessRolePath, parseBusinessRolePath } from "@/features/workspaces/business-routes";
import { saveBusinessSelection } from "@/features/workspaces/selection";
import { setDisplayedBusiness } from "@/features/workspaces/fetch";

type Variant = "row" | "icon" | "compact";

export function SignOutButton({
  variant = "row",
  className,
  returnTo,
}: {
  variant?: Variant;
  className?: string;
  returnTo?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  async function handleSignOut() {
    await supabase.auth.signOut();
    const workspaceMode = businessWorkspacesEnabled();
    if (workspaceMode) { saveBusinessSelection(null); setDisplayedBusiness(null); }
    const scopedPath = workspaceMode && pathname ? parseBusinessRolePath(pathname) : null;
    const signIn = scopedPath
      ? businessRolePath(scopedPath.slug, scopedPath.rolePath.split("/")[1] === "admin" ? "/admin" : "/branch")
      : returnTo ?? "/login?next=/admin";
    const destination = pathname === "/superadmin" ? "/superadmin" : signIn;
    router.replace(destination);
    router.refresh();
  }

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
