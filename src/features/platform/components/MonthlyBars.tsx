import { monthLabel } from "../usage-model";
import { cn } from "@/lib/utils";

/**
 * Single-series monthly bar chart (one hue, thin bars with rounded data-ends on a recessive baseline).
 * Each bar shows its value on hover; a visually hidden table carries the data for screen readers and
 * keyboard users. `limit` draws a dashed allowance line when it falls inside the scale.
 */
export function MonthlyBars({ label, months, limit, height = 96, className }: {
  label: string; months: { month: string; count: number }[]; limit?: number; height?: number; className?: string;
}) {
  const peak = Math.max(1, limit ?? 0, ...months.map(entry => entry.count));
  const showLimit = limit !== undefined && limit > 0;
  return <figure className={cn("min-w-0", className)}>
    <div className="relative" style={{ height }} aria-hidden>
      <div className="absolute inset-x-0 bottom-0 border-t border-border" />
      {showLimit && <div className="absolute inset-x-0 border-t border-dashed border-muted-foreground/50" style={{ bottom: `${(limit / peak) * 100}%` }}>
        <span className="absolute -top-4 right-0 text-[10px] text-muted-foreground">Allowance {limit}</span>
      </div>}
      <div className="absolute inset-0 flex items-end gap-[2px]">
        {months.map(entry => <div key={entry.month} className="group relative flex h-full min-w-0 flex-1 items-end justify-center">
          <div className="w-full max-w-7 rounded-t-[4px] bg-primary/85 transition-colors group-hover:bg-primary"
            style={{ height: entry.count ? `max(2px, ${(entry.count / peak) * 100}%)` : 0 }} />
          <span className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-sm group-hover:block">
            {monthLabel(entry.month)}: <span className="font-semibold tabular-nums">{entry.count}</span>
          </span>
        </div>)}
      </div>
    </div>
    <div className="mt-1.5 flex gap-[2px]" aria-hidden>
      {months.map(entry => <span key={entry.month} className="min-w-0 flex-1 text-center text-[10px] text-muted-foreground">{monthLabel(entry.month)}</span>)}
    </div>
    <div className="sr-only"><table>
      <caption>{label}</caption>
      <thead><tr><th scope="col">Month</th><th scope="col">Count</th></tr></thead>
      <tbody>{months.map(entry => <tr key={entry.month}><th scope="row">{monthLabel(entry.month)} {entry.month.slice(0, 4)}</th><td>{entry.count}</td></tr>)}</tbody>
    </table></div>
  </figure>;
}
