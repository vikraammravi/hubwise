"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ComponentType } from "react";
import { cn } from "@/lib/utils";
import { useBusinessHref } from "@/features/workspaces/BusinessLink";

export type BottomNavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
};

export function BottomNav({
  items,
  className,
}: {
  items: BottomNavItem[];
  className?: string;
}) {
  const pathname = usePathname();
  const businessHref = useBusinessHref();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <nav
      className={cn(
        "lg:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border flex justify-around py-2 z-40",
        className,
      )}
    >
      {items.map((it) => {
        const href = businessHref(it.href);
        const active = isActive(href);
        const Icon = it.icon;
        return (
          <Link
            key={it.href}
            href={href}
            className={cn(
              "flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg text-[11px] font-medium min-w-0 flex-1 text-center",
              active ? "text-saffron" : "text-muted-foreground",
            )}
          >
            <Icon
              className={cn(
                "size-5",
                active ? "text-saffron" : "text-muted-foreground",
              )}
            />
            <span className="max-w-[76px] leading-tight">{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
