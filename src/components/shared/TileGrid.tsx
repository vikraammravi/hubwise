import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { BusinessLink } from "@/features/workspaces/BusinessLink";
import { cn } from "@/lib/utils";

export type TileBadge = { text: string; tone: "attention" | "info" | "done" };
export type HomeTile = { label: string; href: string; icon: LucideIcon; description: string; badge?: TileBadge | null };

const BADGE_TONE: Record<TileBadge["tone"], string> = {
  attention: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200",
  info: "bg-primary/10 text-foreground",
  done: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-200",
};

/**
 * Home-screen tiles: one large tap target per area of the app, each with a short live status
 * ("3 waiting") so people see what needs doing first. Status is always written out, never colour alone.
 */
export function TileGrid({ tiles, label, loading = false, className }: { tiles: HomeTile[]; label: string; loading?: boolean; className?: string }) {
  return <nav aria-label={label} className={className}>
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {tiles.map(tile => <li key={tile.href} className="min-w-0">
        <BusinessLink href={tile.href} aria-label={`${tile.label}${!loading && tile.badge ? `, ${tile.badge.text}` : ""}. ${tile.description}`}
          className="group flex h-full min-h-32 flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <tile.icon className="size-5" />
            </span>
            {loading ? <span aria-hidden className="h-5 w-14 animate-pulse rounded-full bg-muted" />
              : tile.badge && <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold leading-5", BADGE_TONE[tile.badge.tone])}>{tile.badge.text}</span>}
          </div>
          <div className="mt-auto min-w-0">
            <span className="flex items-center gap-1 text-sm font-semibold text-foreground sm:text-base">
              <span className="truncate">{tile.label}</span>
              <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </span>
            <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{tile.description}</span>
          </div>
        </BusinessLink>
      </li>)}
    </ul>
  </nav>;
}
