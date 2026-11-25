"use client";

import { useState, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useBusinessHref } from "@/features/workspaces/BusinessLink";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SidebarNav, activeNavLabel, type NavEntry, type NavItem } from "./SidebarNav";
import { HeaderTitleContext, ShellHeadingContext } from "./ShellHeading";
import { WorkspaceBrand, useWorkspaceBranding, useWorkspaceTheme, useWorkspaceTitle } from "./WorkspaceBrand";
import { businessEntryPath } from "@/features/workspaces/business-address";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { AccountMenu } from "./AccountMenu";

export type ShellUser = {
  name: string;
  role: string;
  initials: string;
};

/**
 * Signed-in layout. One header on every page: the business brand (back to Home) and the account menu
 * (profile, sign out). The Home page is full width with no sidebar; inside a section the sidebar
 * appears on desktop, a slide-out menu on phones, or the bottom bar when the role has one.
 */
export function AppShell({
  entries,
  footerEntries,
  user,
  brandHref,
  homeHref,
  mobileNav,
  children,
}: {
  entries: NavEntry[];
  /** Account links (the profile entry moves into the header account menu). */
  footerEntries?: NavEntry[];
  user: ShellUser;
  brandHref: string;
  /** The tiles page. On it the sidebar is hidden; elsewhere it is shown. */
  homeHref?: string;
  mobileNav?: ReactNode; // optional bottom nav for mobile
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pageTitle, setPageTitle] = useState<string | null>(null);
  const branding = useWorkspaceBranding();
  const { business, profile } = useCurrentUser();
  const pathname = usePathname();
  const businessHref = useBusinessHref();
  const brandHome = businessHref(brandHref);
  const isHome = !!homeHref && (pathname === homeHref || pathname === businessHref(homeHref));
  const signInPath = business && profile ? businessEntryPath(business.slug) ?? undefined : undefined;
  useWorkspaceTheme(branding);
  useWorkspaceTitle();
  const profileHref = footerEntries?.find((entry): entry is NavItem => "href" in entry && entry.href.endsWith("/profile"))?.href;
  const showSidebar = !isHome;
  // Inside a section, its name (e.g. "Daily Stock") sits in the header bar instead of on the page.
  const section = showSidebar ? activeNavLabel(entries, pathname ?? "", businessHref) : null;
  // Home has no section; the page may name itself (the branch name on branch Home).
  const headerTitle = section ?? (isHome ? pageTitle : null);
  // The bottom bar is for moving between sections; Home is the tiles, so it is not shown there.
  const bottomNav = isHome ? null : mobileNav;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className={`sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface px-3 sm:px-4 lg:gap-0 lg:pr-8 ${showSidebar ? "lg:pl-0" : "lg:pl-8"}`}>
        {showSidebar && !bottomNav && <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu" className="lg:hidden">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <div className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
              <div className="shrink-0 border-b border-sidebar-border px-5 py-4">
                <WorkspaceBrand branding={branding} size="md" href={brandHome} />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <SidebarNav entries={entries} onNavigate={() => setOpen(false)} />
              </div>
            </div>
          </SheetContent>
        </Sheet>}
        {/* On desktop the brand sits above the sidebar, so the section name lines up with the page content. */}
        <div className={showSidebar ? "lg:flex lg:h-full lg:w-64 lg:shrink-0 lg:items-center lg:border-r lg:border-sidebar-border lg:px-5" : undefined}>
          <WorkspaceBrand branding={branding} size="sm" href={brandHome} />
        </div>
        {headerTitle && <>
          <span aria-hidden className="mx-1 hidden h-6 w-px bg-border sm:block lg:hidden" />
          <p className="min-w-0 truncate text-base font-semibold text-forest sm:text-lg lg:pl-8 lg:text-xl">{headerTitle}</p>
        </>}
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <div className="hidden min-w-0 text-right sm:block">
            <div className="truncate text-sm font-medium leading-tight">{user.name}</div>
            <div className="truncate text-[11px] text-muted-foreground">{user.role}</div>
          </div>
          <AccountMenu user={user} profileHref={profileHref} returnTo={signInPath} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {showSidebar && <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-64 shrink-0 overflow-y-auto overscroll-contain border-r border-sidebar-border bg-sidebar text-sidebar-foreground [scrollbar-width:thin] lg:block">
          <SidebarNav entries={entries} />
        </aside>}

        <main className={`min-w-0 flex-1 p-4 sm:p-6 lg:p-8 ${bottomNav ? "pb-28 lg:pb-8" : ""}`}>
          <HeaderTitleContext.Provider value={setPageTitle}>
            <ShellHeadingContext.Provider value={!!section}>{children}</ShellHeadingContext.Provider>
          </HeaderTitleContext.Provider>
        </main>
      </div>

      {bottomNav}
    </div>
  );
}
