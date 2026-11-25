"use client";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useShellShowsHeading } from "./ShellHeading";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}) {
  // Inside a section the header bar already names the page; keep the heading for screen readers only.
  const inHeader = useShellShowsHeading();
  if (inHeader && !eyebrow && !actions) return <h1 className="sr-only">{title}</h1>;
  return (
    <header
      className={cn(
        "flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
            {eyebrow}
          </div>
        )}
        <h1 className={inHeader ? "sr-only" : "text-forest font-semibold text-2xl sm:text-3xl leading-[1.15] heading-tight mt-1"}>
          {title}
        </h1>
        {subtitle && !inHeader && (
          <p className={cn("text-sm text-muted-foreground max-w-xl", !inHeader && "mt-2")}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0 min-w-0 max-w-full">{actions}</div>
      )}
    </header>
  );
}
