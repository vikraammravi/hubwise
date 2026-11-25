import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * A business's own mark: its logo, or its initials on its accent colour. Never another business's brand.
 * `layout="stacked"` for sign-in pages; `layout="inline"` for app headers and sidebars.
 */
export function BusinessMark({ name, logoUrl, accent, size = "md", layout = "stacked", href, className, showName = true }: {
  name: string; logoUrl?: string | null; accent?: string | null; size?: "sm" | "md" | "lg"; layout?: "stacked" | "inline"; href?: string | null; className?: string;
  /** false: logo only (its alt text still names the business). */
  showName?: boolean;
}) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]!.toUpperCase()).join("") || "?";
  const box = { sm: "h-7 max-w-28", md: "h-10 max-w-40", lg: "h-14 max-w-56" }[size];
  const tile = { sm: "size-7 text-xs", md: "size-10 text-sm", lg: "size-14 text-lg" }[size];
  const inline = layout === "inline";
  const mark = logoUrl
    ? <Image src={logoUrl} alt={`${name} logo`} width={224} height={56} unoptimized className={cn("w-auto object-contain", box)} />
    : <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-lg font-semibold text-white shadow-sm", tile)} style={{ backgroundColor: accent ?? "#334155" }}>{initials}</span>;
  // An inline logo already carries the name; initials need the name beside them.
  const label = showName && (!inline || !logoUrl) && <span className={cn("font-semibold tracking-tight", inline ? "truncate text-sm" : "text-sm")}>{name}</span>;
  const content = <div className={cn(inline ? "flex min-w-0 items-center gap-2.5" : "flex flex-col items-center gap-2 text-center", className)}>{mark}{label}</div>;
  return href ? <Link href={href} className="min-w-0" aria-label={`${name} home`}>{content}</Link> : content;
}
