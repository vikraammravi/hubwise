"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ComponentType } from "react";
import { Ellipsis } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBusinessHref } from "@/features/workspaces/BusinessLink";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export type BottomNavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  /** A raised round button in the middle of the bar (used for Home). */
  featured?: boolean;
};

const slot = "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-center text-[11px] font-medium";

/**
 * Phone bottom bar. Keep `items` to four sections plus the featured Home in the middle; everything
 * else goes in `moreItems`, shown from a "More" button, so the bar stays balanced as sections grow.
 */
export function BottomNav({
  items,
  moreItems = [],
  className,
}: {
  items: BottomNavItem[];
  moreItems?: BottomNavItem[];
  className?: string;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = usePathname();
  const businessHref = useBusinessHref();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");
  const moreActive = moreItems.some(item => isActive(businessHref(item.href)));

  return (
    <nav
      aria-label="Sections"
      className={cn(
        "lg:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border flex justify-around py-2 z-40",
        className,
      )}
    >
      {items.map((it) => {
        const href = businessHref(it.href);
        const active = isActive(href);
        const Icon = it.icon;
        if (it.featured) return (
          <Link key={it.href} href={href} aria-current={active ? "page" : undefined}
            className="flex min-w-0 flex-1 flex-col items-center gap-0.5 text-[11px] font-medium text-foreground">
            <span className="-mt-7 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-surface transition-transform active:scale-95">
              <Icon className="size-6" />
            </span>
            <span className="leading-tight">{it.label}</span>
          </Link>
        );
        return (
          <Link key={it.href} href={href} aria-current={active ? "page" : undefined}
            className={cn(slot, active ? "text-saffron" : "text-muted-foreground")}>
            <Icon className={cn("size-5", active ? "text-saffron" : "text-muted-foreground")} />
            <span className="max-w-[76px] leading-tight">{it.label}</span>
          </Link>
        );
      })}
      {moreItems.length > 0 && <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetTrigger className={cn(slot, moreActive ? "text-saffron" : "text-muted-foreground")}>
          <Ellipsis className={cn("size-5", moreActive ? "text-saffron" : "text-muted-foreground")} />
          <span className="leading-tight">More</span>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-8 pt-5">
          <SheetTitle className="px-1 text-base">More</SheetTitle>
          <ul className="grid grid-cols-3 gap-3">
            {moreItems.map(it => {
              const href = businessHref(it.href);
              const active = isActive(href);
              const Icon = it.icon;
              return <li key={it.href}>
                <Link href={href} onClick={() => setMoreOpen(false)} aria-current={active ? "page" : undefined}
                  className={cn("flex h-full flex-col items-center gap-2 rounded-xl border p-3 text-center text-xs font-medium",
                    active ? "border-primary/50 bg-primary/10 text-foreground" : "bg-card text-foreground")}>
                  <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span>
                  {it.label}
                </Link>
              </li>;
            })}
          </ul>
        </SheetContent>
      </Sheet>}
    </nav>
  );
}
