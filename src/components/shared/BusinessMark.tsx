import Image from "next/image";
import { cn } from "@/lib/utils";

/** A business's own mark: its logo, or its initials on its accent colour. Never another business's brand. */
export function BusinessMark({ name, logoUrl, accent, size = "md", className }: { name: string; logoUrl?: string | null; accent?: string | null; size?: "md" | "lg"; className?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]!.toUpperCase()).join("") || "?";
  const box = size === "lg" ? "h-14 max-w-56" : "h-10 max-w-40";
  return <div className={cn("flex flex-col items-center gap-2 text-center", className)}>
    {logoUrl
      ? <Image src={logoUrl} alt={`${name} logo`} width={224} height={56} unoptimized className={cn("w-auto object-contain", box)} />
      : <span aria-hidden className={cn("grid place-items-center rounded-xl font-semibold text-white shadow-sm", size === "lg" ? "size-14 text-lg" : "size-10 text-sm")} style={{ backgroundColor: accent ?? "#334155" }}>{initials}</span>}
    <span className="text-sm font-semibold tracking-tight">{name}</span>
  </div>;
}
