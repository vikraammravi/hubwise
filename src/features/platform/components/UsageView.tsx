"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Circle, ScanLine, Settings2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/shared/Banner";
import { LoadingState } from "@/components/shared/Spinner";
import { useAsyncData } from "@/lib/useAsyncData";
import { cn } from "@/lib/utils";
import { fetchBusinessUsage, type PlatformBusiness } from "../data";
import { FEATURE_LABELS, SETUP_LABELS, SETUP_STEPS, USAGE_FEATURES, lastSeen, scanShare, setupProgress, type BusinessUsage } from "../usage-model";
import { StatusPill } from "./BusinessCard";
import { MonthlyBars } from "./MonthlyBars";
import { AiScanDialog, type AiScanTarget } from "./AiScanDialog";

/** Matches the platform ceiling in reserve_receipt_scan_for_business (Azure free tier). */
export const PLATFORM_SCAN_CEILING = 100;

function Tile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return <div className="rounded-xl border bg-card p-4 shadow-xs">
    <p className="text-xs font-medium text-muted-foreground">{label}</p>
    <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
    {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
  </div>;
}

function ScanMeter({ usage, name, now }: { usage: BusinessUsage; name: string; now: number }) {
  const scan = usage.aiScan;
  const share = scanShare(scan);
  const state = !scan.enabled ? "off" : share >= 1 ? "used" : share >= 0.8 ? "near" : "ok";
  return <div className="space-y-1.5">
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <span><span className="font-semibold tabular-nums">{scan.thisMonth}</span><span className="text-muted-foreground"> of {scan.monthlyLimit} this month</span></span>
      {state === "off" && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Off</span>}
      {state === "used" && <span className="flex items-center gap-1 text-[11px] font-medium text-red-700"><AlertTriangle className="size-3" aria-hidden />Allowance used</span>}
      {state === "near" && <span className="flex items-center gap-1 text-[11px] font-medium text-amber-700"><AlertTriangle className="size-3" aria-hidden />Near allowance</span>}
    </div>
    <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="meter" aria-label={`AI scans used this month by ${name}`} aria-valuemin={0} aria-valuemax={scan.monthlyLimit} aria-valuenow={Math.min(scan.thisMonth, scan.monthlyLimit)}>
      <div className={cn("h-full rounded-full", state === "used" ? "bg-red-600" : state === "near" ? "bg-amber-500" : state === "off" ? "bg-muted-foreground/40" : "bg-primary")} style={{ width: `${share * 100}%` }} />
    </div>
    <p className="text-xs text-muted-foreground">{scan.lastScanAt ? <>Receipts read {scan.succeeded} · failed {scan.failed} · last scan {lastSeen(scan.lastScanAt, now).toLowerCase()}</> : "No scans yet"}</p>
  </div>;
}

function UsageCard({ business, usage, now, onManage }: { business: PlatformBusiness; usage: BusinessUsage; now: number; onManage?: () => void }) {
  const progress = setupProgress(usage);
  return <li className="space-y-4 px-4 py-4 sm:px-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <h3 className="truncate text-sm font-semibold">{business.name}</h3>
        <StatusPill status={business.status} />
      </div>
      <p className="text-xs text-muted-foreground">Last activity {lastSeen(usage.lastActivityAt, now).toLowerCase()}</p>
    </div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <section aria-label={`Setup for ${business.name}`} className="space-y-2 rounded-lg border p-3">
        <div className="flex items-center justify-between text-xs font-medium"><span>Setup</span><span className="tabular-nums text-muted-foreground">{progress.done}/{progress.total}</span></div>
        <div className="flex gap-1" aria-hidden>{SETUP_STEPS.map(step => <span key={step} className={cn("h-1.5 flex-1 rounded-full", usage.setup[step] ? "bg-primary" : "bg-muted")} />)}</div>
        <ul className="space-y-1">
          {SETUP_STEPS.map(step => <li key={step} className={cn("flex items-center gap-2 text-xs", usage.setup[step] ? "text-foreground" : "text-muted-foreground")}>
            {usage.setup[step] ? <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden /> : <Circle className="size-3.5" aria-hidden />}
            {SETUP_LABELS[step]}<span className="sr-only">{usage.setup[step] ? ": done" : ": not yet"}</span>
          </li>)}
        </ul>
        <p className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground"><Users className="size-3.5" aria-hidden />{usage.people.members} people · {usage.people.active7d} signed in this week · {usage.branches} {usage.branches === 1 ? "branch" : "branches"}</p>
      </section>

      <section aria-label={`AI scanning for ${business.name}`} className="space-y-3 rounded-lg border p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-medium"><ScanLine className="size-3.5" aria-hidden />AI scanning</span>
          {onManage && <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onManage} aria-label={`Manage AI scanning for ${business.name}`}><Settings2 className="size-3.5" />Manage</Button>}
        </div>
        <ScanMeter usage={usage} name={business.name} now={now} />
        <MonthlyBars label={`AI scans per month for ${business.name}`} months={usage.aiScan.months} height={56} />
      </section>

      <section aria-label={`Feature usage for ${business.name}`} className="rounded-lg border p-3 md:col-span-2 xl:col-span-1">
        <div className="mb-2 flex items-center justify-between text-xs font-medium"><span>Features</span><span className="text-muted-foreground">Last 30 days</span></div>
        <ul className="divide-y text-xs">
          {USAGE_FEATURES.map(key => {
            const feature = usage.features[key];
            const used = feature.total > 0;
            return <li key={key} className="flex items-center justify-between gap-2 py-1.5">
              <span className={cn("flex items-center gap-1.5", !used && "text-muted-foreground")}>
                <span aria-hidden className={cn("size-1.5 rounded-full", feature.recent > 0 ? "bg-emerald-500" : used ? "bg-amber-400" : "bg-muted-foreground/30")} />
                {FEATURE_LABELS[key]}
              </span>
              <span className="text-right text-muted-foreground">{used
                ? <><span className="font-medium tabular-nums text-foreground">{feature.recent}</span> · {lastSeen(feature.lastAt, now).toLowerCase()}</>
                : "Not used yet"}</span>
            </li>;
          })}
        </ul>
      </section>
    </div>
  </li>;
}

/** Console usage: AI scanning per business, feature usage and setup progress. Counts and dates only. */
export function UsageView({ businesses, canManage }: { businesses: PlatformBusiness[]; canManage: boolean }) {
  const report = useAsyncData(fetchBusinessUsage);
  const [managing, setManaging] = useState<AiScanTarget | null>(null);
  const [notice, setNotice] = useState("");
  const rows = useMemo(() => {
    const byId = new Map((report.data?.usage ?? []).map(usage => [usage.businessId, usage]));
    return businesses.flatMap(business => { const usage = byId.get(business.id); return usage ? [{ business, usage }] : []; });
  }, [businesses, report.data]);
  const now = report.data ? Date.parse(report.data.generatedAt) : 0;
  const totals = useMemo(() => {
    const months = new Map<string, number>();
    for (const { usage } of rows) for (const entry of usage.aiScan.months) months.set(entry.month, (months.get(entry.month) ?? 0) + entry.count);
    return {
      scans: rows.reduce((sum, { usage }) => sum + usage.aiScan.thisMonth, 0),
      active7d: rows.reduce((sum, { usage }) => sum + usage.people.active7d, 0),
      activeBusinesses: rows.filter(({ usage }) => usage.lastActivityAt && now - Date.parse(usage.lastActivityAt) < 30 * 86400000).length,
      setUp: rows.filter(({ usage }) => setupProgress(usage).done === SETUP_STEPS.length).length,
      months: [...months].sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count })),
    };
  }, [rows, now]);

  if (report.loading && !report.data) return <LoadingState label="Loading usage…" />;
  if (report.error && !report.data) return <Banner tone="danger">{report.error}<Button variant="ghost" onClick={() => void report.refresh()}>Retry</Button></Banner>;

  return <div className="space-y-6">
    {notice && <Banner tone="success">{notice}</Banner>}
    <section aria-label="Usage summary" className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Tile label="AI scans this month" value={totals.scans} hint={`Platform ceiling ${PLATFORM_SCAN_CEILING}`} />
      <Tile label="Signed in this week" value={totals.active7d} hint="People across all businesses" />
      <Tile label="Active businesses" value={`${totals.activeBusinesses}/${rows.length}`} hint="Activity in the last 30 days" />
      <Tile label="Fully set up" value={`${totals.setUp}/${rows.length}`} hint="All 5 setup steps done" />
    </section>

    <section aria-label="AI scans across the platform" className="rounded-xl border bg-card p-4 shadow-xs sm:p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">AI scans across the platform</h2>
        <p className="text-xs text-muted-foreground">Last 6 months · ceiling {PLATFORM_SCAN_CEILING} a month</p>
      </div>
      <MonthlyBars label="AI scans per month across all businesses" months={totals.months} height={140} />
    </section>

    <section aria-label="Usage by business" className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <header className="border-b px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold">By business</h2>
        <p className="text-xs text-muted-foreground">Counts and dates only. No amounts or customer records leave a business.</p>
      </header>
      {rows.length ? <ul className="divide-y">
        {rows.map(({ business, usage }) => <UsageCard key={business.id} business={business} usage={usage} now={now}
          onManage={canManage && business.status !== "provisioning" ? () => setManaging({ businessId: business.id, name: business.name, scan: usage.aiScan }) : undefined} />)}
      </ul> : <p className="px-6 py-10 text-center text-sm text-muted-foreground">No businesses registered yet.</p>}
    </section>

    <AiScanDialog target={managing} onClose={() => setManaging(null)}
      onSaved={() => { const name = managing?.name; setManaging(null); setNotice(`AI scanning updated for ${name}.`); void report.refresh(true); }} />
  </div>;
}
